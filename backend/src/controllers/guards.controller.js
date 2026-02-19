const guardsModel = require('../models/guards.model');

/**
 * Xác minh mã OTP
 * POST /api/v1/guards/verify-otp
 */
const verifyOTP = async (req, res, next) => {
    try {
        const { gate_id, guard_id, otp_code } = req.body;
        
        // Validate input
        if (!gate_id || !guard_id || !otp_code) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: gate_id, guard_id, otp_code là bắt buộc',
            });
        }
        
        // Validate OTP format (6 số)
        if (!/^\d{6}$/.test(otp_code)) {
            return res.status(400).json({
                success: false,
                message: 'Mã OTP phải là 6 chữ số',
            });
        }
        
        // Kiểm tra guard tồn tại
        const guardCheck = await guardsModel.checkGuardAssignment(guard_id, gate_id);
        if (!guardCheck.exists) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin bảo vệ',
            });
        }
        
        // Tìm OTP
        const token = await guardsModel.findValidOTP(otp_code);
        
        if (!token) {
            return res.status(404).json({
                success: false,
                data: {
                    action: 'KEEP_CLOSED',
                    message: 'Mã OTP không tồn tại',
                },
            });
        }
        
        // Kiểm tra OTP đã sử dụng chưa
        if (token.is_used) {
            return res.status(400).json({
                success: false,
                data: {
                    action: 'KEEP_CLOSED',
                    message: 'Mã OTP đã được sử dụng trước đó',
                },
            });
        }
        
        // Kiểm tra OTP còn hiệu lực không (dùng kết quả từ DB để tránh timezone issues)
        if (token.is_expired) {
            return res.status(400).json({
                success: false,
                data: {
                    action: 'KEEP_CLOSED',
                    message: 'Mã OTP đã hết hạn',
                },
            });
        }
        
        // OTP hợp lệ → Đánh dấu đã sử dụng
        await guardsModel.markOTPAsUsed(token.token_id);
        
        // Ghi log access
        const accessLog = await guardsModel.logOTPAccess({
            gateId: gate_id,
            guardId: guard_id,
            guestRegistrationId: null,
            note: `OTP verified. Issued by: ${token.issued_by_name} (${token.house_number || 'N/A'})`,
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
        const { gate_id, guard_id, action_type, note, image_base64 } = req.body;
        
        // Validate required fields
        if (!gate_id || !guard_id || !action_type) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: gate_id, guard_id, action_type là bắt buộc',
            });
        }
        
        // Validate action_type
        if (!guardsModel.VALID_ACTION_TYPES.includes(action_type)) {
            return res.status(400).json({
                success: false,
                message: `action_type không hợp lệ. Chỉ chấp nhận: ${guardsModel.VALID_ACTION_TYPES.join(', ')}`,
            });
        }
        
        // Kiểm tra gate tồn tại
        const gate = await guardsModel.getGateInfo(gate_id);
        if (!gate) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cổng',
            });
        }
        
        // Kiểm tra guard tồn tại
        const guardCheck = await guardsModel.checkGuardAssignment(guard_id, gate_id);
        if (!guardCheck.exists) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin bảo vệ',
            });
        }
        
        // Xử lý ảnh nếu có
        let imageBuffer = null;
        if (image_base64) {
            const base64Data = image_base64.includes(',') 
                ? image_base64.split(',')[1] 
                : image_base64;
            imageBuffer = Buffer.from(base64Data, 'base64');
        }
        
        // Ghi log
        const logResult = await guardsModel.logManualAction({
            gateId: gate_id,
            guardId: guard_id,
            actionType: action_type,
            note: note || `Manual ${action_type} by guard`,
            imageSnapshotBuffer: imageBuffer,
        });
        
        // Response
        const actionMessage = action_type === 'open_barrier' 
            ? 'Đã mở cổng và ghi nhận thao tác thủ công.' 
            : 'Đã ghi nhận sự kiện (không mở cổng).';
        
        res.status(200).json({
            success: true,
            message: 'Đã ghi nhận thao tác thủ công thành công.',
            data: {
                action: action_type === 'open_barrier' ? 'OPEN' : 'KEEP_CLOSED',
                message: actionMessage,
                log_id: logResult.log_id,
                check_in_time: logResult.check_in_time,
            },
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy lịch sử access logs gần đây (real-time monitoring)
 * GET /api/v1/guards/logs?gate_id=1&limit=20
 */
const getRecentLogs = async (req, res, next) => {
    try {
        const { gate_id, limit = 20 } = req.query;
        
        if (!gate_id) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu gate_id',
            });
        }
        
        const logs = await guardsModel.getRecentAccessLogs(
            parseInt(gate_id, 10),
            Math.min(parseInt(limit, 10) || 20, 100)
        );
        
        res.status(200).json({
            success: true,
            data: logs,
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy thống kê nhanh cho cổng
 * GET /api/v1/guards/stats?gate_id=1
 */
const getGateStats = async (req, res, next) => {
    try {
        const { gate_id } = req.query;
        
        if (!gate_id) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu gate_id',
            });
        }
        
        const stats = await guardsModel.getGateStats(parseInt(gate_id, 10));
        
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
 * Lấy danh sách lý do thường gặp (cho dropdown)
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

module.exports = {
    verifyOTP,
    manualAction,
    getRecentLogs,
    getGateStats,
    getActionReasons,
};
