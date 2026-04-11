/**
 * Script seed dữ liệu mẫu cho testing
 * Chạy: node src/scripts/seed.js
 *
 * Schema v2: lanes thay gates, vehicle_type_enum nhúng trực tiếp,
 *            token_data thay otp_code, bỏ vehicle_types & ai_models
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../libs/db');

const seedData = async () => {
    console.log('🌱 Bắt đầu seed dữ liệu...\n');
    
    try {
        // Hash password chung cho tất cả test users
        const password = 'password123';
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        console.log(`🔐 Password chung: ${password}`);
        console.log(`🔐 Hash: ${password_hash}\n`);
        
        // 1. Tạo Zones
        console.log('📍 Tạo zones...');
        const zonesResult = await db.query(`
            INSERT INTO zones (zone_name, description) VALUES
            ('Khu A', 'Khu dân cư cao cấp phía Đông'),
            ('Khu B', 'Khu dân cư phía Tây'),
            ('Khu C', 'Khu thương mại')
            ON CONFLICT DO NOTHING
            RETURNING zone_id, zone_name
        `);
        console.log(`   ✅ Đã tạo ${zonesResult.rowCount} zones\n`);
        
        // 3. Tạo Gates (không còn cột direction — direction nằm ở lanes)
        console.log('🚧 Tạo gates...');
        const gatesResult = await db.query(`
            INSERT INTO gates (zone_id, gate_name, is_active) VALUES
            (1, 'Cổng Chính Khu A', true),
            (2, 'Cổng Khu B',       true)
            ON CONFLICT DO NOTHING
            RETURNING gate_id, gate_name
        `);
        console.log(`   ✅ Đã tạo ${gatesResult.rowCount} gates\n`);
        
        // 4. Tạo Lanes (thay thế cho direction trong gates cũ)
        console.log('🛣️  Tạo lanes...');
        const lanesResult = await db.query(`
            INSERT INTO lanes (lane_id, gate_id, lane_name, direction) VALUES
            ('MAIN-IN',  1, 'Cổng Chính A - Làn Vào', 'inbound'),
            ('MAIN-OUT', 1, 'Cổng Chính A - Làn Ra',  'outbound'),
            ('B-IN',     2, 'Cổng Khu B - Làn Vào',   'inbound'),
            ('B-OUT',    2, 'Cổng Khu B - Làn Ra',     'outbound')
            ON CONFLICT (lane_id) DO NOTHING
            RETURNING lane_id, lane_name
        `);
        console.log(`   ✅ Đã tạo ${lanesResult.rowCount} lanes\n`);
        
        // 5. Tạo Users
        console.log('👤 Tạo users...');
        
        // Manager
        await db.query(`
            INSERT INTO users (username, password_hash, full_name, email, role) VALUES
            ('manager_thinh', $1, 'Nguyễn Văn Quản Lý', 'manager@smartgate.vn', 'manager')
            ON CONFLICT (username) DO NOTHING
        `, [password_hash]);
        
        // Guard
        await db.query(`
            INSERT INTO users (username, password_hash, full_name, email, role) VALUES
            ('guard_nam', $1, 'Trần Văn Bảo Vệ', 'guard@smartgate.vn', 'guard')
            ON CONFLICT (username) DO NOTHING
        `, [password_hash]);
        
        // Citizen
        await db.query(`
            INSERT INTO users (username, password_hash, full_name, email, role) VALUES
            ('citizen_hoa', $1, 'Lê Thị Cư Dân', 'citizen@smartgate.vn', 'citizen')
            ON CONFLICT (username) DO NOTHING
        `, [password_hash]);
        
        console.log('   ✅ Đã tạo 3 users (manager, guard, citizen)\n');
        
        // 6. Tạo role-specific records
        console.log('🔗 Tạo role-specific records...');
        
        const usersResult = await db.query(`SELECT user_id, username, role FROM users`);
        
        for (const user of usersResult.rows) {
            if (user.role === 'manager') {
                await db.query(`
                    INSERT INTO managers (user_id, managed_zone_id, department_name) VALUES
                    ($1, 1, 'Ban Quản Lý Khu A')
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
            } else if (user.role === 'guard') {
                // assigned_gate_id là INT, trỏ đến gates.gate_id
                await db.query(`
                    INSERT INTO security_guards (user_id, assigned_gate_id, employee_code, shift_start, shift_end) VALUES
                    ($1, 1, 'GD001', '06:00:00', '14:00:00')
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
            } else if (user.role === 'citizen') {
                await db.query(`
                    INSERT INTO citizens (user_id, zone_id, address, phone_number, identity_card_number, is_house_owner) VALUES
                    ($1, 1, 'Tòa A, Tầng 1, Căn 101, Khu A', '0901234567', '079123456789', true)
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
            }
        }
        
        console.log('   ✅ Đã liên kết users với role tables\n');
        
        // 7. Tạo Vehicles cho citizen
        // vehicle_type là enum nhúng trực tiếp (không còn type_id FK)
        // owner_user_id trỏ vào users (không phải citizens)
        // is_active = true (bỏ qua pending approval cho seed data)
        console.log('🚙 Tạo vehicles cho citizen...');
        const citizenResult = await db.query(`
            SELECT c.user_id FROM citizens c
            JOIN users u ON c.user_id = u.user_id
            WHERE u.username = 'citizen_hoa'
        `);
        
        if (citizenResult.rows.length > 0) {
            await db.query(`
<<<<<<< HEAD
                INSERT INTO vehicles (owner_id, type_id, license_plate, vehicle_color, is_active) VALUES
                ($1, 1, '51F-123.45', 'Trắng', true),
                ($1, 2, '59A1-12345', 'Đen', true),
                ($1, 1, '12B116888', 'Đỏ', true) 
=======
                INSERT INTO vehicles (owner_user_id, vehicle_type, license_plate, vehicle_color, is_active) VALUES
                ($1, 'car',       '51F-123.45', 'Trắng', true),
                ($1, 'motorbike', '59A1-12345', 'Đen',   true)
>>>>>>> 9780a95df93ba2a269e38fe4e6073364efa3906e
                ON CONFLICT (license_plate) DO NOTHING
            `, [citizenResult.rows[0].user_id]);
            console.log('   ✅ Đã tạo 3 vehicles cho citizen_hoa\n');
        }
        
        // 8. Tạo OTP mẫu cho citizen (token_data thay otp_code)
        console.log('🔑 Tạo OTP mẫu...');
        if (citizenResult.rows.length > 0) {
            await db.query(`
                INSERT INTO access_tokens (issued_by, token_data, valid_from, valid_until, is_used) VALUES
                ($1, '123456', NOW(), NOW() + INTERVAL '15 minutes', false)
                ON CONFLICT (token_data) DO NOTHING
            `, [citizenResult.rows[0].user_id]);
            console.log('   ✅ Đã tạo 1 OTP mẫu (token_data: 123456)\n');
        }
        
        console.log('🎉 Seed dữ liệu hoàn tất!\n');
        console.log('📋 Test accounts:');
        console.log('   - manager_thinh / password123 (Manager - Khu A)');
        console.log('   - guard_nam     / password123 (Guard   - Cổng Chính Khu A)');
        console.log('   - citizen_hoa   / password123 (Citizen - Tòa A, Tầng 1, Căn 101)\n');
        
    } catch (error) {
        console.error('❌ Lỗi khi seed:', error);
    } finally {
        await db.closePool();
    }
};

seedData();

