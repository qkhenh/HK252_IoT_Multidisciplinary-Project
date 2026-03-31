const guardsModel = require('../models/guards.model');

/**
 * Xác minh mã OTP thủ công
 * POST /api/v1/guards/verify-otp
 */
const verifyOTP = async (req, res, next) => {
    try {
        const { lane_id, otp_code } = req.body;
        const guardId = req.user.user_id;

        if (!lane_id || !otp_code) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: lane_id và otp_code là bắt buộc',
            });
        }

        if (!/^\d{6}$/.test(otp_code)) {
            return res.status(400).json({
                success: false,
                message: 'Mã OTP phải là 6 chữ số',
            });
        }

        const guardCheck = await guardsModel.checkGuardAssignment(guardId);
        if (!guardCheck.exists) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin bảo vệ' });
        }

        const token = await guardsModel.findValidOTP(otp_code);

        if (!token) {
            return res.status(404).json({ success: false, data: { action: 'KEEP_CLOSED', message: 'Mã OTP không tồn tại' } });
        }
        if (token.is_used) {
            return res.status(400).json({ success: false, data: { action: 'KEEP_CLOSED', message: 'Mã OTP đã được sử dụng' } });
        }
        if (token.is_expired) {
            return res.status(400).json({ success: false, data: { action: 'KEEP_CLOSED', message: 'Mã OTP đã hết hạn' } });
        }

        await guardsModel.markOTPAsUsed(token.token_id);

        const accessLog = await guardsModel.logOTPAccess({
            laneId: lane_id,
            guardId,
            tokenId: token.token_id,
            note: `OTP verified by guard. Issued by: ${token.issued_by_name} (${token.house_number || 'N/A'})`,
        });

        res.status(200).json({
            success: true,
            data: {
                action: 'OPEN',
                message: 'Mã hợp lệ. Đã ghi log hệ thống.',
                log_id: accessLog.log_id,
                guest_info: {
                    host_name: token.issued_by_name,
                    host_phone: token.issued_by_phone,
                    house_number: token.house_number,
                    block_number: token.block_number,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Xử lý mở cổng thủ công / Ghi log sự kiện
 * POST /api/v1/guards/manual-action
 */
const manualAction = async (req, res, next) => {
    try {
        const { lane_id, action_type, action_reason, note, image_base64 } = req.body;
        const guardId = req.user.user_id;

        if (!lane_id || !action_type) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: lane_id và action_type là bắt buộc',
            });
        }

        if (!guardsModel.VALID_ACTION_TYPES.includes(action_type)) {
            return res.status(400).json({
                success: false,
                message: `action_type không hợp lệ. Chỉ chấp nhận: ${guardsModel.VALID_ACTION_TYPES.join(', ')}`,
            });
        }

        const lane = await guardsModel.getLaneInfo(lane_id);
        if (!lane) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lane' });
        }

        let imageBuffer = null;
        if (image_base64) {
            const base64Data = image_base64.includes(',') ? image_base64.split(',')[1] : image_base64;
            imageBuffer = Buffer.from(base64Data, 'base64');
        }

        const logResult = await guardsModel.logManualAction({
            laneId: lane_id,
            guardId,
            actionType: action_type,
            actionReason: action_reason || null,
            note: note || null,
            imageSnapshotBuffer: imageBuffer,
        });

        res.status(200).json({
            success: true,
            message: action_type === 'open_barrier' ? 'Đã mở cổng và ghi nhận thao tác thủ công.' : 'Đã ghi nhận sự kiện.',
            data: {
                action: action_type === 'open_barrier' ? 'OPEN' : 'KEEP_CLOSED',
                log_id: logResult.log_id,
                check_in_time: logResult.check_in_time,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy lịch sử access logs gần đây
 * GET /api/v1/guards/logs?lane_id=MAIN-IN&limit=20
 */
const getRecentLogs = async (req, res, next) => {
    try {
        const { lane_id, limit = 20 } = req.query;

        if (!lane_id) {
            return res.status(400).json({ success: false, message: 'Thiếu lane_id' });
        }

        const logs = await guardsModel.getRecentAccessLogs(lane_id, Math.min(parseInt(limit, 10) || 20, 100));

        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy thống kê nhanh cho lane
 * GET /api/v1/guards/stats?lane_id=MAIN-IN
 */
const getGateStats = async (req, res, next) => {
    try {
        const { lane_id } = req.query;

        if (!lane_id) {
            return res.status(400).json({ success: false, message: 'Thiếu lane_id' });
        }

        const stats = await guardsModel.getGateStats(lane_id);

        res.status(200).json({
            success: true,
            data: {
                last_hour: parseInt(stats.last_hour, 10),
                last_24h: parseInt(stats.last_24h, 10),
                granted_24h: parseInt(stats.granted_24h, 10),
                denied_24h: parseInt(stats.denied_24h, 10),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách lý do thường gặp
 * GET /api/v1/guards/action-reasons
 */
const getActionReasons = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                action_types: guardsModel.VALID_ACTION_TYPES,
                common_reasons: guardsModel.COMMON_REASONS,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Guard đăng ký khách thay cư dân (UC-02)
 * POST /api/v1/guards/guests
 */
const registerGuest = async (req, res, next) => {
    try {
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
            return res.status(400).json({ success: false, message: 'Thời gian bắt đầu phải trước thời gian kết thúc' });
        }

        const citizenExists = await guardsModel.checkCitizenExists(host_citizen_id);
        if (!citizenExists) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cư dân' });
        }

        const registration = await guardsModel.createGuestRegistration({
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

/**
 * Guard báo cáo biển số AI đọc sai (UC-08)
 * POST /api/v1/guards/ai-corrections
 */
const addAICorrection = async (req, res, next) => {
    try {
        const { log_id, corrected_plate_text } = req.body;
        const guardId = req.user.user_id;

        if (!log_id || !corrected_plate_text) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: log_id và corrected_plate_text là bắt buộc',
            });
        }

        const log = await guardsModel.getLogById(log_id);
        if (!log) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy log' });
        }

        const result = await guardsModel.addAICorrection(log_id, guardId, corrected_plate_text);

        res.status(200).json({
            success: true,
            message: 'Đã ghi nhận sửa biển số',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    verifyOTP,
    manualAction,
    getRecentLogs,
    getGateStats,
    getActionReasons,
    registerGuest,
    addAICorrection,
};
