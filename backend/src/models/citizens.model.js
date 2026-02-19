const db = require('../libs/db');
const crypto = require('crypto');

/**
 * Sinh mã OTP 6 số ngẫu nhiên
 * Đảm bảo không trùng với OTP đang active (chưa dùng + chưa hết hạn)
 */
const generateUniqueOTP = async () => {
    let otp;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
        // Sinh 6 số random
        otp = crypto.randomInt(100000, 999999).toString();
        
        // Kiểm tra OTP này có đang active không
        const checkQuery = `
            SELECT 1 FROM access_tokens 
            WHERE otp_code = $1 
              AND is_used = false 
              AND valid_until > NOW()
            LIMIT 1
        `;
        const result = await db.query(checkQuery, [otp]);
        
        if (result.rows.length === 0) {
            isUnique = true;
        }
        attempts++;
    }
    
    if (!isUnique) {
        throw new Error('Không thể sinh mã OTP unique sau nhiều lần thử');
    }
    
    return otp;
};

/**
 * Tạo OTP mới cho citizen
 * @param {number} citizenId - user_id của citizen
 * @param {number} validMinutes - Thời gian hiệu lực (phút), mặc định 15
 */
const createOTP = async (citizenId, validMinutes = 15) => {
    const otpCode = await generateUniqueOTP();
    
    const query = `
        INSERT INTO access_tokens (issued_by, otp_code, valid_from, valid_until, is_used)
        VALUES ($1, $2, NOW(), NOW() + INTERVAL '${validMinutes} minutes', false)
        RETURNING token_id, otp_code, valid_from, valid_until
    `;
    
    const result = await db.query(query, [citizenId, otpCode]);
    return result.rows[0];
};

/**
 * Lấy danh sách OTP đã tạo của citizen
 * @param {number} citizenId
 */
const getOTPsByCitizen = async (citizenId) => {
    const query = `
        SELECT 
            token_id,
            otp_code,
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
        LIMIT 20
    `;
    
    const result = await db.query(query, [citizenId]);
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
    const query = `
        SELECT 
            v.vehicle_id,
            v.license_plate,
            v.vehicle_color,
            v.vehicle_image_url,
            v.is_active,
            v.registered_at,
            vt.type_name,
            vt.description as type_description
        FROM vehicles v
        JOIN vehicle_types vt ON v.type_id = vt.type_id
        WHERE v.owner_id = $1
        ORDER BY v.registered_at DESC
    `;
    
    const result = await db.query(query, [citizenId]);
    return result.rows;
};

/**
 * Kiểm tra biển số đã tồn tại chưa
 * @param {string} licensePlate
 */
const checkLicensePlateExists = async (licensePlate) => {
    const query = `
        SELECT vehicle_id, owner_id 
        FROM vehicles 
        WHERE UPPER(REPLACE(license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
    `;
    const result = await db.query(query, [licensePlate]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy danh sách vehicle types
 */
const getVehicleTypes = async () => {
    const query = `SELECT type_id, type_name, description FROM vehicle_types ORDER BY type_id`;
    const result = await db.query(query);
    return result.rows;
};

/**
 * Đăng ký xe mới
 * @param {Object} params
 */
const registerVehicle = async ({ ownerId, typeId, licensePlate, vehicleColor, vehicleImageUrl }) => {
    const query = `
        INSERT INTO vehicles (owner_id, type_id, license_plate, vehicle_color, vehicle_image_url, is_active)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING vehicle_id, license_plate, vehicle_color, is_active, registered_at
    `;
    
    const result = await db.query(query, [ownerId, typeId, licensePlate, vehicleColor, vehicleImageUrl]);
    return result.rows[0];
};

/**
 * Cập nhật trạng thái xe
 * @param {number} vehicleId
 * @param {number} ownerId
 * @param {boolean} isActive
 */
const updateVehicleStatus = async (vehicleId, ownerId, isActive) => {
    const query = `
        UPDATE vehicles 
        SET is_active = $3
        WHERE vehicle_id = $1 AND owner_id = $2
        RETURNING vehicle_id, is_active
    `;
    
    const result = await db.query(query, [vehicleId, ownerId, isActive]);
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
    const query = `
        SELECT 
            gr.registration_id,
            gr.guest_name,
            gr.guest_license_plate,
            gr.visit_start_time,
            gr.visit_end_time,
            gr.status,
            gr.purpose,
            vt.type_name as vehicle_type,
            CASE 
                WHEN gr.status = 'pending' THEN 'pending'
                WHEN gr.status = 'rejected' THEN 'rejected'
                WHEN gr.visit_end_time < NOW() THEN 'expired'
                WHEN gr.visit_start_time > NOW() THEN 'upcoming'
                ELSE 'active'
            END as current_status
        FROM guest_registrations gr
        LEFT JOIN vehicle_types vt ON gr.vehicle_type_id = vt.type_id
        WHERE gr.host_id = $1
        ORDER BY gr.visit_start_time DESC
        LIMIT 50
    `;
    
    const result = await db.query(query, [hostId]);
    return result.rows;
};

/**
 * Đăng ký khách có hẹn trước
 * @param {Object} params
 */
const registerGuest = async ({ 
    hostId, 
    guestName, 
    guestLicensePlate, 
    vehicleTypeId, 
    visitStartTime, 
    visitEndTime,
    purpose 
}) => {
    const query = `
        INSERT INTO guest_registrations (
            host_id, 
            guest_name, 
            guest_license_plate, 
            vehicle_type_id,
            visit_start_time, 
            visit_end_time,
            status,
            purpose
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)
        RETURNING registration_id, guest_name, guest_license_plate, visit_start_time, visit_end_time, status
    `;
    
    const result = await db.query(query, [
        hostId, 
        guestName, 
        guestLicensePlate, 
        vehicleTypeId,
        visitStartTime, 
        visitEndTime,
        purpose
    ]);
    return result.rows[0];
};

/**
 * Hủy đăng ký khách
 * @param {number} registrationId
 * @param {number} hostId
 */
const cancelGuestRegistration = async (registrationId, hostId) => {
    const query = `
        UPDATE guest_registrations 
        SET status = 'cancelled'
        WHERE registration_id = $1 AND host_id = $2
        RETURNING registration_id, status
    `;
    
    const result = await db.query(query, [registrationId, hostId]);
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
        SELECT registration_id, host_id, visit_start_time, visit_end_time
        FROM guest_registrations
        WHERE UPPER(REPLACE(guest_license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
          AND status IN ('approved', 'pending')
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

module.exports = {
    generateUniqueOTP,
    createOTP,
    getOTPsByCitizen,
    checkCitizenExists,
    // Vehicles
    getVehiclesByCitizen,
    checkLicensePlateExists,
    getVehicleTypes,
    registerVehicle,
    updateVehicleStatus,
    // Guest Registrations
    getGuestRegistrations,
    registerGuest,
    cancelGuestRegistration,
    checkGuestPlateConflict,
};
