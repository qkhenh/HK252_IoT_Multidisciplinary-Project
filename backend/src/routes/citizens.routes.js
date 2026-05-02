const express = require('express');
const router = express.Router();
const citizensController = require('../controllers/citizens.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Tất cả routes đều yêu cầu auth + role citizen
router.use(authenticate);
router.use(authorize('citizen'));

// ========================
// OTP MANAGEMENT
// ========================

/**
 * @route   POST /api/v1/citizens/tokens
 * @desc    Tạo mã OTP (6 số, hiệu lực 15 phút)
 * @access  Private - Citizen only
 */
router.post('/tokens', citizensController.createOTP);

/**
 * @route   GET /api/v1/citizens/tokens
 * @desc    Lấy danh sách OTP đã tạo
 * @access  Private - Citizen only
 */
router.get('/tokens', citizensController.getMyOTPs);

/**
 * @route   POST /api/v1/citizens/qr-code
 * @desc    Tạo QR token (UUID, hiệu lực 3 phút) - UC-15
 * @access  Private - Citizen only
 */
router.post('/qr-code', citizensController.createQRToken);

// ========================
// VEHICLES MANAGEMENT
// ========================

/**
 * @route   GET /api/v1/citizens/vehicles
 * @desc    Lấy danh sách xe đã đăng ký
 * @access  Private - Citizen only
 */
router.get('/vehicles', citizensController.getMyVehicles);

/**
 * @route   GET /api/v1/citizens/vehicle-types
 * @desc    Lấy danh sách loại xe
 * @access  Private - Citizen only
 */
router.get('/vehicle-types', citizensController.getVehicleTypes);

/**
 * @route   POST /api/v1/citizens/vehicles
 * @desc    Đăng ký xe mới vào whitelist
 * @access  Private - Citizen only
 */
router.post('/vehicles', citizensController.registerVehicle);

/**
 * @route   PUT /api/v1/citizens/vehicles/:vehicleId
 * @desc    Cập nhật thông tin xe cá nhân
 * @access  Private - Citizen only
 */
router.put('/vehicles/:vehicleId', citizensController.editVehicle);

/**
 * @route   PATCH /api/v1/citizens/vehicles/:vehicleId
 * @desc    Cập nhật trạng thái xe (active/inactive)
 * @access  Private - Citizen only
 */
router.patch('/vehicles/:vehicleId', citizensController.updateVehicleStatus);

// ========================
// GUEST REGISTRATION
// ========================

/**
 * @route   GET /api/v1/citizens/guests
 * @desc    Lấy danh sách khách đã đăng ký
 * @access  Private - Citizen only
 */
router.get('/guests', citizensController.getMyGuests);

/**
 * @route   POST /api/v1/citizens/guests
 * @desc    Đăng ký khách có hẹn trước (whitelist tạm thời)
 * @access  Private - Citizen only
 */
router.post('/guests', citizensController.registerGuest);

/**
 * @route   DELETE /api/v1/citizens/guests/:registrationId
 * @desc    Hủy đăng ký khách
 * @access  Private - Citizen only
 */
router.delete('/guests/:registrationId', citizensController.cancelGuest);

// ========================
// ACCESS LOGS
// ========================

/**
 * @route   GET /api/v1/citizens/logs
 * @desc    Lịch sử ra vào của xe thuộc citizen (UC-04)
 * @access  Private - Citizen only
 * @query   page, limit, from, to
 */
router.get('/logs', citizensController.getMyAccessLogs);

module.exports = router;
