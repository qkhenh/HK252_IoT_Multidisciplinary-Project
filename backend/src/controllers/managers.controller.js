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
        
        let result, actionMessage;

        // PHÂN LUỒNG DUYỆT
        if (vehicle.status === 'pending_delete') {
            // Duyệt xóa = Thực thi lệnh xóa khỏi DB (Hàm rejectVehicle trong model thực chất là lệnh DELETE)
            result = await managersModel.rejectVehicle(id);
            actionMessage = 'Đã phê duyệt yêu cầu xóa. Xe đã được gỡ khỏi hệ thống.';
        } else {
            // Duyệt đăng ký/cập nhật = Khôi phục hoạt động bình thường
            result = await managersModel.approveVehicle(id);
            actionMessage = 'Đã phê duyệt thông tin xe thành công.';
        }
    
        
        // Gửi thông báo cho citizen qua WebSocket
        const io = req.app.get('io');
        if (io && vehicle.owner_user_id) {
            io.to(`user_${vehicle.owner_user_id}`).emit('vehicle_status_changed', {
                vehicle_id: parseInt(id, 10),
                status: 'approved',
                license_plate: vehicle.license_plate,
                message: 'Ö tô/xe của bạn đã được phê duyệt.',
            });
        }

        // Ghi audit log
        await managersModel.logAuditAction({
            actorId: req.user.user_id,
            actionType: 'approve_vehicle',
            targetTable: 'vehicles',
            targetId: parseInt(id, 10),
            actionDetails: JSON.stringify({ license_plate: vehicle.license_plate, previous_status: vehicle.status }),
        });
        
        res.status(200).json({ success: true, message: actionMessage, data: result });
    } catch (error) { next(error); }
};

const rejectVehicle = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;
        const { id } = req.params;
        const { reason } = req.body;
        const vehicle = await managersModel.getVehicleById(id, zone.managed_zone_id);
        
        if (!vehicle) return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });

        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Lý do từ chối là bắt buộc' });
        }

        let result, actionMessage;
        
        // PHÂN LUỔNG TỪ CHỐI
        if (vehicle.status === 'pending_new') {
            result = await managersModel.rejectVehicle(id);
            actionMessage = 'Đã từ chối và xóa đăng ký xe mới.';
        } else if (vehicle.status === 'pending_update') {
            result = await managersModel.restoreVehicle(id);
            actionMessage = 'Đã từ chối bản cập nhật, khôi phục lại trạng thái xe cũ.';
        } else {
            return res.status(400).json({ success: false, message: 'Xe không ở trạng thái chờ duyệt' });
        }
        
        // Gửi thông báo cho citizen qua WebSocket
        const io = req.app.get('io');
        if (io && vehicle.owner_user_id) {
            io.to(`user_${vehicle.owner_user_id}`).emit('vehicle_status_changed', {
                vehicle_id: parseInt(id, 10),
                status: 'rejected',
                license_plate: vehicle.license_plate,
                reason: reason.trim(),
                message: `Xe bị từ chối: ${reason.trim()}`,
            });
        }
        
        await managersModel.logAuditAction({
            actorId: req.user.user_id,
            actionType: 'reject_vehicle',
            targetTable: 'vehicles',
            targetId: parseInt(id, 10),
            actionDetails: JSON.stringify({ license_plate: vehicle.license_plate, previous_status: vehicle.status, reason: reason || 'Từ chối' }),
        });
        
        res.status(200).json({ success: true, message: actionMessage, data: result });
    } catch (error) { next(error); }
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
        
        const { period = 'day' } = req.query;
        const stats = await managersModel.getQuickStats(zone.managed_zone_id, period);
        
        res.status(200).json({
            success: true,
            data: {
                zone_name: zone.zone_name,
                department: zone.department_name,
                stats,
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
        
        const stats = await managersModel.getAIPerformanceStats(zone.managed_zone_id);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/managers/ai/models
 * Danh sách AI models
 */
// ============================================================
// FR_MAN_05 - THAO TÁC THỦ CÔNG (UC-07)
// ============================================================

/**
 * POST /api/v1/managers/manual-action
 * Manager mở/đóng cổng khẩn cấp
 */
const manualAction = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;

        const { lane_id, action_type, action_reason, note } = req.body;

        if (!lane_id || !action_type) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: lane_id và action_type là bắt buộc',
            });
        }

        if (!['open_barrier', 'close_barrier'].includes(action_type)) {
            return res.status(400).json({
                success: false,
                message: 'action_type không hợp lệ. Chỉ chấp nhận: open_barrier, close_barrier',
            });
        }

        const result = await managersModel.createManagerManualAction({
            laneId: lane_id,
            actionReason: action_reason || null,
            note: note || null,
        });

        const io = req.app.get('io');
        if (io) {
            io.emit('manual_command', {
                action: action_type === 'open_barrier' ? 'OPEN' : 'CLOSE',
                operator_name: req.user.full_name || 'Manager',
                lane_id,               
            });
        }
        await managersModel.logAuditAction({
            actorId: req.user.user_id,
            actionType: action_type === 'open_barrier' ? 'manual_open_gate' : 'manual_close_gate',
            targetTable: 'access_logs',
            targetId: result.log_id,
            actionDetails: JSON.stringify({ action_type, action_reason, note, lane_id}),
        });

        res.status(200).json({
            success: true,
            message: action_type === 'open_barrier' ? 'Đã mở cổng và ghi log' : 'Đã ghi log đóng cổng',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// FR_MAN_06 - ĐĂNG KÝ KHÁCH THAY CƯ DÂN (UC-02)
// ============================================================

/**
 * POST /api/v1/managers/guests
 * Manager đăng ký khách cho cư dân
 */
const createGuest = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;

        const { host_citizen_id, guest_name, guest_license_plate, vehicle_type, visit_start_time, visit_end_time } = req.body;

        if (!host_citizen_id || !guest_name || !guest_license_plate || !visit_start_time || !visit_end_time) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc',
            });
        }

        const startTime = new Date(visit_start_time);
        const endTime = new Date(visit_end_time);
        if (startTime >= endTime) {
            return res.status(400).json({
                success: false,
                message: 'Thời gian bắt đầu phải trước thời gian kết thúc',
            });
        }

        const citizenInZone = await managersModel.checkCitizenInZone(host_citizen_id, zone.managed_zone_id);
        if (!citizenInZone) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cư dân hoặc cư dân không thuộc zone quản lý',
            });
        }

        const registration = await managersModel.createGuestRegistration({
            hostCitizenId: host_citizen_id,
            guestName: guest_name,
            guestLicensePlate: guest_license_plate,
            vehicleType: vehicle_type || 'car',
            visitStartTime: visit_start_time,
            visitEndTime: visit_end_time,
        });

        res.status(201).json({
            success: true,
            message: 'Đã đăng ký khách thành công',
            data: registration,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// FR_MAN_07 - QUẢN LÝ NGƯỜI DÙNG
// ============================================================

/**
 * GET /api/v1/managers/users
 * Danh sách users trong zone
 */
const listUsers = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;

        const { role, page = 1, limit = 20 } = req.query;
        const validRoles = ['citizen', 'guard', 'manager'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'role không hợp lệ' });
        }

        const users = await managersModel.getUsersInZone(zone.managed_zone_id, {
            role,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
        });

        res.status(200).json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/v1/managers/users
 * Tạo user mới (citizen / guard / manager)
 */
