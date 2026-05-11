const http = require('http'); 
const { Server } = require('socket.io');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB, closePool } = require('./libs/db');

const app = express();
// Bọc Express App bằng HTTP Server
const server = http.createServer(app);

// Khởi tạo trạm phát sóng WebSocket
const io = new Server(server, {
  cors: {
    origin: "*", // Cho phép React gọi tới thoải mái
    methods: ["GET", "POST"]
  }
});

app.set('io', io)

// Lắng nghe tín hiệu từ Camera và bắn lên React
io.on('connection', (socket) => {
  console.log('🔗 Có Client kết nối WebSocket:', socket.id);

  // Client (React) tham gia phòng riêng theo user_id để nhận thông báo cá nhân
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
  });

  // Nhận video từ Python -> Phát lên React
  socket.on('video_stream', (data) => {
    socket.broadcast.emit('live_frame', data);
  });

  // Nhận kết quả quét biển số -> Phát lên React
  socket.on('scan_result', (data) => {
    socket.broadcast.emit('scan_result', data);
  });
});
const PORT = process.env.PORT || 5000;

// ========================
// MIDDLEWARE
// ========================
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' })); // Tăng limit cho base64 image
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ========================
// ROUTES
// ========================
app.get('/api/v1/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Import và mount các routes
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/gates', require('./routes/gates.routes'));
app.use('/api/v1/guards', require('./routes/guards.routes'));
app.use('/api/v1/citizens', require('./routes/citizens.routes'));
app.use('/api/v1/managers', require('./routes/managers.routes'));

// ========================
// ERROR HANDLING
// ========================
// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'Đã xảy ra lỗi server' 
            : err.message,
    });
});

// ========================
// START SERVER
// ========================
const startServer = async () => {
    await connectDB();

    server.listen(PORT, () => {
        console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        console.log(`📋 Health check: http://localhost:${PORT}/api/v1/health`);
    });

    // Background job: Tự động dọn dẹp khách đăng ký không tới sau khi quá hạn
    setInterval(async () => {
        try {
            const client = await require('./libs/db').getClient();
            // Xóa khách được đăng ký nhưng không tới (quá thời gian kết thúc)
            // Khách đã tới (checked_in) sẽ không bị xóa cho đến khi họ đi ra.
            const result = await client.query(`
                DELETE FROM guest_registrations 
                WHERE status = 'approved' 
                AND visit_end_time < NOW()
            `);
            if (result.rowCount > 0) {
                console.log(`🧹 Đã dọn dẹp ${result.rowCount} đăng ký khách quá hạn nhưng không tới.`);
            }
            client.release();
        } catch (err) {
            console.error('❌ Lỗi khi dọn dẹp database:', err);
        }
    }, 60 * 60 * 1000); // Chạy mỗi 1 giờ

    // Graceful Shutdown
    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Đang tắt server...`);
        server.close(async () => {
            await closePool();
            console.log('👋 Server đã tắt hoàn toàn.');
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();