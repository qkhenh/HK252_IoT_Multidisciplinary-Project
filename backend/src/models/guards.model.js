const db = require('../libs/db');

/**
 * Tìm và validate token (OTP hoặc QR UUID)
 * @param {string} tokenData - Mã 6 số OTP hoặc UUID QR
 */
const findValidToken = async (tokenData) => {
    const result = await db.query(
        `SELECT
             at.token_id,
             at.token_data,
             at.issued_by,
             at.valid_from,
             at.valid_until,
             at.is_used,
             u.full_name as issued_by_name,
             c.address,
             c.phone_number as issued_by_phone,
             CASE WHEN at.valid_until < NOW() THEN true ELSE false END as is_expired
         FROM access_tokens at
         JOIN citizens c ON at.issued_by = c.user_id
         JOIN users u ON c.user_id = u.user_id
         WHERE at.token_data = $1
         ORDER BY at.valid_from DESC
         LIMIT 1`,
        [tokenData]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
};

// Alias để tương thích ngược
const findValidOTP = findValidToken;

/**
 * Đánh dấu OTP đã sử dụng
 * @param {number} tokenId
 */
const markOTPAsUsed = async (tokenId) => {
    const query = `
        UPDATE access_tokens 
        SET is_used = true, used_at = NOW()
        WHERE token_id = $1
        RETURNING token_id, is_used, used_at
    `;
    
    const result = await db.query(query, [tokenId]);
    return result.rows[0];
};

/**
 * Ghi log access khi verify OTP thủ công thành công
 * @param {Object} params
 */
const logOTPAccess = async ({ laneId, guardId, tokenId, note }) => {
    const result = await db.query(
        `INSERT INTO access_logs (
             lane_id, guard_id, token_id, access_method, note
         )
         VALUES ($1, $2, $3, 'ai_camera_otp', $4)
         RETURNING log_id, check_in_time`,
        [laneId, guardId, tokenId || null, note || null]
    );
    return result.rows[0];
};

/**
 * Kiểm tra guard có tồn tại không và lấy assigned_gate_id
 */
const checkGuardAssignment = async (guardId) => {
    const result = await db.query(
        `SELECT sg.user_id, sg.assigned_gate_id, u.full_name
         FROM security_guards sg
         JOIN users u ON sg.user_id = u.user_id
         WHERE sg.user_id = $1`,
        [guardId]
    );

    if (result.rows.length === 0) return { exists: false };

    const guard = result.rows[0];
    return {
        exists: true,
        full_name: guard.full_name,
        assigned_gate_id: guard.assigned_gate_id,
    };
};

// ========================
// MANUAL ACTIONS
// ========================

// Danh sách action types được phép
const VALID_ACTION_TYPES = ['open_barrier', 'keep_closed_log_only'];

// Danh sách lý do thường gặp
const COMMON_REASONS = [
    'emergency_vehicle',    // Xe cứu thương/cứu hỏa
    'shipper_delivery',     // Shipper giao hàng
    'ai_error',             // Lỗi AI nhận dạng sai
    'vip_guest',            // Khách VIP
    'maintenance',          // Bảo trì
    'other'                 // Khác
];

/**
 * Ghi log thao tác thủ công của bảo vệ
 * @param {Object} params
 */
const logManualAction = async ({ laneId, guardId, actionType, actionReason, note, imageSnapshotBuffer }) => {
    const result = await db.query(
        `INSERT INTO access_logs (
             lane_id, guard_id, access_method, action_reason, note, image_snapshot_data
         )
         VALUES ($1, $2, 'manual_guard', $3, $4, $5)
         RETURNING log_id, check_in_time`,
        [laneId, guardId, actionReason || null, note || null, imageSnapshotBuffer || null]
    );

    return result.rows[0];
};

/**
 * Lấy thông tin lane + gate
 * @param {string} laneId
 */
const getLaneInfo = async (laneId) => {
    const result = await db.query(
        `SELECT l.lane_id, l.lane_name, l.direction, g.gate_id, g.gate_name, g.is_active
         FROM lanes l
         JOIN gates g ON l.gate_id = g.gate_id
         WHERE l.lane_id = $1`,
        [laneId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy lịch sử access logs cho màn hình bảo vệ (real-time monitoring)
 * @param {string} laneId
 * @param {number} limit
 */
const getRecentAccessLogs = async (laneId, limit = 20) => {
    const result = await db.query(
        `SELECT
             al.log_id,
             al.check_in_time,
             al.access_method,
             al.detected_text,
             al.action_reason,
             al.note,
             l.lane_name,
             g.gate_name,
             v.license_plate,
             u.full_name as guard_name
         FROM access_logs al
         LEFT JOIN lanes l ON al.lane_id = l.lane_id
         LEFT JOIN gates g ON l.gate_id = g.gate_id
         LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
         LEFT JOIN users u ON al.guard_id = u.user_id
         WHERE al.lane_id = $1
         ORDER BY al.check_in_time DESC
         LIMIT $2`,
        [laneId, limit]
    );
    return result.rows;
};

/**
 * Lấy thống kê nhanh cho màn hình bảo vệ
 * @param {string} laneId
 */
const getGateStats = async (laneId) => {
    const result = await db.query(
        `SELECT
             COUNT(*) FILTER (WHERE check_in_time >= NOW() - INTERVAL '1 hour') as last_hour,
             COUNT(*) FILTER (WHERE check_in_time >= NOW() - INTERVAL '24 hours') as last_24h
         FROM access_logs
         WHERE lane_id = $1`,
        [laneId]
    );
    return result.rows[0];
};

// ========================
// GUEST REGISTRATION BY GUARD (UC-02)
// ========================

/**
 * Guard đăng ký khách thay cư dân
 */
const createGuestRegistration = async ({ hostCitizenId, guestName, guestLicensePlate, vehicleType, visitStartTime, visitEndTime }) => {
    const result = await db.query(
        `INSERT INTO guest_registrations (
             host_user_id, guest_name, guest_license_plate, vehicle_type,
             visit_start_time, visit_end_time, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'approved')
         RETURNING registration_id, guest_name, guest_license_plate, visit_start_time, visit_end_time, status`,
        [hostCitizenId, guestName, guestLicensePlate, vehicleType || 'car', visitStartTime, visitEndTime]
    );
    return result.rows[0];
};

/**
 * Kiểm tra citizen tồn tại
 */
const checkCitizenExists = async (citizenId) => {
    const result = await db.query(
        `SELECT user_id FROM citizens WHERE user_id = $1`,
        [citizenId]
    );
    return result.rows.length > 0;
};

// ========================
// AI CORRECTION (UC-08)
// ========================

/**
 * Guard báo cáo biển số AI đọc sai — cập nhật cột note trong access_logs
 */
const addAICorrection = async (logId, guardId, correctedPlateText) => {
    const result = await db.query(
        `UPDATE access_logs
         SET note = $3, guard_id = $2
         WHERE log_id = $1
         RETURNING log_id, note`,
        [logId, guardId, correctedPlateText]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy thông tin log để kiểm tra trước khi sửa
 */
const getLogById = async (logId) => {
    const result = await db.query(
        `SELECT al.log_id, al.lane_id, al.detected_text, al.note
         FROM access_logs al
         WHERE al.log_id = $1`,
        [logId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

module.exports = {
    findValidToken,
    findValidOTP,
    markOTPAsUsed,
    logOTPAccess,
    checkGuardAssignment,
    // Manual actions
    VALID_ACTION_TYPES,
    COMMON_REASONS,
    logManualAction,
    getLaneInfo,
    // Monitoring
    getRecentAccessLogs,
    getGateStats,
    // Guest registration
    createGuestRegistration,
    checkCitizenExists,
    // AI correction
    addAICorrection,
    getLogById,
};
