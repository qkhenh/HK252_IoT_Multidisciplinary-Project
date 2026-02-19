const db = require('../libs/db');

/**
 * Chuyển đổi Base64 string thành Buffer để lưu BYTEA
 * @param {string} base64String 
 * @returns {Buffer|null}
 */
const base64ToBuffer = (base64String) => {
    if (!base64String) return null;
    
    // Xử lý cả trường hợp có prefix "data:image/..." và không có
    const base64Data = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;
    
    return Buffer.from(base64Data, 'base64');
};

/**
 * Kiểm tra biển số trong whitelist cư dân (vehicles)
 * @param {string} plateText 
 * @returns {Object|null} Vehicle info nếu tìm thấy
 */
const checkResidentWhitelist = async (plateText) => {
    const query = `
        SELECT 
            v.vehicle_id,
            v.owner_id,
            v.license_plate,
            v.type_id,
            v.is_active,
            u.full_name as owner_name,
            c.phone_number as owner_phone,
            h.house_number,
            h.block_number,
            z.zone_name
        FROM vehicles v
        JOIN citizens c ON v.owner_id = c.user_id
        JOIN users u ON c.user_id = u.user_id
        LEFT JOIN houses h ON c.house_id = h.house_id
        LEFT JOIN zones z ON h.zone_id = z.zone_id
        WHERE UPPER(REPLACE(v.license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
          AND v.is_active = true
        LIMIT 1
    `;
    
    const result = await db.query(query, [plateText]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Kiểm tra biển số trong whitelist khách có hẹn (guest_registrations)
 * @param {string} plateText 
 * @returns {Object|null} Guest registration info nếu tìm thấy và còn hiệu lực
 */
const checkGuestWhitelist = async (plateText) => {
    const query = `
        SELECT 
            gr.registration_id,
            gr.host_id,
            gr.guest_name,
            gr.guest_license_plate,
            gr.visit_start_time,
            gr.visit_end_time,
            gr.status,
            u.full_name as host_name,
            c.phone_number as host_phone,
            h.house_number,
            h.block_number
        FROM guest_registrations gr
        JOIN citizens c ON gr.host_id = c.user_id
        JOIN users u ON c.user_id = u.user_id
        LEFT JOIN houses h ON c.house_id = h.house_id
        WHERE UPPER(REPLACE(gr.guest_license_plate, '.', '')) = UPPER(REPLACE($1, '.', ''))
          AND gr.status = 'approved'
          AND gr.visit_start_time <= NOW()
          AND gr.visit_end_time >= NOW()
        LIMIT 1
    `;
    
    const result = await db.query(query, [plateText]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lấy thông tin gate
 * @param {number} gateId 
 */
const getGateInfo = async (gateId) => {
    const query = `
        SELECT gate_id, zone_id, gate_name, direction, is_active
        FROM gates
        WHERE gate_id = $1
    `;
    
    const result = await db.query(query, [gateId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Ghi log vào access_logs
 * @param {Object} params
 * @returns {Object} Log record
 */
const createAccessLog = async ({
    gateId,
    vehicleId,
    guestRegistrationId,
    guardId,
    accessMethod,
    isAccessGranted,
    note,
    imageSnapshotBuffer
}) => {
    const query = `
        INSERT INTO access_logs (
            gate_id,
            vehicle_id,
            guest_registration_id,
            guard_id,
            access_method,
            is_access_granted,
            note,
            image_snapshot_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING log_id, check_in_time
    `;
    
    const result = await db.query(query, [
        gateId,
        vehicleId || null,
        guestRegistrationId || null,
        guardId || null,
        accessMethod,
        isAccessGranted,
        note,
        imageSnapshotBuffer
    ]);
    
    return result.rows[0];
};

/**
 * Ghi prediction vào ai_predictions
 * @param {Object} params
 * @returns {Object} Prediction record
 */
const createAIPrediction = async ({
    logId,
    modelId,
    detectedPlateText,
    confidenceScore,
    processingTimeMs,
    boundingBoxJson,
    croppedPlateImageBuffer
}) => {
    const query = `
        INSERT INTO ai_predictions (
            log_id,
            model_id,
            detected_plate_text,
            confidence_score,
            processing_time_ms,
            bounding_box_json,
            cropped_plate_image_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING prediction_id
    `;
    
    const result = await db.query(query, [
        logId,
        modelId || null,
        detectedPlateText,
        confidenceScore,
        processingTimeMs,
        boundingBoxJson ? JSON.stringify(boundingBoxJson) : null,
        croppedPlateImageBuffer
    ]);
    
    return result.rows[0];
};

/**
 * Xử lý toàn bộ flow check-in (transaction)
 * @param {Object} params
 * @returns {Object} Result với action và log info
 */
const processCheckIn = async ({
    gateId,
    modelId,
    plateText,
    confidenceScore,
    processingTimeMs,
    fullImageBase64,
    croppedImageBase64,
    boundingBoxJson
}) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        // 1. Chuyển đổi base64 thành buffer
        const fullImageBuffer = base64ToBuffer(fullImageBase64);
        const croppedImageBuffer = base64ToBuffer(croppedImageBase64);
        
        // 2. Kiểm tra whitelist
        let vehicle = await checkResidentWhitelist(plateText);
        let guestRegistration = null;
        let isAccessGranted = false;
        let accessType = 'unknown';
        let ownerInfo = null;
        
        if (vehicle) {
            isAccessGranted = true;
            accessType = 'resident';
            ownerInfo = {
                type: 'resident',
                name: vehicle.owner_name,
                phone: vehicle.owner_phone,
                house_number: vehicle.house_number,
                block_number: vehicle.block_number,
            };
        } else {
            // Kiểm tra guest whitelist
            guestRegistration = await checkGuestWhitelist(plateText);
            
            if (guestRegistration) {
                isAccessGranted = true;
                accessType = 'guest';
                ownerInfo = {
                    type: 'guest',
                    guest_name: guestRegistration.guest_name,
                    host_name: guestRegistration.host_name,
                    host_phone: guestRegistration.host_phone,
                    house_number: guestRegistration.house_number,
                    block_number: guestRegistration.block_number,
                };
            }
        }
        
        // 3. Tạo access log
        const logResult = await client.query(`
            INSERT INTO access_logs (
                gate_id,
                vehicle_id,
                guest_registration_id,
                guard_id,
                access_method,
                is_access_granted,
                note,
                image_snapshot_data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING log_id, check_in_time
        `, [
            gateId,
            vehicle ? vehicle.vehicle_id : null,
            guestRegistration ? guestRegistration.registration_id : null,
            null, // guard_id - AI không có guard
            'ai_recognition',
            isAccessGranted,
            isAccessGranted 
                ? `AI recognized: ${plateText} (${accessType})`
                : `AI recognized unknown plate: ${plateText}`,
            fullImageBuffer
        ]);
        
        const logId = logResult.rows[0].log_id;
        const checkInTime = logResult.rows[0].check_in_time;
        
        // 4. Tạo AI prediction record
        await client.query(`
            INSERT INTO ai_predictions (
                log_id,
                model_id,
                detected_plate_text,
                confidence_score,
                processing_time_ms,
                bounding_box_json,
                cropped_plate_image_data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            logId,
            modelId || null,
            plateText,
            confidenceScore,
            processingTimeMs,
            boundingBoxJson ? JSON.stringify(boundingBoxJson) : null,
            croppedImageBuffer
        ]);
        
        await client.query('COMMIT');
        
        return {
            action: isAccessGranted ? 'OPEN' : 'KEEP_CLOSED',
            message: isAccessGranted 
                ? (accessType === 'resident' ? 'Xe cư dân hợp lệ' : 'Xe khách có hẹn hợp lệ')
                : 'Biển số không có trong danh sách cho phép',
            log_id: logId,
            check_in_time: checkInTime,
            plate_text: plateText,
            confidence_score: confidenceScore,
            access_type: accessType,
            owner_info: ownerInfo,
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
    getGateInfo,
    createAccessLog,
    createAIPrediction,
    processCheckIn,
};
