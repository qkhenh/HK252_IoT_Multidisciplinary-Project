const db = require('../libs/db');

/**
 * Tìm và validate OTP
 * @param {string} otpCode - Mã OTP 6 số
 * @returns {Object|null} Token info nếu hợp lệ, null nếu không
 */
const findValidOTP = async (otpCode) => {
    const query = `
        SELECT 
            at.token_id,
            at.otp_code,
            at.issued_by,
            at.valid_from,
            at.valid_until,
            at.is_used,
            u.full_name as issued_by_name,
            c.phone_number as issued_by_phone,
            h.house_number,
            h.block_number,
            CASE WHEN at.valid_until < NOW() THEN true ELSE false END as is_expired
        FROM access_tokens at
        JOIN citizens c ON at.issued_by = c.user_id
        JOIN users u ON c.user_id = u.user_id
        LEFT JOIN houses h ON c.house_id = h.house_id
        WHERE at.otp_code = $1
        ORDER BY at.valid_from DESC
        LIMIT 1
    `;
    
    const result = await db.query(query, [otpCode]);
    
    if (result.rows.length === 0) {
        return null;
    }
    
    return result.rows[0];
};

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
 * Ghi log access khi verify OTP thành công
 * @param {Object} params
 */
const logOTPAccess = async ({ gateId, guardId, guestRegistrationId, note }) => {
    const query = `
        INSERT INTO access_logs (
            gate_id, 
            guard_id, 
            guest_registration_id,
            access_method, 
            is_access_granted, 
            note
        )
        VALUES ($1, $2, $3, 'manual_otp', true, $4)
        RETURNING log_id, check_in_time
    `;
    
    const result = await db.query(query, [gateId, guardId, guestRegistrationId, note]);
    return result.rows[0];
};

/**
 * Kiểm tra guard có tồn tại và được assign gate này không
 */
const checkGuardAssignment = async (guardId, gateId) => {
    const query = `
        SELECT sg.user_id, sg.assigned_gate_id, u.full_name
        FROM security_guards sg
        JOIN users u ON sg.user_id = u.user_id
        WHERE sg.user_id = $1
    `;
    
    const result = await db.query(query, [guardId]);
    
    if (result.rows.length === 0) {
        return { exists: false };
    }
    
    const guard = result.rows[0];
    return {
        exists: true,
        full_name: guard.full_name,
        assigned_gate_id: guard.assigned_gate_id,
        is_assigned_to_gate: guard.assigned_gate_id === gateId,
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
const logManualAction = async ({ 
    gateId, 
    guardId, 
    actionType, 
    note,
    imageSnapshotBuffer 
}) => {
    const isAccessGranted = actionType === 'open_barrier';
    
    const query = `
        INSERT INTO access_logs (
            gate_id, 
            guard_id, 
            access_method,
            is_access_granted, 
            note,
            image_snapshot_data
        )
        VALUES ($1, $2, 'manual_guard', $3, $4, $5)
        RETURNING log_id, check_in_time, is_access_granted
    `;
    
    const result = await db.query(query, [
        gateId, 
        guardId, 
        isAccessGranted, 
        note,
        imageSnapshotBuffer || null
    ]);
    
    return result.rows[0];
};

/**
 * Lấy thông tin cổng
 * @param {number} gateId
 */
const getGateInfo = async (gateId) => {
    const query = `
        SELECT gate_id, zone_id, gate_name, direction, is_active
        FROM gates WHERE gate_id = $1
    `;
    const result = await db.query(query, [gateId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy lịch sử access logs cho màn hình bảo vệ (real-time monitoring)
 * @param {number} gateId
 * @param {number} limit
 */
const getRecentAccessLogs = async (gateId, limit = 20) => {
    const query = `
        SELECT 
            al.log_id,
            al.check_in_time,
            al.access_method,
            al.is_access_granted,
            al.note,
            g.gate_name,
            v.license_plate,
            ap.detected_plate_text,
            ap.confidence_score,
            u.full_name as guard_name
        FROM access_logs al
        LEFT JOIN gates g ON al.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        LEFT JOIN ai_predictions ap ON al.log_id = ap.log_id
        LEFT JOIN users u ON al.guard_id = u.user_id
        WHERE al.gate_id = $1
        ORDER BY al.check_in_time DESC
        LIMIT $2
    `;
    
    const result = await db.query(query, [gateId, limit]);
    return result.rows;
};

/**
 * Lấy thống kê nhanh cho màn hình bảo vệ
 * @param {number} gateId
 */
const getGateStats = async (gateId) => {
    const query = `
        SELECT 
            COUNT(*) FILTER (WHERE check_in_time >= NOW() - INTERVAL '1 hour') as last_hour,
            COUNT(*) FILTER (WHERE check_in_time >= NOW() - INTERVAL '24 hours') as last_24h,
            COUNT(*) FILTER (WHERE is_access_granted = true AND check_in_time >= NOW() - INTERVAL '24 hours') as granted_24h,
            COUNT(*) FILTER (WHERE is_access_granted = false AND check_in_time >= NOW() - INTERVAL '24 hours') as denied_24h
        FROM access_logs
        WHERE gate_id = $1
    `;
    
    const result = await db.query(query, [gateId]);
    return result.rows[0];
};

module.exports = {
    findValidOTP,
    markOTPAsUsed,
    logOTPAccess,
    checkGuardAssignment,
    // Manual actions
    VALID_ACTION_TYPES,
    COMMON_REASONS,
    logManualAction,
    getGateInfo,
    // Monitoring
    getRecentAccessLogs,
    getGateStats,
};
