/**
 * managers.model.js
 * Model cho phân hệ Quản lý (Manager Dashboard)
 */

const db = require('../libs/db');

// ============================================================
// FR_MAN_01 - QUẢN LÝ PHÊ DUYỆT PHƯƠNG TIỆN
// ============================================================

/**
 * Lấy danh sách xe chờ duyệt trong zone của manager
 */
const getPendingVehicles = async (managedZoneId, { limit = 20, offset = 0 } = {}) => {
    const result = await db.query(`
        SELECT
            v.vehicle_id,
            v.license_plate,
            v.vehicle_type,
            v.vehicle_color,
            v.registered_at,
            v.is_active,
            u.full_name AS owner_name,
            u.email AS owner_email,
            c.phone_number AS owner_phone,
            h.house_number,
            h.block_number,
            z.zone_name
        FROM vehicles v
        JOIN users u ON v.owner_user_id = u.user_id
        JOIN citizens c ON v.owner_user_id = c.user_id
        JOIN houses h ON c.house_id = h.house_id
        JOIN zones z ON h.zone_id = z.zone_id
        WHERE v.is_active = false
          AND z.zone_id = $1
        ORDER BY v.registered_at DESC
        LIMIT $2 OFFSET $3
    `, [managedZoneId, limit, offset]);

    return result.rows;
};

/**
 * Đếm số xe chờ duyệt
 */
const countPendingVehicles = async (managedZoneId) => {
    const result = await db.query(`
        SELECT COUNT(*) AS total
        FROM vehicles v
        JOIN users u ON v.owner_user_id = u.user_id
        JOIN citizens c ON v.owner_user_id = c.user_id
        JOIN houses h ON c.house_id = h.house_id
        WHERE v.is_active = false AND h.zone_id = $1
    `, [managedZoneId]);

    return parseInt(result.rows[0].total, 10);
};

/**
 * Lấy thông tin xe (kiểm tra quyền zone)
 */
const getVehicleById = async (vehicleId, managedZoneId) => {
    const result = await db.query(`
        SELECT
            v.vehicle_id, v.license_plate, v.vehicle_type, v.vehicle_color,
            v.is_active, v.registered_at, v.owner_user_id,
            u.full_name AS owner_name,
            c.phone_number AS owner_phone,
            h.house_number, h.block_number,
            z.zone_id, z.zone_name
        FROM vehicles v
        JOIN users u ON v.owner_user_id = u.user_id
        JOIN citizens c ON v.owner_user_id = c.user_id
        JOIN houses h ON c.house_id = h.house_id
        JOIN zones z ON h.zone_id = z.zone_id
        WHERE v.vehicle_id = $1 AND z.zone_id = $2
    `, [vehicleId, managedZoneId]);

    return result.rows[0] || null;
};

/**
 * Phê duyệt xe (set is_active = true)
 */
const approveVehicle = async (vehicleId) => {
    const result = await db.query(`
        UPDATE vehicles
        SET is_active = true
        WHERE vehicle_id = $1
        RETURNING vehicle_id, license_plate, is_active
    `, [vehicleId]);
    
    return result.rows[0];
};

/**
 * Từ chối xe (xóa khỏi hệ thống)
 */
const rejectVehicle = async (vehicleId) => {
    const result = await db.query(`
        DELETE FROM vehicles
        WHERE vehicle_id = $1
        RETURNING vehicle_id, license_plate
    `, [vehicleId]);
    
    return result.rows[0];
};

/**
 * Ghi audit log cho action của manager
 */
const logAuditAction = async ({ actorId, actionType, targetTable, targetId, actionDetails }) => {
    const result = await db.query(`
        INSERT INTO system_audit_logs (actor_id, action_type, target_table, target_id, action_details)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING audit_id, performed_at
    `, [actorId, actionType, targetTable, targetId, actionDetails]);
    
    return result.rows[0];
};

// ============================================================
// FR_MAN_02 - THỐNG KÊ LƯU LƯỢNG (ANALYTICS)
// ============================================================

/**
 * Thống kê lưu lượng theo ngày (7 ngày gần nhất)
 */
const getTrafficByDay = async (managedZoneId, days = 7) => {
    const result = await db.query(`
        SELECT
            DATE(al.check_in_time) AS date,
            COUNT(*) AS total_entries,
            SUM(CASE WHEN al.is_access_granted = true THEN 1 ELSE 0 END) AS granted,
            SUM(CASE WHEN al.is_access_granted = false THEN 1 ELSE 0 END) AS denied
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        WHERE g.zone_id = $1
          AND al.check_in_time >= CURRENT_DATE - INTERVAL '1 day' * $2
        GROUP BY DATE(al.check_in_time)
        ORDER BY date DESC
    `, [managedZoneId, days]);

    return result.rows;
};

