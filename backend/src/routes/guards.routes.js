const express = require('express');
const router = express.Router();
const guardsController = require('../controllers/guards.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

/**
 * @route   POST /api/v1/guards/verify-otp
 * @desc    Xác minh mã OTP từ khách
 * @access  Private - Guard only
 * @body    { lane_id, otp_code }
 */
router.post('/verify-otp', authenticate, authorize('guard'), guardsController.verifyOTP);

/**
 * @route   POST /api/v1/guards/manual-action
 * @desc    Mở cổng thủ công hoặc ghi log sự kiện
 * @access  Private - Guard only
 * @body    { lane_id, action_type, action_reason?, note?, image_base64? }
 */
router.post('/manual-action', authenticate, authorize('guard'), guardsController.manualAction);

/**
 * @route   GET /api/v1/guards/logs
 * @desc    Lấy lịch sử access logs gần đây (query: lane_id, limit)
 * @access  Private - Guard only
 */
router.get('/logs', authenticate, authorize('guard'), guardsController.getRecentLogs);

/**
 * @route   GET /api/v1/guards/stats
 * @desc    Lấy thống kê nhanh cho lane (query: lane_id)
 * @access  Private - Guard only
 */
router.get('/stats', authenticate, authorize('guard'), guardsController.getGateStats);

/**
 * @route   GET /api/v1/guards/action-reasons
 * @desc    Lấy danh sách action types và lý do thường gặp (cho dropdown UI)
 * @access  Private - Guard only
 */
router.get('/action-reasons', authenticate, authorize('guard'), guardsController.getActionReasons);

/**
 * @route   POST /api/v1/guards/guests
 * @desc    Guard đăng ký khách thay cư dân (UC-02)
 * @access  Private - Guard only
 * @body    { host_citizen_id, guest_name, guest_license_plate, vehicle_type?, visit_start_time, visit_end_time }
 */
router.post('/guests', authenticate, authorize('guard'), guardsController.registerGuest);

/**
 * @route   POST /api/v1/guards/ai-corrections
 * @desc    Guard báo cáo biển số AI đọc sai (UC-08)
 * @access  Private - Guard only
 * @body    { log_id, corrected_plate_text }
 */
router.post('/ai-corrections', authenticate, authorize('guard'), guardsController.addAICorrection);

module.exports = router;
