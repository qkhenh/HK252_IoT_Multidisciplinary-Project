const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authModel = require('../models/auth.model');

/**
 * Xử lý đăng nhập
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập username và password',
            });
        }
        
        // Tìm user trong database
        const user = await authModel.findByUsername(username);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng',
            });
        }
        
        // Kiểm tra password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng',
            });
        }
        
        // Tạo JWT token
        const tokenPayload = {
            user_id: user.user_id,
            username: user.username,
            role: user.role,
        };
        
        const access_token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        
        // Xóa password_hash khỏi response
        delete user.password_hash;
        
        // Response theo API contract
        res.status(200).json({
            success: true,
            data: {
                user_id: user.user_id,
                role: user.role,
                full_name: user.full_name,
                access_token,
                // Thêm role-specific details
                ...(user.citizen_details && { citizen_details: user.citizen_details }),
                ...(user.guard_details && { guard_details: user.guard_details }),
                ...(user.manager_details && { manager_details: user.manager_details }),
            },
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy thông tin user hiện tại (từ token)
 * GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
    try {
        const user = await authModel.findByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng',
            });
        }
        
        // Xóa password_hash
        delete user.password_hash;
        
        res.status(200).json({
            success: true,
            data: user,
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    getMe,
};
