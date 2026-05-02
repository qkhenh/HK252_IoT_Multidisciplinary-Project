const db = require('../libs/db');
const crypto = require('crypto');

/**
 * Sinh mã OTP 6 số ngẫu nhiên, đảm bảo unique trong các token còn active
 */
const generateUniqueOTP = async () => {
    let otp;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
        otp = crypto.randomInt(100000, 999999).toString();

        const result = await db.query(
            `SELECT 1 FROM access_tokens
             WHERE token_data = $1 AND is_used = false AND valid_until > NOW() LIMIT 1`,
            [otp]
        );

        if (result.rows.length === 0) isUnique = true;
        attempts++;
    }

    if (!isUnique) {
        throw new Error('Không thể sinh mã OTP unique sau nhiều lần thử');
    }

    return otp;
};

/**
 * Tạo OTP mới cho citizen (token_data = 6 chữ số)
 * @param {number} citizenId
 * @param {number} validMinutes
 */
const createOTP = async (citizenId, validMinutes = 15) => {
    const otpCode = await generateUniqueOTP();

    const result = await db.query(
        `INSERT INTO access_tokens (issued_by, token_data, valid_from, valid_until, is_used)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '${validMinutes} minutes', false)
         RETURNING token_id, token_data, valid_from, valid_until`,
        [citizenId, otpCode]
    );

    return result.rows[0];
};

/**
 * Tạo QR token cho citizen (token_data = UUID, hiệu lực 3 phút) — UC-15
 * @param {number} citizenId
 */
const createQRToken = async (citizenId) => {
    const uuid = crypto.randomUUID();

    const result = await db.query(
        `INSERT INTO access_tokens (issued_by, token_data, valid_from, valid_until, is_used)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '3 minutes', false)
         RETURNING token_id, token_data, valid_from, valid_until`,
        [citizenId, uuid]
    );

    return result.rows[0];
};

/**
 * Lấy danh sách token (OTP + QR) của citizen
 * @param {number} citizenId
 */
const getOTPsByCitizen = async (citizenId) => {
    const result = await db.query(
        `SELECT
             token_id,
             token_data,
             valid_from,
             valid_until,
             is_used,
             used_at,
             CASE
                 WHEN is_used = true THEN 'used'
                 WHEN valid_until < NOW() THEN 'expired'
                 ELSE 'active'
             END as status
         FROM access_tokens
         WHERE issued_by = $1
         ORDER BY valid_from DESC
         LIMIT 20`,
        [citizenId]
    );
    return result.rows;
};

/**
 * Kiểm tra citizen có tồn tại không
 * @param {number} userId
 */