/**
 * Thống kê theo giờ trong ngày (24 giờ gần nhất)
 */
const getTrafficByHour = async (managedZoneId) => {
    const result = await db.query(`
        SELECT
            EXTRACT(HOUR FROM al.check_in_time)::int AS hour,
            COUNT(*) AS total_entries
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        WHERE g.zone_id = $1
          AND al.check_in_time >= NOW() - INTERVAL '24 hours'
        GROUP BY EXTRACT(HOUR FROM al.check_in_time)
        ORDER BY hour
    `, [managedZoneId]);

    return result.rows;
};

/**
 * Phân bố loại xe
 */
const getVehicleTypeDistribution = async (managedZoneId) => {
    const result = await db.query(`
        SELECT
            COALESCE(v.vehicle_type::text, 'unknown') AS vehicle_type,
            COUNT(*) AS count
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        WHERE g.zone_id = $1
          AND al.check_in_time >= NOW() - INTERVAL '30 days'
        GROUP BY v.vehicle_type
        ORDER BY count DESC
    `, [managedZoneId]);

    return result.rows;
};

/**
 * Phân bố phương thức truy cập
 */
const getAccessMethodDistribution = async (managedZoneId) => {
    const result = await db.query(`
        SELECT
            al.access_method::text,
            COUNT(*) AS count
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        WHERE g.zone_id = $1
          AND al.check_in_time >= NOW() - INTERVAL '30 days'
        GROUP BY al.access_method
        ORDER BY count DESC
    `, [managedZoneId]);

    return result.rows;
};

/**
 * Tổng quan thống kê nhanh
 */
const getQuickStats = async (managedZoneId) => {
    const result = await db.query(`
        SELECT
            (SELECT COUNT(*) FROM access_logs al
             JOIN lanes l ON al.lane_id = l.lane_id
             JOIN gates g ON l.gate_id = g.gate_id
             WHERE g.zone_id = $1 AND al.check_in_time >= CURRENT_DATE) AS today_total,
            (SELECT COUNT(*) FROM access_logs al
             JOIN lanes l ON al.lane_id = l.lane_id
             JOIN gates g ON l.gate_id = g.gate_id
             WHERE g.zone_id = $1 AND al.check_in_time >= CURRENT_DATE AND al.is_access_granted = true) AS today_granted,
            (SELECT COUNT(*) FROM access_logs al
             JOIN lanes l ON al.lane_id = l.lane_id
             JOIN gates g ON l.gate_id = g.gate_id
             WHERE g.zone_id = $1 AND al.check_in_time >= NOW() - INTERVAL '7 days') AS week_total,
            (SELECT COUNT(*) FROM vehicles v
             JOIN users u ON v.owner_user_id = u.user_id
             JOIN citizens c ON v.owner_user_id = c.user_id
             JOIN houses h ON c.house_id = h.house_id
             WHERE h.zone_id = $1 AND v.is_active = true) AS active_vehicles,
            (SELECT COUNT(*) FROM vehicles v
             JOIN users u ON v.owner_user_id = u.user_id
             JOIN citizens c ON v.owner_user_id = c.user_id
             JOIN houses h ON c.house_id = h.house_id
             WHERE h.zone_id = $1 AND v.is_active = false) AS pending_approvals
    `, [managedZoneId]);

    return result.rows[0];
};

// ============================================================
// FR_MAN_03 - TRA CỨU NHẬT KÝ (ACCESS LOGS)
// ============================================================

/**
 * Tìm kiếm và lọc access logs
 */
