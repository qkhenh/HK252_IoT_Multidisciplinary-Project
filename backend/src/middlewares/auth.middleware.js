const jwt = require('jsonwebtoken');
const authModel = require('../models/auth.model');

/**
 * Middleware xác thực JWT token
 */
const authenticate = async (req, res, next) => {
    try {
        // Lấy token từ header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Không tìm thấy token xác thực',
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Kiểm tra user còn tồn tại không
        const user = await authModel.findById(decoded.user_id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ - User không tồn tại',
            });
        }
        
        // Gắn user info vào request
        req.user = {
            user_id: user.user_id,
            username: user.username,
            role: user.role,
            full_name: user.full_name,
        };
        
        next();
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token đã hết hạn',
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ',
            });
        }
        
        next(error);
    }
};

/**
 * Middleware kiểm tra role
 * @param  {...string} roles - Danh sách role được phép truy cập
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Chưa xác thực',
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' không có quyền truy cập tài nguyên này`,
            });
        }
        
        next();
    };
};

module.exports = {
    authenticate,
    authorize,
};
