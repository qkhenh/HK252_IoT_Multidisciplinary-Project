const citizensModel = require('../models/citizens.model');

/**
 * Tạo OTP mới
 * POST /api/v1/citizens/tokens
 */
const createOTP = async (req, res, next) => {
    try {
        if (req.user.role !== 'citizen') {
            return res.status(403).json({ success: false, message: 'Chỉ cư dân mới có thể tạo mã OTP' });
        }

        const citizenExists = await citizensModel.checkCitizenExists(req.user.user_id);
        if (!citizenExists) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin cư dân' });
        }

        const token = await citizensModel.createOTP(req.user.user_id, 15);

        res.status(201).json({
            success: true,
            data: {
                token_id: token.token_id,
                otp_code: token.token_data,
                valid_from: token.valid_from,
                valid_until: token.valid_until,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Tạo QR token
 * POST /api/v1/citizens/qr-code
 */
const createQRToken = async (req, res, next) => {
    try {
        if (req.user.role !== 'citizen') {
            return res.status(403).json({ success: false, message: 'Chỉ cư dân mới có thể tạo QR' });
        }

        const citizenExists = await citizensModel.checkCitizenExists(req.user.user_id);
        if (!citizenExists) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin cư dân' });
        }

        const token = await citizensModel.createQRToken(req.user.user_id);

        res.status(201).json({
            success: true,
            data: {
                token_id: token.token_id,
                qr_data: token.token_data,
                valid_from: token.valid_from,
                valid_until: token.valid_until,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách OTP đã tạo
 * GET /api/v1/citizens/tokens
 */
const getMyOTPs = async (req, res, next) => {
    try {
        if (req.user.role !== 'citizen') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ cư dân mới có thể xem danh sách OTP',
            });
        }
        
        const tokens = await citizensModel.getOTPsByCitizen(req.user.user_id);
        
        res.status(200).json({
            success: true,
            data: tokens,
        });
        
    } catch (error) {
        next(error);
    }
};

// ========================
// VEHICLES MANAGEMENT
// ========================

/**
 * Lấy danh sách xe của citizen
 * GET /api/v1/citizens/vehicles
 */
const getMyVehicles = async (req, res, next) => {
    try {
        const vehicles = await citizensModel.getVehiclesByCitizen(req.user.user_id);
        
        res.status(200).json({
            success: true,
            data: vehicles,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách loại xe
 * GET /api/v1/citizens/vehicle-types
 */
const getVehicleTypes = async (req, res, next) => {
    try {
        const types = await citizensModel.getVehicleTypes();
        
        res.status(200).json({
            success: true,
            data: types,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Đăng ký xe mới
 * POST /api/v1/citizens/vehicles
 */
const registerVehicle = async (req, res, next) => {
    try {
        const { vehicle_type, license_plate, vehicle_color, vehicle_image_url } = req.body;
        
        // Validate
        if (!vehicle_type || !license_plate) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: vehicle_type và license_plate là bắt buộc',
            });
        }
        
        // Validate license plate format (Vietnamese plate - flexible)
        // Supports: 51F-123.45, 59A1-12345, 59B1-567.89, 30H-12345, etc.
        const cleanPlate = license_plate.replace(/[\s.-]/g, '');
        const plateRegex = /^[0-9]{2}[A-Z]{1,2}[0-9]{4,6}$/i;
        if (!plateRegex.test(cleanPlate) || cleanPlate.length < 7 || cleanPlate.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Biển số xe không đúng định dạng',
            });
        }
        
        // Check if plate already exists
        const existingPlate = await citizensModel.checkLicensePlateExists(license_plate);
        if (existingPlate) {
            return res.status(409).json({
                success: false,
                message: 'Biển số xe này đã được đăng ký trong hệ thống',
            });
        }
        
        // Register vehicle
        const vehicle = await citizensModel.registerVehicle({
            ownerId: req.user.user_id,
            vehicleType: vehicle_type,
            licensePlate: license_plate,
            vehicleColor: vehicle_color || null,
        });
        
        res.status(201).json({
            success: true,
            message: 'Đăng ký xe thành công',
            data: vehicle,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Cập nhật thông tin xe cá nhân
 * PUT /api/v1/citizens/vehicles/:vehicleId
 */
const editVehicle = async (req, res, next) => {
    try {
        const { vehicleId } = req.params;
        const { vehicle_type, license_plate, vehicle_color } = req.body;
        
        if (!vehicle_type || !license_plate) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: vehicle_type và license_plate là bắt buộc',
            });
        }
        
        // Validate license plate format
        const cleanPlate = license_plate.replace(/[\s.-]/g, '');
        const plateRegex = /^[0-9]{2}[A-Z]{1,2}[0-9]{4,6}$/i;
        if (!plateRegex.test(cleanPlate) || cleanPlate.length < 7 || cleanPlate.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Biển số xe không đúng định dạng',
            });
        }
        
        // Check if plate already exists for ANOTHER vehicle
        const existingPlate = await citizensModel.checkLicensePlateExists(license_plate);
        if (existingPlate && existingPlate.vehicle_id !== parseInt(vehicleId, 10)) {
            return res.status(409).json({
                success: false,
                message: 'Biển số xe này đã được đăng ký cho xe khác trong hệ thống',
            });
        }
        
        // Update vehicle
        const updatedVehicle = await citizensModel.updateVehicleInfo({
            vehicleId: parseInt(vehicleId, 10),
            ownerId: req.user.user_id,
            vehicleType: vehicle_type,
            licensePlate: license_plate,
            vehicleColor: vehicle_color || null
        });
        
        if (!updatedVehicle) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy xe hoặc bạn không có quyền chỉnh sửa',
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Cập nhật thông tin xe thành công, xe cần chờ Quản lý duyệt lại.',
            data: updatedVehicle,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Cập nhật trạng thái xe (active/inactive)
 * PATCH /api/v1/citizens/vehicles/:vehicleId
 */
const updateVehicleStatus = async (req, res, next) => {
    try {
        const { vehicleId } = req.params;
        const { is_active } = req.body;
        
        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'is_active phải là boolean (true/false)',
            });
        }
        
        const result = await citizensModel.updateVehicleStatus(
            parseInt(vehicleId, 10),
            req.user.user_id,
            is_active
        );
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy xe hoặc bạn không có quyền chỉnh sửa',
            });
        }
        
        res.status(200).json({
            success: true,
            message: is_active ? 'Đã kích hoạt xe' : 'Đã vô hiệu hóa xe',
            data: result,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Xóa xe cá nhân
 * DELETE /api/v1/citizens/vehicles/:vehicleId
 */
const deleteVehicle = async (req, res, next) => {
    try {
        const { vehicleId } = req.params;
        
        const result = await citizensModel.deleteVehicle(
            parseInt(vehicleId, 10),
            req.user.user_id
        );
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy xe hoặc bạn không có quyền xóa',
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Đã xóa xe thành công.',
            data: { vehicle_id: result.vehicle_id, license_plate: result.license_plate },
        });
        
    } catch (error) {
        next(error);
    }
};

// ========================
// GUEST REGISTRATION
// ========================

/**
 * Lấy danh sách khách đã đăng ký
 * GET /api/v1/citizens/guests
 */
const getMyGuests = async (req, res, next) => {
    try {
        const guests = await citizensModel.getGuestRegistrations(req.user.user_id);
        
        res.status(200).json({
            success: true,
            data: guests,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Đăng ký khách có hẹn trước
 * POST /api/v1/citizens/guests
 */
const registerGuest = async (req, res, next) => {
    try {
        const { 
            guest_name, 
            guest_license_plate, 
            vehicle_type,
            visit_start_time, 
            visit_end_time,
            purpose 
        } = req.body;
        
        // Validate required fields
        if (!guest_name || !guest_license_plate || !visit_start_time || !visit_end_time) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: guest_name, guest_license_plate, visit_start_time, visit_end_time là bắt buộc',
            });
        }
        
        // Validate time range
        const startTime = new Date(visit_start_time);
        const endTime = new Date(visit_end_time);
        const now = new Date();
        
        if (startTime >= endTime) {
            return res.status(400).json({
                success: false,
                message: 'Thời gian bắt đầu phải trước thời gian kết thúc',
            });
        }
        
        if (endTime <= now) {
            return res.status(400).json({
                success: false,
                message: 'Thời gian kết thúc phải sau thời điểm hiện tại',
            });
        }
        
        // Check for time conflict with same plate
        const conflict = await citizensModel.checkGuestPlateConflict(
            guest_license_plate,
            visit_start_time,
            visit_end_time
        );
        
        if (conflict) {
            return res.status(409).json({
                success: false,
                message: 'Biển số xe này đã được đăng ký trong khung giờ trùng lặp',
            });
        }
        
        // Register guest
        const registration = await citizensModel.registerGuest({
            hostId: req.user.user_id,
            guestName: guest_name,
            guestLicensePlate: guest_license_plate,
            vehicleType: vehicle_type || 'car',
            visitStartTime: visit_start_time,
            visitEndTime: visit_end_time,
        });
        
        res.status(201).json({
            success: true,
            message: 'Đã thêm khách vào danh sách Whitelist tạm thời.',
            data: registration,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Hủy đăng ký khách
 * DELETE /api/v1/citizens/guests/:registrationId
 */
const cancelGuest = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        
        const result = await citizensModel.cancelGuestRegistration(
            parseInt(registrationId, 10),
            req.user.user_id
        );
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đăng ký hoặc bạn không có quyền hủy',
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Đã hủy đăng ký khách',
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy lịch sử ra vào của citizen (UC-04)
 * GET /api/v1/citizens/logs
 */
const getMyAccessLogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, from, to } = req.query;

        const result = await citizensModel.getMyAccessLogs(req.user.user_id, {
            page: parseInt(page, 10),
            limit: Math.min(parseInt(limit, 10) || 20, 100),
            from: from || undefined,
            to: to || undefined,
        });

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    // OTP
    createOTP,
    getMyOTPs,
    // QR
    createQRToken,
    // Vehicles
    getMyVehicles,
    getVehicleTypes,
    registerVehicle,
    editVehicle,
    updateVehicleStatus,
    deleteVehicle,
    // Guests
    getMyGuests,
    registerGuest,
    cancelGuest,
    // Access Logs
    getMyAccessLogs,
};
