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
            v.vehicle_color,
            v.registered_at,
            v.is_active,
            vt.type_name AS vehicle_type,
            u.full_name AS owner_name,
            u.email AS owner_email,
            c.phone_number AS owner_phone,
            h.house_number,
            h.block_number,
            z.zone_name
        FROM vehicles v
        JOIN citizens c ON v.owner_id = c.user_id
        JOIN users u ON c.user_id = u.user_id
        JOIN houses h ON c.house_id = h.house_id
        JOIN zones z ON h.zone_id = z.zone_id
        LEFT JOIN vehicle_types vt ON v.type_id = vt.type_id
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
        JOIN citizens c ON v.owner_id = c.user_id
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
            v.*,
            vt.type_name AS vehicle_type,
            u.full_name AS owner_name,
            c.phone_number AS owner_phone,
            h.house_number, h.block_number,
            z.zone_id, z.zone_name
        FROM vehicles v
        JOIN citizens c ON v.owner_id = c.user_id
        JOIN users u ON c.user_id = u.user_id
        JOIN houses h ON c.house_id = h.house_id
        JOIN zones z ON h.zone_id = z.zone_id
        LEFT JOIN vehicle_types vt ON v.type_id = vt.type_id
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
        JOIN gates g ON al.gate_id = g.gate_id
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
        JOIN gates g ON al.gate_id = g.gate_id
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
            COALESCE(vt.type_name::text, 'unknown') AS vehicle_type,
            COUNT(*) AS count
        FROM access_logs al
        JOIN gates g ON al.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        LEFT JOIN vehicle_types vt ON v.type_id = vt.type_id
        WHERE g.zone_id = $1
          AND al.check_in_time >= NOW() - INTERVAL '30 days'
        GROUP BY vt.type_name
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
        JOIN gates g ON al.gate_id = g.gate_id
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
            (SELECT COUNT(*) FROM access_logs al JOIN gates g ON al.gate_id = g.gate_id 
             WHERE g.zone_id = $1 AND al.check_in_time >= CURRENT_DATE) AS today_total,
            (SELECT COUNT(*) FROM access_logs al JOIN gates g ON al.gate_id = g.gate_id 
             WHERE g.zone_id = $1 AND al.check_in_time >= CURRENT_DATE AND al.is_access_granted = true) AS today_granted,
            (SELECT COUNT(*) FROM access_logs al JOIN gates g ON al.gate_id = g.gate_id 
             WHERE g.zone_id = $1 AND al.check_in_time >= NOW() - INTERVAL '7 days') AS week_total,
            (SELECT COUNT(*) FROM vehicles v JOIN citizens c ON v.owner_id = c.user_id 
             JOIN houses h ON c.house_id = h.house_id 
             WHERE h.zone_id = $1 AND v.is_active = true) AS active_vehicles,
            (SELECT COUNT(*) FROM vehicles v JOIN citizens c ON v.owner_id = c.user_id 
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
        startDate, 
        endDate, 
        accessMethod, 
        isGranted,
        licensePlate,
        gateId,
        limit = 50, 
        offset = 0 
    } = filters;
    
    let query = `
        SELECT 
            al.log_id,
            al.check_in_time,
            al.access_method,
            al.is_access_granted,
            al.note,
            g.gate_name,
            g.direction,
            v.license_plate,
            u_guard.full_name AS guard_name,
            ap.detected_plate_text,
            ap.confidence_score,
            ap.is_correct AS ai_is_correct,
            ap.corrected_plate_text
        FROM access_logs al
        JOIN gates g ON al.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        LEFT JOIN users u_guard ON al.guard_id = u_guard.user_id
        LEFT JOIN ai_predictions ap ON al.log_id = ap.log_id
        WHERE g.zone_id = $1
    `;
    
    const params = [managedZoneId];
    let paramIndex = 2;
    
    if (startDate) {
        query += ` AND al.check_in_time >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }
    if (endDate) {
        query += ` AND al.check_in_time <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }
    if (accessMethod) {
        query += ` AND al.access_method = $${paramIndex}`;
        params.push(accessMethod);
        paramIndex++;
    }
    if (isGranted !== undefined) {
        query += ` AND al.is_access_granted = $${paramIndex}`;
        params.push(isGranted);
        paramIndex++;
    }
    if (licensePlate) {
        query += ` AND (v.license_plate ILIKE $${paramIndex} OR ap.detected_plate_text ILIKE $${paramIndex})`;
        params.push(`%${licensePlate}%`);
        paramIndex++;
    }
    if (gateId) {
        query += ` AND al.gate_id = $${paramIndex}`;
        params.push(gateId);
        paramIndex++;
    }
    
    query += ` ORDER BY al.check_in_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
        JOIN gates g ON al.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        LEFT JOIN ai_predictions ap ON al.log_id = ap.log_id
        WHERE g.zone_id = $1
    `;
    
    const params = [managedZoneId];
    let paramIndex = 2;
    
    if (startDate) {
        query += ` AND al.check_in_time >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }
    if (endDate) {
        query += ` AND al.check_in_time <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }
    if (accessMethod) {
        query += ` AND al.access_method = $${paramIndex}`;
        params.push(accessMethod);
        paramIndex++;
    }
    if (isGranted !== undefined) {
        query += ` AND al.is_access_granted = $${paramIndex}`;
        params.push(isGranted);
        paramIndex++;
    }
    if (licensePlate) {
        query += ` AND (v.license_plate ILIKE $${paramIndex} OR ap.detected_plate_text ILIKE $${paramIndex})`;
        params.push(`%${licensePlate}%`);
        paramIndex++;
    }
    if (gateId) {
        query += ` AND al.gate_id = $${paramIndex}`;
        params.push(gateId);
        paramIndex++;
    }
    
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
            al.note,
            ENCODE(al.image_snapshot_data, 'base64') AS image_snapshot_base64,
            g.gate_id, g.gate_name, g.direction,
            v.vehicle_id, v.license_plate, v.vehicle_color,
            vt.type_name AS vehicle_type,
            u_owner.full_name AS vehicle_owner_name,
            u_guard.full_name AS guard_name,
            gr.guest_name, gr.purpose AS guest_purpose,
            ap.prediction_id,
            ap.detected_plate_text,
            ap.confidence_score,
            ap.processing_time_ms,
            ap.is_correct AS ai_is_correct,
            ap.corrected_plate_text,
            ap.bounding_box_json,
            ENCODE(ap.cropped_plate_image_data, 'base64') AS cropped_plate_base64,
            am.model_name AS ai_model_name,
            am.version AS ai_model_version
        FROM access_logs al
        JOIN gates g ON al.gate_id = g.gate_id
        LEFT JOIN vehicles v ON al.vehicle_id = v.vehicle_id
        LEFT JOIN vehicle_types vt ON v.type_id = vt.type_id
        LEFT JOIN citizens c ON v.owner_id = c.user_id
        LEFT JOIN users u_owner ON c.user_id = u_owner.user_id
        LEFT JOIN users u_guard ON al.guard_id = u_guard.user_id
        LEFT JOIN guest_registrations gr ON al.guest_registration_id = gr.registration_id
        LEFT JOIN ai_predictions ap ON al.log_id = ap.log_id
        LEFT JOIN ai_models am ON ap.model_id = am.model_id
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
            u.full_name AS actor_name
        FROM system_audit_logs sal
        JOIN managers m ON sal.actor_id = m.user_id
        JOIN users u ON m.user_id = u.user_id
        WHERE m.managed_zone_id = $1
        ORDER BY sal.performed_at DESC
        LIMIT $2 OFFSET $3
    `, [managedZoneId, limit, offset]);
    
    return result.rows;
};

// ============================================================
// FR_MAN_04 - ĐÁNH GIÁ HIỆU NĂNG AI
// ============================================================

/**
 * Thống kê hiệu năng AI
 */
const getAIPerformanceStats = async (managedZoneId) => {
    const result = await db.query(`
        SELECT 
            COUNT(*) AS total_predictions,
            AVG(ap.confidence_score) AS avg_confidence,
            AVG(ap.processing_time_ms) AS avg_processing_time_ms,
            SUM(CASE WHEN ap.is_correct = true THEN 1 ELSE 0 END) AS correct_count,
            SUM(CASE WHEN ap.is_correct = false THEN 1 ELSE 0 END) AS incorrect_count,
            SUM(CASE WHEN ap.is_correct IS NULL THEN 1 ELSE 0 END) AS unverified_count,
            SUM(CASE WHEN ap.corrected_plate_text IS NOT NULL THEN 1 ELSE 0 END) AS manual_corrections
        FROM ai_predictions ap
        JOIN access_logs al ON ap.log_id = al.log_id
        JOIN gates g ON al.gate_id = g.gate_id
        WHERE g.zone_id = $1
          AND al.check_in_time >= NOW() - INTERVAL '30 days'
    `, [managedZoneId]);
    
    const stats = result.rows[0];
    const total = parseInt(stats.total_predictions, 10) || 1;
    const correct = parseInt(stats.correct_count, 10) || 0;
    
    return {
        total_predictions: total,
        avg_confidence: parseFloat(stats.avg_confidence) || 0,
        avg_processing_time_ms: parseFloat(stats.avg_processing_time_ms) || 0,
        correct_count: correct,
        incorrect_count: parseInt(stats.incorrect_count, 10) || 0,
        unverified_count: parseInt(stats.unverified_count, 10) || 0,
        manual_corrections: parseInt(stats.manual_corrections, 10) || 0,
        accuracy_rate: total > 0 ? (correct / (correct + parseInt(stats.incorrect_count, 10) || 1)) : 0,
    };
};

/**
 * Thống kê theo confidence score buckets
 */
const getConfidenceDistribution = async (managedZoneId) => {
    const result = await db.query(`
        SELECT 
            CASE 
                WHEN confidence_score >= 0.95 THEN '95-100%'
                WHEN confidence_score >= 0.90 THEN '90-95%'
                WHEN confidence_score >= 0.80 THEN '80-90%'
                WHEN confidence_score >= 0.70 THEN '70-80%'
                ELSE 'Below 70%'
            END AS confidence_bucket,
            COUNT(*) AS count
        FROM ai_predictions ap
        JOIN access_logs al ON ap.log_id = al.log_id
        JOIN gates g ON al.gate_id = g.gate_id
        WHERE g.zone_id = $1
          AND al.check_in_time >= NOW() - INTERVAL '30 days'
        GROUP BY confidence_bucket
        ORDER BY confidence_bucket DESC
    `, [managedZoneId]);
    
    return result.rows;
};

/**
 * Lấy danh sách AI models
 */
const getAIModels = async () => {
    const result = await db.query(`
        SELECT 
            model_id,
            model_name,
            version,
            accuracy_rate,
            is_active,
            created_at
        FROM ai_models
        ORDER BY created_at DESC
    `);
    
    return result.rows;
};

/**
 * Cập nhật trạng thái AI model
 */
const updateAIModelStatus = async (modelId, isActive) => {
    // Nếu activate model mới, deactivate các model khác
    if (isActive) {
        await db.query(`UPDATE ai_models SET is_active = false WHERE is_active = true`);
    }
    
    const result = await db.query(`
        UPDATE ai_models
        SET is_active = $2
        WHERE model_id = $1
        RETURNING *
    `, [modelId, isActive]);
    
    return result.rows[0];
};

/**
 * Lấy danh sách các lần AI bị sửa (để retrain)
 */
const getAICorrections = async (managedZoneId, { limit = 100, offset = 0 } = {}) => {
    const result = await db.query(`
        SELECT 
            ap.prediction_id,
            ap.detected_plate_text,
            ap.corrected_plate_text,
            ap.confidence_score,
            ENCODE(ap.cropped_plate_image_data, 'base64') AS cropped_plate_base64,
            al.check_in_time,
            u.full_name AS corrected_by_guard
        FROM ai_predictions ap
        JOIN access_logs al ON ap.log_id = al.log_id
        JOIN gates g ON al.gate_id = g.gate_id
        LEFT JOIN users u ON al.guard_id = u.user_id
        WHERE ap.corrected_plate_text IS NOT NULL
          AND g.zone_id = $1
        ORDER BY al.check_in_time DESC
        LIMIT $2 OFFSET $3
    `, [managedZoneId, limit, offset]);
    
    return result.rows;
};

// ============================================================
// HELPER: GET MANAGER INFO
// ============================================================

/**
 * Lấy thông tin zone mà manager quản lý
 */
const getManagerZone = async (userId) => {
    const result = await db.query(`
        SELECT m.managed_zone_id, z.zone_name, m.department_name
        FROM managers m
        LEFT JOIN zones z ON m.managed_zone_id = z.zone_id
        WHERE m.user_id = $1
    `, [userId]);
    
    return result.rows[0] || null;
};

/**
 * Lấy danh sách gates trong zone
 */
const getGatesInZone = async (managedZoneId) => {
    const result = await db.query(`
        SELECT gate_id, gate_name, direction, is_active
        FROM gates
        WHERE zone_id = $1
        ORDER BY gate_name
    `, [managedZoneId]);
    
    return result.rows;
};

module.exports = {
    // FR_MAN_01 - Vehicle Approval
    getPendingVehicles,
    countPendingVehicles,
    getVehicleById,
    approveVehicle,
    rejectVehicle,
    logAuditAction,
    
    // FR_MAN_02 - Analytics
    getTrafficByDay,
    getTrafficByHour,
    getVehicleTypeDistribution,
    getAccessMethodDistribution,
    getQuickStats,
    
    // FR_MAN_03 - Access Logs
    searchAccessLogs,
    countAccessLogs,
    getLogWithImages,
    getAuditLogs,
    
    // FR_MAN_04 - AI Performance
    getAIPerformanceStats,
    getConfidenceDistribution,
    getAIModels,
    updateAIModelStatus,
    getAICorrections,
    
    // Helpers
    getManagerZone,
    getGatesInZone,
};
