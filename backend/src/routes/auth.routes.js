const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @route   POST /api/v1/auth/login
 * @desc    Đăng nhập hệ thống
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Lấy thông tin user hiện tại
 * @access  Private (cần token)
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;
