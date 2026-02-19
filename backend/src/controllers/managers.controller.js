/**
 * managers.controller.js
 * Controller cho phân hệ Quản lý (Manager Dashboard)
 */

const managersModel = require('../models/managers.model');

// ============================================================
// HELPER: Verify và lấy zone của manager
// ============================================================
const getZoneOrFail = async (req, res) => {
    const zone = await managersModel.getManagerZone(req.user.user_id);
    if (!zone || !zone.managed_zone_id) {
        res.status(403).json({
            success: false,
            message: 'Manager chưa được gán quản lý zone nào',
        });
        return null;
    }
    return zone;
};

// ============================================================
// FR_MAN_01 - QUẢN LÝ PHÊ DUYỆT PHƯƠNG TIỆN
// ============================================================

/**
 * GET /api/v1/managers/vehicles/pending
 * Danh sách xe chờ duyệt
 */
const getPendingVehicles = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        
        const [vehicles, total] = await Promise.all([
            managersModel.getPendingVehicles(zone.managed_zone_id, { 
                limit: parseInt(limit, 10), 
                offset 
            }),
            managersModel.countPendingVehicles(zone.managed_zone_id),
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                vehicles,
                pagination: {
                    total,
                    page: parseInt(page, 10),
                    limit: parseInt(limit, 10),
                    total_pages: Math.ceil(total / parseInt(limit, 10)),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/managers/vehicles/:id/approve
 * Phê duyệt xe
 */
const approveVehicle = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { id } = req.params;
        
        // Kiểm tra xe tồn tại và thuộc zone
        const vehicle = await managersModel.getVehicleById(id, zone.managed_zone_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy xe hoặc xe không thuộc zone quản lý',
            });
        }
        
        if (vehicle.is_active) {
            return res.status(400).json({
                success: false,
                message: 'Xe đã được phê duyệt trước đó',
            });
        }
        
        // Phê duyệt
        const result = await managersModel.approveVehicle(id);
        
        // Ghi audit log
        await managersModel.logAuditAction({
            actorId: req.user.user_id,
            actionType: 'approve_vehicle',
            targetTable: 'vehicles',
            targetId: parseInt(id, 10),
            actionDetails: JSON.stringify({
                license_plate: vehicle.license_plate,
                owner_name: vehicle.owner_name,
            }),
        });
        
        res.status(200).json({
            success: true,
            message: 'Đã phê duyệt xe thành công',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/managers/vehicles/:id/reject
 * Từ chối xe
 */
const rejectVehicle = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { id } = req.params;
        const { reason } = req.body;
        
        // Kiểm tra xe tồn tại và thuộc zone
        const vehicle = await managersModel.getVehicleById(id, zone.managed_zone_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy xe hoặc xe không thuộc zone quản lý',
            });
        }
        
        // Từ chối (xóa)
        const result = await managersModel.rejectVehicle(id);
        
        // Ghi audit log
        await managersModel.logAuditAction({
            actorId: req.user.user_id,
            actionType: 'reject_vehicle',
            targetTable: 'vehicles',
            targetId: parseInt(id, 10),
            actionDetails: JSON.stringify({
                license_plate: vehicle.license_plate,
                owner_name: vehicle.owner_name,
                reason: reason || 'Không đạt yêu cầu',
            }),
        });
        
        res.status(200).json({
            success: true,
            message: 'Đã từ chối đăng ký xe',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// FR_MAN_02 - THỐNG KÊ LƯU LƯỢNG (ANALYTICS)
// ============================================================

/**
 * GET /api/v1/managers/analytics/overview
 * Tổng quan thống kê nhanh
 */
const getOverview = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const stats = await managersModel.getQuickStats(zone.managed_zone_id);
        
        res.status(200).json({
            success: true,
            data: {
                zone_name: zone.zone_name,
                department: zone.department_name,
                stats: {
                    today_total: parseInt(stats.today_total, 10),
                    today_granted: parseInt(stats.today_granted, 10),
                    week_total: parseInt(stats.week_total, 10),
                    active_vehicles: parseInt(stats.active_vehicles, 10),
                    pending_approvals: parseInt(stats.pending_approvals, 10),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/analytics/traffic-by-day
 * Thống kê theo ngày (cho biểu đồ)
 */
const getTrafficByDay = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { days = 7 } = req.query;
        const data = await managersModel.getTrafficByDay(
            zone.managed_zone_id, 
            Math.min(parseInt(days, 10), 90)
        );
        
        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/analytics/traffic-by-hour
 * Thống kê theo giờ (24h gần nhất)
 */
const getTrafficByHour = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const data = await managersModel.getTrafficByHour(zone.managed_zone_id);
        
        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/analytics/vehicle-types
 * Phân bố loại xe (30 ngày)
 */
const getVehicleTypes = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const data = await managersModel.getVehicleTypeDistribution(zone.managed_zone_id);
        
        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/analytics/access-methods
 * Phân bố phương thức truy cập (30 ngày)
 */
const getAccessMethods = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const data = await managersModel.getAccessMethodDistribution(zone.managed_zone_id);
        
        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// FR_MAN_03 - TRA CỨU NHẬT KÝ (ACCESS LOGS)
// ============================================================

/**
 * GET /api/v1/managers/logs
 * Tìm kiếm access logs
 */
const searchLogs = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { 
            start_date,
            end_date,
            access_method,
            is_granted,
            license_plate,
            gate_id,
            limit = 50,
            page = 1,
        } = req.query;
        
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        
        const filters = {
            startDate: start_date || null,
            endDate: end_date || null,
            accessMethod: access_method || null,
            isGranted: is_granted !== undefined ? is_granted === 'true' : undefined,
            licensePlate: license_plate || null,
            gateId: gate_id ? parseInt(gate_id, 10) : null,
            limit: parseInt(limit, 10),
            offset,
        };
        
        const [logs, total] = await Promise.all([
            managersModel.searchAccessLogs(zone.managed_zone_id, filters),
            managersModel.countAccessLogs(zone.managed_zone_id, filters),
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                logs,
                pagination: {
                    total,
                    page: parseInt(page, 10),
                    limit: parseInt(limit, 10),
                    total_pages: Math.ceil(total / parseInt(limit, 10)),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/logs/:id
 * Chi tiết log kèm ảnh
 */
const getLogDetail = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { id } = req.params;
        
        const log = await managersModel.getLogWithImages(id, zone.managed_zone_id);
        
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy log hoặc log không thuộc zone quản lý',
            });
        }
        
        res.status(200).json({
            success: true,
            data: log,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/audit-logs
 * Lịch sử thao tác của managers
 */
const getAuditLogs = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { limit = 50, page = 1 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        
        const logs = await managersModel.getAuditLogs(zone.managed_zone_id, {
            limit: parseInt(limit, 10),
            offset,
        });
        
        res.status(200).json({
            success: true,
            data: logs,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/gates
 * Danh sách cổng trong zone
 */
const getGates = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const gates = await managersModel.getGatesInZone(zone.managed_zone_id);
        
        res.status(200).json({
            success: true,
            data: gates,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// FR_MAN_04 - ĐÁNH GIÁ HIỆU NĂNG AI
// ============================================================

/**
 * GET /api/v1/managers/ai/performance
 * Hiệu năng AI (30 ngày)
 */
const getAIPerformance = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const [stats, confidence] = await Promise.all([
            managersModel.getAIPerformanceStats(zone.managed_zone_id),
            managersModel.getConfidenceDistribution(zone.managed_zone_id),
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                stats,
                confidence_distribution: confidence,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/ai/models
 * Danh sách AI models
 */
const getAIModels = async (req, res, next) => {
    try {
        const models = await managersModel.getAIModels();
        
        res.status(200).json({
            success: true,
            data: models,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/v1/managers/ai/models/:id
 * Cập nhật trạng thái AI model
 */
const updateAIModel = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        
        if (is_active === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu is_active trong body',
            });
        }
        
        const result = await managersModel.updateAIModelStatus(id, is_active);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy AI model',
            });
        }
        
        // Ghi audit log
        await managersModel.logAuditAction({
            actorId: req.user.user_id,
            actionType: is_active ? 'activate_ai_model' : 'deactivate_ai_model',
            targetTable: 'ai_models',
            targetId: parseInt(id, 10),
            actionDetails: JSON.stringify({ model_name: result.model_name, version: result.version }),
        });
        
        res.status(200).json({
            success: true,
            message: is_active ? 'Đã kích hoạt model' : 'Đã vô hiệu hóa model',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/ai/corrections
 * Danh sách AI bị sửa (để retrain)
 */
const getAICorrections = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        
        const { limit = 100, page = 1 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        
        const corrections = await managersModel.getAICorrections(zone.managed_zone_id, {
            limit: parseInt(limit, 10),
            offset,
        });
        
        res.status(200).json({
            success: true,
            data: corrections,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    // FR_MAN_01 - Vehicle Approval
    getPendingVehicles,
    approveVehicle,
    rejectVehicle,
    
    // FR_MAN_02 - Analytics
    getOverview,
    getTrafficByDay,
    getTrafficByHour,
    getVehicleTypes,
    getAccessMethods,
    
    // FR_MAN_03 - Access Logs
    searchLogs,
    getLogDetail,
    getAuditLogs,
    getGates,
    
    // FR_MAN_04 - AI Performance
    getAIPerformance,
    getAIModels,
    updateAIModel,
    getAICorrections,
};
