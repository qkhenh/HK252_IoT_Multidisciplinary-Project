const gatesModel = require('../models/gates.model');

/**
 * AI Check-in - Xử lý xe vào/ra bằng AI nhận dạng biển số
 * POST /api/v1/gates/check-in
 */
const checkIn = async (req, res, next) => {
    try {
        const { lane_id, plate_text, confidence_score, image_base64 } = req.body;

        if (!lane_id) {
            return res.status(400).json({ success: false, message: 'Thiếu lane_id' });
        }
        if (!plate_text) {
            return res.status(400).json({ success: false, message: 'Thiếu plate_text (biển số xe)' });
        }

        const lane = await gatesModel.getLaneInfo(lane_id);
        if (!lane) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lane với lane_id này' });
        }
        if (!lane.is_active) {
            return res.status(400).json({ success: false, message: 'Cổng này hiện không hoạt động' });
        }

        const result = await gatesModel.processCheckIn({
            laneId: lane_id,
            plateText: plate_text,
            confidenceScore: confidence_score || 0,
            imageBase64: image_base64,
        });

        res.status(200).json({
            success: true,
            data: {
                action: result.action,
                message: result.message,
                log_id: result.log_id,
                check_in_time: result.check_in_time,
                plate_text: result.plate_text,
                confidence_score: result.confidence_score,
                access_type: result.access_type,
                owner_info: result.owner_info,
                lane_name: result.lane_name,
                gate_name: result.gate_name,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * AI xác thực OTP/QR từ camera (UC-06)
 * POST /api/v1/gates/verify-camera-otp
 */
const verifyTokenForCheckIn = async (req, res, next) => {
    try {
        const { lane_id, token_data, code_type, image_base64 } = req.body;

        if (!lane_id || !token_data || !code_type) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin: lane_id, token_data, code_type là bắt buộc',
            });
        }

        if (!['otp_6digit', 'qr_uuid'].includes(code_type)) {
            return res.status(400).json({
                success: false,
                message: 'code_type không hợp lệ. Chỉ chấp nhận: otp_6digit, qr_uuid',
            });
        }

        const lane = await gatesModel.getLaneInfo(lane_id);
        if (!lane) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lane' });
        }

        const result = await gatesModel.verifyTokenForCheckIn({
            laneId: lane_id,
            tokenData: token_data,
            codeType: code_type,
            imageBase64: image_base64,
        });

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy thông tin cổng
 * GET /api/v1/gates/:gateId
 */
const getGate = async (req, res, next) => {
    try {
        const { gateId } = req.params;

        const gate = await gatesModel.getGateInfo(parseInt(gateId, 10));

        if (!gate) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cổng' });
        }

        res.status(200).json({ success: true, data: gate });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    checkIn,
    verifyTokenForCheckIn,
    getGate,
};