const checkCitizenExists = async (userId) => {
    const query = `SELECT user_id FROM citizens WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    return result.rows.length > 0;
};

// ========================
// VEHICLES MANAGEMENT
// ========================

/**
 * Lấy danh sách xe của citizen
 * @param {number} citizenId
 */
const getVehiclesByCitizen = async (citizenId) => {
    const result = await db.query(
        `SELECT
             vehicle_id,
             license_plate,
             vehicle_type,
             vehicle_color,
             is_active,
             is_inside,
             last_log_time,
             registered_at
         FROM vehicles
         WHERE owner_user_id = $1
         ORDER BY registered_at DESC`,
        [citizenId]
    );
    return result.rows;
};

/**
 * Kiểm tra biển số đã tồn tại chưa
 * @param {string} licensePlate
 */
const checkLicensePlateExists = async (licensePlate) => {
    const query = `
        SELECT vehicle_id, owner_user_id 
        FROM vehicles 
        WHERE UPPER(REPLACE(license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
    `;
    const result = await db.query(query, [licensePlate]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Trả về danh sách loại xe hợp lệ (từ enum vehicle_type_enum)
 */
const getVehicleTypes = async () => {
    return ['car', 'motorbike', 'bicycle', 'truck', 'emergency'];
};

/**
 * Đăng ký xe mới
 * @param {Object} params
 */
const registerVehicle = async ({ ownerId, vehicleType, licensePlate, vehicleColor }) => {
    const result = await db.query(
        `INSERT INTO vehicles (owner_user_id, vehicle_type, license_plate, vehicle_color, is_active)
         VALUES ($1, $2, $3, $4, false)
         RETURNING vehicle_id, license_plate, vehicle_type, vehicle_color, is_active, registered_at`,
        [ownerId, vehicleType, licensePlate, vehicleColor || null]
    );
    return result.rows[0];
};

/**
 * Cập nhật thông tin xe
 * @param {Object} params
 */
const updateVehicleInfo = async ({ vehicleId, ownerId, vehicleType, licensePlate, vehicleColor }) => {
    const result = await db.query(
        `UPDATE vehicles
         SET license_plate = $1, vehicle_type = $2, vehicle_color = $3, is_active = false
         WHERE vehicle_id = $4 AND owner_user_id = $5
         RETURNING vehicle_id, license_plate, vehicle_type, vehicle_color, is_active`,
        [licensePlate, vehicleType, vehicleColor || null, vehicleId, ownerId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Xóa xe cá nhân
 * @param {number} vehicleId
 * @param {number} ownerId
 */
const deleteVehicle = async (vehicleId, ownerId) => {
    const result = await db.query(
        `DELETE FROM vehicles
         WHERE vehicle_id = $1 AND owner_user_id = $2
         RETURNING vehicle_id`,
        [vehicleId, ownerId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Cập nhật trạng thái xe
 * @param {number} vehicleId
 * @param {number} ownerId
 * @param {boolean} isActive
 */
const updateVehicleStatus = async (vehicleId, ownerId, isActive) => {
    const result = await db.query(
        `UPDATE vehicles
         SET is_active = $3
         WHERE vehicle_id = $1 AND owner_user_id = $2
         RETURNING vehicle_id, is_active`,
        [vehicleId, ownerId, isActive]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

// ========================
// GUEST REGISTRATION
// ========================

/**
 * Lấy danh sách khách đã đăng ký của citizen
 * @param {number} hostId
 */
const getGuestRegistrations = async (hostId) => {
    const result = await db.query(
        `SELECT
             gr.registration_id,
             gr.guest_name,
             gr.guest_license_plate,
             gr.vehicle_type,
             gr.visit_start_time,
             gr.visit_end_time,
             gr.status,
             CASE
                 WHEN gr.status = 'cancelled' THEN 'cancelled'
                 WHEN gr.visit_end_time < NOW() THEN 'expired'
                 WHEN gr.visit_start_time > NOW() THEN 'upcoming'
                 ELSE 'active'
             END as current_status
         FROM guest_registrations gr
         WHERE gr.host_user_id = $1
         ORDER BY gr.visit_start_time DESC
         LIMIT 50`,
        [hostId]
    );
    return result.rows;
};

/**
 * Đăng ký khách có hẹn trước
 * @param {Object} params
 */
const registerGuest = async ({ hostId, guestName, guestLicensePlate, vehicleType, visitStartTime, visitEndTime }) => {
    const result = await db.query(
        `INSERT INTO guest_registrations (
             host_user_id, guest_name, guest_license_plate, vehicle_type,
             visit_start_time, visit_end_time, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'approved')
         RETURNING registration_id, guest_name, guest_license_plate, visit_start_time, visit_end_time, status`,
        [hostId, guestName, guestLicensePlate, vehicleType || 'car', visitStartTime, visitEndTime]
    );
    return result.rows[0];
};

/**
 * Hủy đăng ký khách
 * @param {number} registrationId
 * @param {number} hostId
 */
const cancelGuestRegistration = async (registrationId, hostId) => {
    const result = await db.query(
        `UPDATE guest_registrations
         SET status = 'cancelled'
         WHERE registration_id = $1 AND host_user_id = $2
         RETURNING registration_id, status`,
        [registrationId, hostId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Kiểm tra biển số khách đã được đăng ký trong khung giờ chưa
 * @param {string} licensePlate
 * @param {string} startTime
 * @param {string} endTime
 * @param {number} excludeRegistrationId - ID để exclude khi update
 */
const checkGuestPlateConflict = async (licensePlate, startTime, endTime, excludeRegistrationId = null) => {
    let query = `
        SELECT registration_id, host_user_id, visit_start_time, visit_end_time
        FROM guest_registrations
        WHERE UPPER(REPLACE(guest_license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
          AND status IN ('approved')
          AND (
              (visit_start_time <= $2 AND visit_end_time >= $2)
              OR (visit_start_time <= $3 AND visit_end_time >= $3)
              OR (visit_start_time >= $2 AND visit_end_time <= $3)
          )
    `;
    
    const params = [licensePlate, startTime, endTime];
    
    if (excludeRegistrationId) {
        query += ` AND registration_id != $4`;
        params.push(excludeRegistrationId);
    }
    
    const result = await db.query(query, params);
    return result.rows.length > 0 ? result.rows[0] : null;
};

// ========================
// ACCESS LOGS (UC-04)
// ========================

/**
 * Lấy lịch sử ra vào của tất cả xe thuộc citizen (UC-04)
 */
const getMyAccessLogs = async (citizenId, { page = 1, limit = 20, from, to } = {}) => {
    const offset = (page - 1) * limit;
    const params = [citizenId];
    let p = 2;
    let whereExtra = '';

    if (from) { whereExtra += ` AND al.check_in_time >= $${p}`; params.push(from); p++; }
    if (to)   { whereExtra += ` AND al.check_in_time <= $${p}`; params.push(to);   p++; }

    const dataResult = await db.query(
        `SELECT
             al.log_id,
             al.check_in_time,
             al.detected_text,
             al.access_method,
             al.action_reason,
             v.license_plate,
             l.lane_name,
             g.gate_name
         FROM access_logs al
         JOIN vehicles v ON al.vehicle_id = v.vehicle_id
         JOIN lanes l ON al.lane_id = l.lane_id
         JOIN gates g ON l.gate_id = g.gate_id
         WHERE v.owner_user_id = $1
           ${whereExtra}
         ORDER BY al.check_in_time DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset]
    );

    const countResult = await db.query(
        `SELECT COUNT(*) as total
         FROM access_logs al
         JOIN vehicles v ON al.vehicle_id = v.vehicle_id
         WHERE v.owner_user_id = $1 ${whereExtra}`,
        params
    );

    return {
        total: parseInt(countResult.rows[0].total, 10),
        page,
        data: dataResult.rows,
    };
};

module.exports = {
    generateUniqueOTP,
    createOTP,
    createQRToken,
    getOTPsByCitizen,
    checkCitizenExists,
    // Vehicles
    getVehiclesByCitizen,
    checkLicensePlateExists,
    getVehicleTypes,
    registerVehicle,
    updateVehicleInfo,
    updateVehicleStatus,
    deleteVehicle,
    // Guest Registrations
    getGuestRegistrations,
    registerGuest,
    cancelGuestRegistration,
    checkGuestPlateConflict,
    // Access Logs
    getMyAccessLogs,
};
