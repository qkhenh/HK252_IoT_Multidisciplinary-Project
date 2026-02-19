const express = require('express');
const router = express.Router();
const guardsController = require('../controllers/guards.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

/**
 * @route   POST /api/v1/guards/verify-otp
 * @desc    Xác minh mã OTP từ khách
 * @access  Private - Guard only
 */
router.post('/verify-otp', authenticate, authorize('guard'), guardsController.verifyOTP);

/**
 * @route   POST /api/v1/guards/manual-action
 * @desc    Mở cổng thủ công hoặc ghi log sự kiện
 * @access  Private - Guard only
 */
router.post('/manual-action', authenticate, authorize('guard'), guardsController.manualAction);

/**
 * @route   GET /api/v1/guards/logs
 * @desc    Lấy lịch sử access logs gần đây (query: gate_id, limit)
 * @access  Private - Guard only
 */
router.get('/logs', authenticate, authorize('guard'), guardsController.getRecentLogs);

/**
 * @route   GET /api/v1/guards/stats
 * @desc    Lấy thống kê nhanh cho cổng (query: gate_id)
 * @access  Private - Guard only
 */
router.get('/stats', authenticate, authorize('guard'), guardsController.getGateStats);

/**
 * @route   GET /api/v1/guards/action-reasons
 * @desc    Lấy danh sách action types và lý do thường gặp (cho dropdown UI)
 * @access  Private - Guard only
 */
router.get('/action-reasons', authenticate, authorize('guard'), guardsController.getActionReasons);

module.exports = router;