const createUser = async (req, res, next) => {
    try {
        const zone = await getZoneOrFail(req, res);
        if (!zone) return;

        const { username, password, full_name, email, role, role_details = {} } = req.body;

        if (!username || !password || !full_name || !role) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc: username, password, full_name, role',
            });
        }

        const validRoles = ['citizen', 'guard', 'manager'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'role không hợp lệ' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // Gắn zone mặc định theo zone của manager nếu không tự chỉ định
        const enrichedDetails = { ...role_details };
        if (role === 'citizen' && !enrichedDetails.zone_id) {
            enrichedDetails.zone_id = zone.managed_zone_id;
        } else if (role === 'manager' && !enrichedDetails.managed_zone_id) {
            enrichedDetails.managed_zone_id = zone.managed_zone_id;
        }

        const newUser = await managersModel.createUser({
            username,
            password,
            fullName: full_name,
            email: email || null,
            role,
            roleDetails: enrichedDetails,
        });

        await managersModel.logAuditAction({
            actorId: req.user.user_id,
            actionType: 'create_user',
            targetTable: 'users',
            targetId: newUser.user_id,
            actionDetails: JSON.stringify({ username, role }),
        });

        res.status(201).json({
            success: true,
            message: `Đã tạo tài khoản ${role} thành công`,
            data: newUser,
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
        }
        next(error);
    }
};

module.exports = {
    // FR_MAN_01
    getPendingVehicles,
    approveVehicle,
    rejectVehicle,
    // FR_MAN_02
    getOverview,
    getTrafficByDay,
    getTrafficByHour,
    getVehicleTypes,
    getAccessMethods,
    // FR_MAN_03
    searchLogs,
    getLogDetail,
    getAuditLogs,
    getGates,
    // FR_MAN_04
    getAIPerformance,
    // FR_MAN_05
    manualAction,
    // FR_MAN_06
    createGuest,
    // FR_MAN_07
    listUsers,
    createUser,
};
