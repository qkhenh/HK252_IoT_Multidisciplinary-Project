const express = require('express');
const router = express.Router();
const gatesController = require('../controllers/gates.controller');

/**
 * @route   POST /api/v1/gates/check-in
 * @desc    AI Check-in - Nhận dạng biển số, mở/đóng cổng (UC-13/UC-14)
 * @access  Public (gọi từ Python AI service)
 * @body    { lane_id, plate_text, confidence_score?, image_base64? }
 */
router.post('/check-in', gatesController.checkIn);

/**
 * @route   POST /api/v1/gates/verify-camera-otp
 * @desc    AI xác thực OTP/QR từ camera (UC-06)
 * @access  Public (gọi từ Python AI service)
 * @body    { lane_id, token_data, code_type: 'otp_6digit'|'qr_uuid', image_base64? }
 */
router.post('/verify-camera-otp', gatesController.verifyTokenForCheckIn);

/**
 * @route   GET /api/v1/gates/:gateId
 * @desc    Lấy thông tin cổng (heartbeat check)
 * @access  Public
 */
router.get('/:gateId', gatesController.getGate);

module.exports = router;
