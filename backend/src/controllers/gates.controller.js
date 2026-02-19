const gatesModel = require('../models/gates.model');

/**
 * AI Check-in - Xử lý xe vào/ra bằng AI
 * POST /api/v1/gates/check-in
 * 
 * Endpoint này được gọi từ Python AI service
 */
const checkIn = async (req, res, next) => {
    try {
        const {
            gate_id,
            model_id,
            plate_text,
            confidence_score,
            processing_time_ms,
            full_image_base64,
            cropped_image_base64,
            bounding_box
        } = req.body;
        
        // Validate required fields
        if (!gate_id) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu gate_id',
            });
        }
        
        if (!plate_text) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu plate_text (biển số xe)',
            });
        }
        
        // Validate gate exists
        const gate = await gatesModel.getGateInfo(gate_id);
        
        if (!gate) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cổng với gate_id này',
            });
        }
        
        if (!gate.is_active) {
            return res.status(400).json({
                success: false,
                message: 'Cổng này hiện không hoạt động',
            });
        }
        
        // Process check-in
        const result = await gatesModel.processCheckIn({
            gateId: gate_id,
            modelId: model_id,
            plateText: plate_text,
            confidenceScore: confidence_score || 0,
            processingTimeMs: processing_time_ms || 0,
            fullImageBase64: full_image_base64,
            croppedImageBase64: cropped_image_base64,
            boundingBoxJson: bounding_box
        });
        
        // Response theo API contract
        res.status(200).json({
            success: true,
            data: {
                action: result.action,
                message: result.message,
                log_id: result.log_id,
                // Thêm thông tin chi tiết (optional, có thể bỏ nếu không cần)
                details: {
                    gate_name: gate.gate_name,
                    direction: gate.direction,
                    plate_text: result.plate_text,
                    confidence_score: result.confidence_score,
                    access_type: result.access_type,
                    owner_info: result.owner_info,
                    check_in_time: result.check_in_time,
                }
            },
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
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cổng',
            });
        }
        
        res.status(200).json({
            success: true,
            data: gate,
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    checkIn,
    getGate,
};
