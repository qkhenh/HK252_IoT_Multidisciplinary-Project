const express = require('express');
const router = express.Router();
const gatesController = require('../controllers/gates.controller');

/**
 * @route   POST /api/v1/gates/check-in
 * @desc    AI Check-in - Xử lý xe vào/ra bằng AI (gọi từ Python service)
 * @access  Public (hoặc có thể thêm API key authentication)
 * 
 * Body: {
 *   gate_id: number,
 *   model_id: number (optional),
 *   plate_text: string,
 *   confidence_score: number (0-1),
 *   processing_time_ms: number,
 *   full_image_base64: string,
 *   cropped_image_base64: string,
 *   bounding_box: object (optional)
 * }
 */
router.post('/check-in', gatesController.checkIn);

/**
 * @route   GET /api/v1/gates/:gateId
 * @desc    Lấy thông tin cổng
 * @access  Public
 */
router.get('/:gateId', gatesController.getGate);

module.exports = router;
