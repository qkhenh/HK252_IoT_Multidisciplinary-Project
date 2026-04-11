/**
 * managers.routes.js
 * Routes cho phân hệ Quản lý (Manager Dashboard)
 */

const express = require('express');
const router = express.Router();
const managersController = require('../controllers/managers.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Tất cả routes yêu cầu role manager
router.use(authenticate, authorize('manager'));

// ============================================================
// FR_MAN_01 - QUẢN LÝ PHÊ DUYỆT PHƯƠNG TIỆN
// ============================================================

/**
 * @route   GET /api/v1/managers/vehicles/pending
 * @desc    Danh sách xe chờ phê duyệt
 * @access  Private - Manager only
 * @query   limit, page
 */
router.get('/vehicles/pending', managersController.getPendingVehicles);

/**
 * @route   POST /api/v1/managers/vehicles/:id/approve
 * @desc    Phê duyệt đăng ký xe
 * @access  Private - Manager only
 */
router.post('/vehicles/:id/approve', managersController.approveVehicle);

/**
 * @route   POST /api/v1/managers/vehicles/:id/reject
 * @desc    Từ chối đăng ký xe
 * @access  Private - Manager only
 * @body    { reason?: string }
 */
router.post('/vehicles/:id/reject', managersController.rejectVehicle);

// ============================================================
// FR_MAN_02 - THỐNG KÊ LƯU LƯỢNG (ANALYTICS)
// ============================================================

/**
 * @route   GET /api/v1/managers/analytics/overview
 * @desc    Tổng quan thống kê nhanh (dashboard cards)
 * @access  Private - Manager only
 */
router.get('/analytics/overview', managersController.getOverview);

/**
 * @route   GET /api/v1/managers/analytics/traffic-by-day
 * @desc    Thống kê lưu lượng theo ngày (cho line/bar chart)
 * @access  Private - Manager only
 * @query   days (default: 7, max: 90)
 */
router.get('/analytics/traffic-by-day', managersController.getTrafficByDay);

/**
 * @route   GET /api/v1/managers/analytics/traffic-by-hour
 * @desc    Thống kê lưu lượng theo giờ trong 24h gần nhất
 * @access  Private - Manager only
 */
router.get('/analytics/traffic-by-hour', managersController.getTrafficByHour);

/**
 * @route   GET /api/v1/managers/analytics/vehicle-types
 * @desc    Phân bố loại xe trong 30 ngày (cho pie chart)
 * @access  Private - Manager only
 */
router.get('/analytics/vehicle-types', managersController.getVehicleTypes);

/**
 * @route   GET /api/v1/managers/analytics/access-methods
 * @desc    Phân bố phương thức truy cập trong 30 ngày (cho pie chart)
 * @access  Private - Manager only
 */
router.get('/analytics/access-methods', managersController.getAccessMethods);

// ============================================================
// FR_MAN_03 - TRA CỨU NHẬT KÝ (ACCESS LOGS)
// ============================================================

/**
 * @route   GET /api/v1/managers/logs
 * @desc    Tìm kiếm và lọc access logs
 * @access  Private - Manager only
 * @query   start_date, end_date, access_method, is_granted, license_plate, gate_id, limit, page
 */
router.get('/logs', managersController.searchLogs);

/**
 * @route   GET /api/v1/managers/logs/:id
 * @desc    Chi tiết log kèm ảnh (base64)
 * @access  Private - Manager only
 */
router.get('/logs/:id', managersController.getLogDetail);

/**
 * @route   GET /api/v1/managers/audit-logs
 * @desc    Lịch sử thao tác của managers trong zone
 * @access  Private - Manager only
 * @query   limit, page
 */
router.get('/audit-logs', managersController.getAuditLogs);

/**
 * @route   GET /api/v1/managers/gates
 * @desc    Danh sách cổng trong zone quản lý
 * @access  Private - Manager only
 */
router.get('/gates', managersController.getGates);

// ============================================================
// FR_MAN_04 - ĐÁNH GIÁ HIỆU NĂNG AI
// ============================================================

/**
 * @route   GET /api/v1/managers/ai/performance
 * @desc    Hiệu năng AI trong 30 ngày (accuracy rate, corrections count)
 * @access  Private - Manager only
 */
router.get('/ai/performance', managersController.getAIPerformance);

// ============================================================
// FR_MAN_05 - THAO TÁC THỦ CÔNG (UC-07)
// ============================================================

/**
 * @route   POST /api/v1/managers/manual-action
 * @desc    Manager mở/đóng cổng khẩn cấp
 * @access  Private - Manager only
 * @body    { lane_id, action_type: 'open_barrier'|'close_barrier', action_reason?, note? }
 */
router.post('/manual-action', managersController.manualAction);

// ============================================================
// FR_MAN_06 - ĐĂNG KÝ KHÁCH THAY CƯ DÂN (UC-02)
// ============================================================

/**
 * @route   POST /api/v1/managers/guests
 * @desc    Manager đăng ký khách thay cho cư dân
 * @access  Private - Manager only
 * @body    { host_citizen_id, guest_name, guest_license_plate, vehicle_type?, visit_start_time, visit_end_time }
 */
router.post('/guests', managersController.createGuest);

module.exports = router;
