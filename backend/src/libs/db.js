const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Log khi có lỗi kết nối pool
pool.on('error', (err) => {
    console.error('Lỗi không mong muốn từ PostgreSQL pool:', err);
});

/**
 * Kiểm tra kết nối database
 */
const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Đã kết nối PostgreSQL thành công!');
        client.release();
    } catch (error) {
        console.error('❌ Kết nối PostgreSQL thất bại:', error.message);
        process.exit(1);
    }
};

/**
 * Thực thi query đơn giản
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Lấy client từ pool để thực hiện transaction
 */
const getClient = () => pool.connect();

/**
 * Đóng pool khi shutdown server
 */
const closePool = async () => {
    await pool.end();
    console.log('🔌 Đã đóng kết nối PostgreSQL pool.');
};

module.exports = {
    connectDB,
    query,
    getClient,
    closePool,
    pool,
};