const searchAccessLogs = async (managedZoneId, filters = {}) => {
    const {
        startDate, endDate, accessMethod, isGranted,
        licensePlate, gateId, limit = 50, offset = 0
    } = filters;

    let query = `
        SELECT
            al.log_id,
            al.check_in_time,
            al.access_method,
            al.is_access_granted,
            al.detected_text,
            al.action_reason,
            al.note,
            l.lane_name,
            l.direction,
            g.gate_name,
            v.license_plate,
            u_guard.full_name AS guard_name
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        LEFT JOIN users u_guard ON al.guard_id = u_guard.user_id
        WHERE g.zone_id = $1
    `;

    const params = [managedZoneId];
    let p = 2;

    if (startDate) { query += ` AND al.check_in_time >= $${p}`; params.push(startDate); p++; }
    if (endDate)   { query += ` AND al.check_in_time <= $${p}`; params.push(endDate);   p++; }
    if (accessMethod) { query += ` AND al.access_method = $${p}`; params.push(accessMethod); p++; }
    if (isGranted !== undefined) { query += ` AND al.is_access_granted = $${p}`; params.push(isGranted); p++; }
    if (licensePlate) {
        query += ` AND (v.license_plate ILIKE $${p} OR al.detected_text ILIKE $${p})`;
        params.push(`%${licensePlate}%`); p++;
    }
    if (gateId) { query += ` AND g.gate_id = $${p}`; params.push(gateId); p++; }

    query += ` ORDER BY al.check_in_time DESC LIMIT $${p} OFFSET $${p + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
};

/**
 * Đếm tổng số logs theo điều kiện filter
 */
const countAccessLogs = async (managedZoneId, filters = {}) => {
    const { startDate, endDate, accessMethod, isGranted, licensePlate, gateId } = filters;

    let query = `
        SELECT COUNT(*) AS total
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        WHERE g.zone_id = $1
    `;

    const params = [managedZoneId];
    let p = 2;

    if (startDate) { query += ` AND al.check_in_time >= $${p}`; params.push(startDate); p++; }
    if (endDate)   { query += ` AND al.check_in_time <= $${p}`; params.push(endDate);   p++; }
    if (accessMethod) { query += ` AND al.access_method = $${p}`; params.push(accessMethod); p++; }
    if (isGranted !== undefined) { query += ` AND al.is_access_granted = $${p}`; params.push(isGranted); p++; }
    if (licensePlate) {
        query += ` AND (v.license_plate ILIKE $${p} OR al.detected_text ILIKE $${p})`;
        params.push(`%${licensePlate}%`); p++;
    }
    if (gateId) { query += ` AND g.gate_id = $${p}`; params.push(gateId); p++; }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].total, 10);
};

/**
 * Lấy chi tiết log kèm ảnh (base64)
 */
const getLogWithImages = async (logId, managedZoneId) => {
    const result = await db.query(`
        SELECT
            al.log_id,
            al.check_in_time,
            al.access_method,
            al.is_access_granted,
            al.detected_text,
            al.action_reason,
            al.note,
            ENCODE(al.image_snapshot_data, 'base64') AS image_snapshot,
            l.lane_id, l.lane_name, l.direction,
            g.gate_id, g.gate_name,
            v.vehicle_id, v.license_plate, v.vehicle_type, v.vehicle_color,
            u_owner.full_name AS vehicle_owner_name,
            u_guard.full_name AS guard_name,
            gr.guest_name
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        LEFT JOIN users u_owner ON v.owner_user_id = u_owner.user_id
        LEFT JOIN users u_guard ON al.guard_id = u_guard.user_id
        LEFT JOIN guest_registrations gr ON al.guest_reg_id = gr.registration_id
        WHERE al.log_id = $1 AND g.zone_id = $2
    `, [logId, managedZoneId]);

    return result.rows[0] || null;
};

/**
 * Lấy audit logs (thao tác của Manager)
 */
const getAuditLogs = async (managedZoneId, { limit = 50, offset = 0 } = {}) => {
    const result = await db.query(`
        SELECT
            sal.audit_id,
            sal.action_type,
            sal.target_table,
            sal.target_id,
            sal.action_details,
            sal.performed_at,
            u.full_name AS actor_name,
            u.role AS actor_role
        FROM system_audit_logs sal
        LEFT JOIN users u ON sal.actor_id = u.user_id
        ORDER BY sal.performed_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return result.rows;
};

// ============================================================
// FR_MAN_04 - ĐÁNH GIÁ HIỆU NĂNG AI (tính từ access_logs)
// ============================================================

/**
 * Thống kê hiệu năng AI trong 30 ngày (tính từ access_logs, không cần ai_models)
 */
const getAIPerformanceStats = async (managedZoneId) => {
    const result = await db.query(`
        SELECT
            COUNT(*) AS total_ai_events,
            COUNT(*) FILTER (WHERE is_access_granted = true) AS successful_recognitions,
            COUNT(*) FILTER (WHERE note IS NOT NULL) AS corrections_submitted,
            ROUND(
                100.0 * COUNT(*) FILTER (WHERE is_access_granted = true) / NULLIF(COUNT(*), 0),
                1
            ) AS accuracy_rate_percent
        FROM access_logs al
        JOIN lanes l ON al.lane_id = l.lane_id
        JOIN gates g ON l.gate_id = g.gate_id
        WHERE g.zone_id = $1
          AND al.access_method IN ('ai_plate_recognition', 'ai_camera_otp', 'ai_camera_qr')
          AND al.check_in_time >= NOW() - INTERVAL '30 days'
    `, [managedZoneId]);

    const row = result.rows[0];
    return {
        total_ai_events: parseInt(row.total_ai_events, 10) || 0,
        successful_recognitions: parseInt(row.successful_recognitions, 10) || 0,
        accuracy_rate_percent: parseFloat(row.accuracy_rate_percent) || 0,
        corrections_submitted: parseInt(row.corrections_submitted, 10) || 0,
    };
};

