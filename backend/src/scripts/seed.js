/**
 * Script seed dữ liệu mẫu cho testing
 * Chạy: node src/scripts/seed.js
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
        
        // 2. Tạo Houses
        console.log('🏠 Tạo houses...');
        const housesResult = await db.query(`
            INSERT INTO houses (zone_id, house_number, block_number, floor_number) VALUES
            (1, 'A101', 'Block A', 1),
            (1, 'A102', 'Block A', 1),
            (1, 'A201', 'Block A', 2),
            (2, 'B101', 'Block B', 1)
            ON CONFLICT DO NOTHING
            RETURNING house_id, house_number
        `);
        console.log(`   ✅ Đã tạo ${housesResult.rowCount} houses\n`);
        
        // 3. Tạo Gates
        console.log('🚧 Tạo gates...');
        const gatesResult = await db.query(`
            INSERT INTO gates (zone_id, gate_name, direction, is_active) VALUES
            (1, 'Cổng Chính A - Vào', 'inbound', true),
            (1, 'Cổng Chính A - Ra', 'outbound', true),
            (2, 'Cổng Khu B - Vào', 'inbound', true),
            (2, 'Cổng Khu B - Ra', 'outbound', true)
            ON CONFLICT DO NOTHING
            RETURNING gate_id, gate_name
        `);
        console.log(`   ✅ Đã tạo ${gatesResult.rowCount} gates\n`);
        
        // 4. Tạo Vehicle Types
        console.log('🚗 Tạo vehicle types...');
        const vehicleTypesResult = await db.query(`
            INSERT INTO vehicle_types (type_name, description) VALUES
            ('car', 'Ô tô con'),
            ('motorbike', 'Xe máy'),
            ('bicycle', 'Xe đạp'),
            ('truck', 'Xe tải - Không cho phép vào'),
            ('emergency', 'Xe cứu thương/cứu hỏa')
            ON CONFLICT DO NOTHING
            RETURNING type_id, type_name
        `);
        console.log(`   ✅ Đã tạo ${vehicleTypesResult.rowCount} vehicle types\n`);
        
        // 5. Tạo AI Models
        console.log('🤖 Tạo AI models...');
        const aiModelsResult = await db.query(`
            INSERT INTO ai_models (model_name, version, accuracy_rate, is_active) VALUES
            ('YOLOv8-PlateDetect', '1.0.0', 0.95, true),
            ('OCR-VietnamesePlate', '2.1.0', 0.92, true)
            ON CONFLICT DO NOTHING
            RETURNING model_id, model_name
        `);
        console.log(`   ✅ Đã tạo ${aiModelsResult.rowCount} AI models\n`);
        
        // 6. Tạo Users
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
        
        // 7. Tạo role-specific records
        console.log('🔗 Tạo role-specific records...');
        
        // Lấy user IDs
        const usersResult = await db.query(`SELECT user_id, username, role FROM users`);
        
        for (const user of usersResult.rows) {
            if (user.role === 'manager') {
                await db.query(`
                    INSERT INTO managers (user_id, managed_zone_id, department_name) VALUES
                    ($1, 1, 'Ban Quản Lý Khu A')
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
            } else if (user.role === 'guard') {
                await db.query(`
                    INSERT INTO security_guards (user_id, assigned_gate_id, employee_code, shift_start, shift_end) VALUES
                    ($1, 1, 'GD001', '06:00:00', '14:00:00')
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
            } else if (user.role === 'citizen') {
                await db.query(`
                    INSERT INTO citizens (user_id, house_id, phone_number, identity_card_number, is_house_owner) VALUES
                    ($1, 1, '0901234567', '079123456789', true)
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
            }
        }
        
        console.log('   ✅ Đã liên kết users với role tables\n');
        
        // 8. Tạo Vehicles cho citizen
        console.log('🚙 Tạo vehicles cho citizen...');
        const citizenResult = await db.query(`
            SELECT c.user_id FROM citizens c
            JOIN users u ON c.user_id = u.user_id
            WHERE u.username = 'citizen_hoa'
        `);
        
        if (citizenResult.rows.length > 0) {
            await db.query(`
                INSERT INTO vehicles (owner_id, type_id, license_plate, vehicle_color, is_active) VALUES
                ($1, 1, '51F-123.45', 'Trắng', true),
                ($1, 2, '59A1-12345', 'Đen', true),
                ($1, 1, '12B116888', 'Đỏ', true) 
                ON CONFLICT (license_plate) DO NOTHING
            `, [citizenResult.rows[0].user_id]);
            console.log('   ✅ Đã tạo 3 vehicles cho citizen_hoa\n');
        }
        
        console.log('🎉 Seed dữ liệu hoàn tất!\n');
        console.log('📋 Test accounts:');
        console.log('   - manager_thinh / password123 (Manager)');
        console.log('   - guard_nam / password123 (Guard)');
        console.log('   - citizen_hoa / password123 (Citizen)\n');
        
    } catch (error) {
        console.error('❌ Lỗi khi seed:', error);
    } finally {
        await db.closePool();
    }
};

seedData();
