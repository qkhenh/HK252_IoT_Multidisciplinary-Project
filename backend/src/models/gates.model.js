const db = require('../libs/db');

/**
 * Chuyển đổi Base64 string thành Buffer để lưu BYTEA
 * @param {string} base64String
 * @returns {Buffer|null}
 */
const base64ToBuffer = (base64String) => {
    if (!base64String) return null;
    const base64Data = base64String.includes(',')
        ? base64String.split(',')[1]
        : base64String;
    return Buffer.from(base64Data, 'base64');
};

/**
 * Kiểm tra biển số trong whitelist cư dân (vehicles) + anti-passback
 * @param {string} plateText
 */
const checkResidentWhitelist = async (plateText) => {
    const result = await db.query(`
        SELECT
            v.vehicle_id, v.owner_user_id, v.license_plate, v.vehicle_type,
            v.is_active, v.is_inside,
            u.full_name AS owner_name,
            c.phone_number AS owner_phone,
            c.address AS owner_address,
            z.zone_name
        FROM vehicles v
        JOIN users u ON v.owner_user_id = u.user_id
        JOIN citizens c ON v.owner_user_id = c.user_id
        LEFT JOIN zones z ON c.zone_id = z.zone_id
        WHERE UPPER(REPLACE(v.license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
          AND v.is_active = true
        LIMIT 1
    `, [plateText]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Kiểm tra biển số trong whitelist khách có hẹn (guest_registrations)
 * @param {string} plateText
 */
const checkGuestWhitelist = async (plateText) => {
    const result = await db.query(`
        SELECT
            gr.registration_id, gr.host_user_id, gr.guest_name,
            gr.guest_license_plate, gr.visit_start_time, gr.visit_end_time, gr.status,
            u.full_name AS host_name,
            c.phone_number AS host_phone,
            c.address AS host_address
        FROM guest_registrations gr
        JOIN users u ON gr.host_user_id = u.user_id
        JOIN citizens c ON gr.host_user_id = c.user_id
        WHERE UPPER(REPLACE(gr.guest_license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
          AND gr.status = 'approved'
          AND gr.visit_start_time <= NOW()
          AND gr.visit_end_time >= NOW()
        LIMIT 1
    `, [plateText]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy thông tin lane + gate
 * @param {string} laneId
 */
const getLaneInfo = async (laneId) => {
    const result = await db.query(`
        SELECT l.lane_id, l.lane_name, l.direction, g.gate_id, g.gate_name, g.is_active
        FROM lanes l
        JOIN gates g ON l.gate_id = g.gate_id
        WHERE l.lane_id = $1
    `, [laneId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy thông tin gate (dùng cho GET /gates/:gateId heartbeat)
 * @param {number} gateId
 */
const getGateInfo = async (gateId) => {
    const result = await db.query(`
        SELECT gate_id, zone_id, gate_name, is_active
        FROM gates WHERE gate_id = $1
    `, [gateId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Xử lý toàn bộ flow AI check-in biển số (UC-13 & UC-14)
 */
const processCheckIn = async ({ laneId, plateText, confidenceScore, imageBase64 }) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // 1. Lấy thông tin lane
        const laneResult = await client.query(
            `SELECT l.lane_id, l.lane_name, l.direction, g.gate_id, g.gate_name
             FROM lanes l JOIN gates g ON l.gate_id = g.gate_id WHERE l.lane_id = $1`,
            [laneId]
        );
        if (laneResult.rows.length === 0) throw new Error(`Lane '${laneId}' không tồn tại`);
        const lane = laneResult.rows[0];
        const imageBuffer = base64ToBuffer(imageBase64);

        // 2. Kiểm tra whitelist
        let vehicle = await checkResidentWhitelist(plateText);
        let guestRegistration = null;
        let isAccessGranted = false;
        let accessType = 'unknown';
        let denyReason = 'Xe không có trong whitelist';
        let ownerInfo = null;

        if (vehicle) {
            // Anti-passback: inbound khi đã ở trong, hoặc outbound khi chưa ở trong → từ chối
            if (lane.direction === 'inbound' && vehicle.is_inside) {
                denyReason = 'Anti-passback: xe đang ở trong khu';
                accessType = 'anti_passback';
            } else if (lane.direction === 'outbound' && !vehicle.is_inside) {
                denyReason = 'Anti-passback: xe không ở trong khu';
                accessType = 'anti_passback';
            } else {
                isAccessGranted = true;
                accessType = 'resident';
                ownerInfo = {
                    type: 'resident',
                    name: vehicle.owner_name,
                    phone: vehicle.owner_phone,
                    address: vehicle.owner_address,
                    zone_name: vehicle.zone_name,
                    vehicle_type: vehicle.vehicle_type,
                };
            }
        } else {
            guestRegistration = await checkGuestWhitelist(plateText);
            if (guestRegistration) {
                isAccessGranted = true;
                accessType = 'guest';
                ownerInfo = {
                    type: 'guest',
                    guest_name: guestRegistration.guest_name,
                    host_name: guestRegistration.host_name,
                    host_phone: guestRegistration.host_phone,
                    host_address: guestRegistration.host_address,
                };
            }
        }

        // 3. Tạo access log
        const logResult = await client.query(`
            INSERT INTO access_logs (
                lane_id, vehicle_id, guest_reg_id, access_method,
                detected_text, image_snapshot_data
            )
            VALUES ($1, $2, $3, 'ai_plate_recognition', $4, $5)
            RETURNING log_id, check_in_time
        `, [
            laneId,
            vehicle ? vehicle.vehicle_id : null,
            guestRegistration ? guestRegistration.registration_id : null,
            plateText,
            imageBuffer,
        ]);

        const logId = logResult.rows[0].log_id;
        const checkInTime = logResult.rows[0].check_in_time;

        // 4. Cập nhật anti-passback flag nếu được phép vào/ra
        if (isAccessGranted && vehicle) {
            const newIsInside = lane.direction === 'inbound';
            await client.query(
                `UPDATE vehicles SET is_inside = $1, last_log_time = NOW() WHERE vehicle_id = $2`,
                [newIsInside, vehicle.vehicle_id]
            );
        }

        await client.query('COMMIT');

        return {
            action: isAccessGranted ? 'OPEN' : 'KEEP_CLOSED',
            message: isAccessGranted
                ? (accessType === 'resident' ? 'Xe cư dân hợp lệ. Mở cổng.' : 'Xe khách có hẹn hợp lệ. Mở cổng.')
                : denyReason,
            log_id: logId,
            check_in_time: checkInTime,
            plate_text: plateText,
            confidence_score: confidenceScore,
            access_type: accessType,
            owner_info: ownerInfo,
            lane_name: lane.lane_name,
            gate_name: lane.gate_name,
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Xác thực OTP/QR từ Camera (UC-06) — AI gửi kết quả OCR
 */
const verifyTokenForCheckIn = async ({ laneId, tokenData, codeType, imageBase64 }) => {
    const accessMethod = codeType === 'qr_uuid' ? 'ai_camera_qr' : 'ai_camera_otp';
    const imageBuffer = base64ToBuffer(imageBase64);

    // Tìm token hợp lệ
    const tokenResult = await db.query(`
        SELECT
            t.token_id, t.token_data, t.issued_by,
            u.full_name AS issued_by_name,
            c_info.phone_number,
            c_info.address
        FROM access_tokens t
        JOIN citizens c_info ON t.issued_by = c_info.user_id
        JOIN users u ON c_info.user_id = u.user_id
        WHERE t.token_data = $1 AND t.is_used = false AND t.valid_until > NOW()
        LIMIT 1
    `, [tokenData]);

    if (tokenResult.rows.length === 0) {
        // Ghi log thất bại
        await db.query(`
            INSERT INTO access_logs (lane_id, access_method, detected_text, image_snapshot_data)
            VALUES ($1, $2, $3, $4)
        `, [laneId, accessMethod, tokenData, imageBuffer]);

        return {
            action: 'KEEP_CLOSED',
            log_id: null,
            message: 'Token không hợp lệ hoặc đã hết hạn.',
        };
    }

    const token = tokenResult.rows[0];
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // Đánh dấu token đã dùng
        await client.query(
            `UPDATE access_tokens SET is_used = true, used_at = NOW() WHERE token_id = $1`,
            [token.token_id]
        );

        // Ghi log thành công
        const logResult = await client.query(`
            INSERT INTO access_logs (lane_id, token_id, access_method, detected_text, image_snapshot_data)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING log_id, check_in_time
        `, [laneId, token.token_id, accessMethod, tokenData, imageBuffer]);

        await client.query('COMMIT');

        return {
            action: 'OPEN',
            log_id: logResult.rows[0].log_id,
            check_in_time: logResult.rows[0].check_in_time,
            issued_by: `${token.issued_by_name} (${token.address || 'N/A'})`,
            message: 'Token hợp lệ. Mở cổng tự động.',
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    base64ToBuffer,
    checkResidentWhitelist,
    checkGuestWhitelist,
    getLaneInfo,
    getGateInfo,
    processCheckIn,
    verifyTokenForCheckIn,
};