// ============================================================
// FR_MAN_05 - THAO TÁC THỦ CÔNG (UC-07 Override)
// ============================================================

/**
 * Manager mở/đóng cổng khẩn cấp, ghi log thủ công
 */
const createManagerManualAction = async ({ gateId, managerId, action, actionReason, note }) => {
    const laneResult = await db.query(
        `SELECT lane_id FROM lanes WHERE gate_id = $1 LIMIT 1`,
        [gateId]
    );
    const laneId = laneResult.rows[0]?.lane_id || null;
    const isAccessGranted = action === 'OPEN';

    const result = await db.query(`
        INSERT INTO access_logs (
            lane_id, guard_id, access_method, is_access_granted, action_reason, note
        )
        VALUES ($1, $2, 'manual_guard', $3, $4, $5)
        RETURNING log_id, check_in_time
    `, [laneId, managerId, isAccessGranted, actionReason || null, note || null]);

    return result.rows[0];
};

// ============================================================
// FR_MAN_06 - ĐĂNG KÝ KHÁCH THAY CƯ DÂN (UC-02 Override)
// ============================================================

/**
 * Manager đăng ký khách cho bất kỳ cư dân nào trong zone
 */
const createGuestRegistration = async ({ hostCitizenId, guestName, guestLicensePlate, vehicleType, visitStartTime, visitEndTime }) => {
    const result = await db.query(`
        INSERT INTO guest_registrations (
            host_user_id, guest_name, guest_license_plate, vehicle_type,
            visit_start_time, visit_end_time, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'approved')
        RETURNING registration_id, guest_name, guest_license_plate, visit_start_time, visit_end_time, status
    `, [hostCitizenId, guestName, guestLicensePlate, vehicleType || 'car', visitStartTime, visitEndTime]);

    return result.rows[0];
};

/**
 * Kiểm tra citizen thuộc zone quản lý
 */
const checkCitizenInZone = async (citizenId, managedZoneId) => {
    const result = await db.query(`
        SELECT c.user_id
        FROM citizens c
        JOIN houses h ON c.house_id = h.house_id
        WHERE c.user_id = $1 AND h.zone_id = $2
    `, [citizenId, managedZoneId]);
    return result.rows.length > 0;
};

// ============================================================
// HELPERS
// ============================================================

const getManagerZone = async (userId) => {
    const result = await db.query(`
        SELECT m.managed_zone_id, z.zone_name, m.department_name
        FROM managers m
        LEFT JOIN zones z ON m.managed_zone_id = z.zone_id
        WHERE m.user_id = $1
    `, [userId]);
    return result.rows[0] || null;
};

const getGatesInZone = async (managedZoneId) => {
    const result = await db.query(`
        SELECT
            g.gate_id, g.gate_name, g.is_active,
            JSON_AGG(
                JSON_BUILD_OBJECT('lane_id', l.lane_id, 'lane_name', l.lane_name, 'direction', l.direction)
                ORDER BY l.lane_id
            ) FILTER (WHERE l.lane_id IS NOT NULL) AS lanes
        FROM gates g
        LEFT JOIN lanes l ON g.gate_id = l.gate_id
        WHERE g.zone_id = $1
        GROUP BY g.gate_id, g.gate_name, g.is_active
        ORDER BY g.gate_name
    `, [managedZoneId]);
    return result.rows;
};

module.exports = {
    // FR_MAN_01
    getPendingVehicles,
    countPendingVehicles,
    getVehicleById,
    approveVehicle,
    rejectVehicle,
    logAuditAction,

    // FR_MAN_02
    getTrafficByDay,
    getTrafficByHour,
    getVehicleTypeDistribution,
    getAccessMethodDistribution,
    getQuickStats,

    // FR_MAN_03
    searchAccessLogs,
    countAccessLogs,
    getLogWithImages,
    getAuditLogs,

    // FR_MAN_04
    getAIPerformanceStats,

    // FR_MAN_05
    createManagerManualAction,

    // FR_MAN_06
    createGuestRegistration,
    checkCitizenInZone,

    // Helpers
    getManagerZone,
    getGatesInZone,
};
