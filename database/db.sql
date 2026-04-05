-- ==========================================
-- Smart Toll Gate — Database Schema
-- HK252 IoT Multidisciplinary Project
-- Phiên bản: 2.0 (Đồng bộ theo report.md)
--
-- Thay đổi chính so với v1:
--   - Thêm bảng lanes (tách direction ra khỏi gates)
--   - Xóa hoàn toàn: vehicle_types, ai_models, ai_predictions
--   - vehicles: nhúng vehicle_type_enum trực tiếp, thêm is_inside (anti-passback), last_log_time
--   - guest_registrations: nhúng vehicle_type_enum trực tiếp
--   - access_tokens: đổi otp_code/qr_data → token_data (dùng chung OTP + QR UUID)
--   - security_guards: assigned_gate_id → assigned_lane_id (VARCHAR FK → lanes)
--   - access_logs: gate_id → lane_id, thêm token_id, detected_text, action_reason
--   - system_audit_logs: actor_id → tham chiếu users (không chỉ managers), action_details → jsonb
--   - Enum direction_enum thay cho gate_direction_enum
--   - Enum access_method_enum giá trị mới: ai_plate_recognition, ai_camera_otp, ai_camera_qr, manual_guard
-- ==========================================

-- ==========================================
-- 1. DROP CÁC BẢNG CŨ (THỨ TỰ TỪ CON ĐẾN CHA)
-- ==========================================
DROP TABLE IF EXISTS system_audit_logs CASCADE;
DROP TABLE IF EXISTS ai_predictions   CASCADE;
DROP TABLE IF EXISTS access_logs      CASCADE;
DROP TABLE IF EXISTS access_tokens    CASCADE;
DROP TABLE IF EXISTS guest_registrations CASCADE;
DROP TABLE IF EXISTS vehicles         CASCADE;
DROP TABLE IF EXISTS managers         CASCADE;
DROP TABLE IF EXISTS security_guards  CASCADE;
DROP TABLE IF EXISTS citizens         CASCADE;
DROP TABLE IF EXISTS iot_devices      CASCADE;
DROP TABLE IF EXISTS lanes            CASCADE;
DROP TABLE IF EXISTS houses           CASCADE;
DROP TABLE IF EXISTS gates            CASCADE;
DROP TABLE IF EXISTS users            CASCADE;
DROP TABLE IF EXISTS vehicle_types    CASCADE;
DROP TABLE IF EXISTS ai_models        CASCADE;
DROP TABLE IF EXISTS zones            CASCADE;

-- DROP CÁC ENUM
DROP TYPE IF EXISTS user_role_enum      CASCADE;
DROP TYPE IF EXISTS vehicle_type_enum   CASCADE;
DROP TYPE IF EXISTS direction_enum      CASCADE;
DROP TYPE IF EXISTS gate_direction_enum CASCADE;  -- tên cũ, xóa nếu còn tồn tại
DROP TYPE IF EXISTS access_method_enum  CASCADE;

-- ==========================================
-- 2. KHỞI TẠO ENUM
-- ==========================================

-- Phân quyền người dùng (disjoint total — mỗi user chỉ một role)
CREATE TYPE user_role_enum AS ENUM ('citizen', 'guard', 'manager');

-- Loại phương tiện — nhúng trực tiếp vào vehicles & guest_registrations
-- (không còn bảng vehicle_types riêng biệt)
CREATE TYPE vehicle_type_enum AS ENUM ('car', 'motorbike', 'bicycle', 'truck', 'emergency');

-- Hướng di chuyển của làn xe
CREATE TYPE direction_enum AS ENUM ('inbound', 'outbound');

-- Phương thức qua cổng:
--   ai_plate_recognition  — AI đọc biển số xe (Scenario 1)
--   ai_camera_otp         — Camera OCR đọc OTP 6 số từ màn hình điện thoại (Scenario 3)
--   ai_camera_qr          — Camera OCR decode mã QR UUID từ màn hình điện thoại (Scenario 4)
--   manual_guard          — Guard / Manager mở thủ công (UC-07)
CREATE TYPE access_method_enum AS ENUM (
    'ai_plate_recognition',
    'ai_camera_otp',
    'ai_camera_qr',
    'manual_guard'
);

-- ==========================================
-- 3. CỤM HẠ TẦNG VẬT LÝ
-- ==========================================

-- Khu vực quản lý (Zone)
CREATE TABLE zones (
    zone_id     SERIAL PRIMARY KEY,
    zone_name   VARCHAR(50) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Căn hộ / nhà trong khu (thuộc một Zone)
CREATE TABLE houses (
    house_id     SERIAL PRIMARY KEY,
    zone_id      INT REFERENCES zones(zone_id) ON DELETE SET NULL,
    house_number VARCHAR(20) NOT NULL,
    block_number VARCHAR(20),
    floor_number INT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cổng vật lý (một Zone có nhiều Gate)
-- NOTE: direction đã được chuyển xuống bảng lanes
CREATE TABLE gates (
    gate_id   SERIAL PRIMARY KEY,
    zone_id   INT REFERENCES zones(zone_id) ON DELETE CASCADE,
    gate_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Làn xe tại cổng (một Gate có nhiều Lane — thường gồm 1 làn vào + 1 làn ra)
-- lane_id dùng chuỗi mô tả VD: 'MAIN-IN', 'MAIN-OUT', 'B-IN', 'B-OUT'
CREATE TABLE lanes (
    lane_id   VARCHAR(30) PRIMARY KEY,
    gate_id   INT REFERENCES gates(gate_id) ON DELETE CASCADE,
    lane_name VARCHAR(100) NOT NULL,
    direction direction_enum NOT NULL
);

-- Thiết bị IoT gắn vào từng làn xe (camera, barrier controller...)
CREATE TABLE iot_devices (
    device_id   SERIAL PRIMARY KEY,
    lane_id     VARCHAR(30) REFERENCES lanes(lane_id) ON DELETE CASCADE,
    device_name VARCHAR(100),
    device_type VARCHAR(50),
    ip_address  VARCHAR(45),
    mac_address VARCHAR(17),
    status      VARCHAR(20) DEFAULT 'online',
    last_ping   TIMESTAMP
);

-- ==========================================
-- 4. CỤM NGƯỜI DÙNG & PHÂN QUYỀN (ISA)
-- ==========================================

-- Bảng gốc tất cả user (mỗi user có duy nhất 1 role)
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(100),
    role          user_role_enum NOT NULL,
    avatar_url    TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Thông tin đặc thù của Cư dân
CREATE TABLE citizens (
    user_id              INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    house_id             INT REFERENCES houses(house_id) ON DELETE SET NULL,
    phone_number         VARCHAR(15) UNIQUE,
    identity_card_number VARCHAR(20),
    is_house_owner       BOOLEAN DEFAULT FALSE
);

-- Thông tin đặc thù của Bảo vệ
-- assigned_gate_id: cổng xe Guard được phân công trực
CREATE TABLE security_guards (
    user_id          INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_gate_id VARCHAR(30) REFERENCES gates(gate_id) ON DELETE SET NULL,
    employee_code    VARCHAR(20) UNIQUE,
    shift_start      TIME,
    shift_end        TIME
);

-- Thông tin đặc thù của Ban Quản lý
CREATE TABLE managers (
    user_id         INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    managed_zone_id INT REFERENCES zones(zone_id) ON DELETE SET NULL,
    department_name VARCHAR(50)
);

-- ==========================================
-- 5. CỤM NGHIỆP VỤ (WHITELIST & TOKEN)
-- ==========================================

-- Whitelist vĩnh viễn: xe của cư dân
--   is_inside: cờ anti-passback — true = xe đang ở trong khu
--   last_log_time: thời điểm lần cuối xe qua cổng
--   is_active: false = chờ Manager duyệt (UC-09)
CREATE TABLE vehicles (
    vehicle_id    SERIAL PRIMARY KEY,
    owner_user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    vehicle_type  vehicle_type_enum NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_color VARCHAR(30),
    is_inside     BOOLEAN DEFAULT FALSE,     -- anti-passback flag (UC-13)
    is_active     BOOLEAN DEFAULT FALSE,     -- false = pending approval
    last_log_time TIMESTAMP,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Whitelist tạm thời: khách có hẹn trước (UC-02)
--   Có thể được tạo bởi Citizen, Guard, hoặc Manager (host_user_id → users)
--   status: luôn 'approved' vì hệ thống check time window khi AI check-in
CREATE TABLE guest_registrations (
    registration_id  SERIAL PRIMARY KEY,
    host_user_id     INT REFERENCES users(user_id) ON DELETE CASCADE,
    guest_name       VARCHAR(100),
    vehicle_type     vehicle_type_enum,
    guest_license_plate VARCHAR(20),
    visit_start_time TIMESTAMP NOT NULL,
    visit_end_time   TIMESTAMP NOT NULL,
    status           VARCHAR(20) DEFAULT 'approved',
    CONSTRAINT chk_visit_time CHECK (visit_end_time > visit_start_time)
);

-- Mã token ngắn hạn: OTP 6 số (UC-03) hoặc UUID QR (UC-15)
--   token_data: '482917' cho OTP, hoặc UUID string cho QR
--   issued_by: chỉ Citizen tạo token (UC-03 & UC-15)
CREATE TABLE access_tokens (
    token_id    SERIAL PRIMARY KEY,
    issued_by   INT REFERENCES citizens(user_id) ON DELETE CASCADE,
    token_data  VARCHAR(255) UNIQUE NOT NULL,
    valid_from  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP NOT NULL,
    is_used     BOOLEAN DEFAULT FALSE,
    used_at     TIMESTAMP
);

-- ==========================================
-- 6. CỤM LOGGING & AUDIT
-- ==========================================

-- Bảng ghi nhận tất cả lượt ra vào cổng
--   lane_id           : làn xe (thay gate_id)
--   vehicle_id        : xe cư dân (nếu là Scenario 1)
--   guest_reg_id      : đăng ký khách (nếu là Scenario 1 guest / Scenario 3)
--   token_id          : OTP / QR token đã dùng (nếu là Scenario 3 / 4)
--   guard_id          : Guard/Manager mở thủ công (nếu là UC-07)
--   detected_text     : chuỗi OCR thô AI trả về (biển số / OTP 6 số / UUID QR)
--   action_reason     : lý do mở thủ công — bắt buộc khi access_method = 'manual_guard' (UC-07)
--   note              : ghi chú tự do, dùng lưu biển số đã sửa (UC-08)
--   image_snapshot_data: ảnh chụp tại thời điểm ra vào (BYTEA)
CREATE TABLE access_logs (
    log_id              SERIAL PRIMARY KEY,
    lane_id             VARCHAR(30) REFERENCES gates(gate_id) ON DELETE SET NULL,
    vehicle_id          INT REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    guest_reg_id        INT REFERENCES guest_registrations(registration_id) ON DELETE SET NULL,
    token_id            INT REFERENCES access_tokens(token_id) ON DELETE SET NULL,
    guard_id            INT REFERENCES security_guards(user_id) ON DELETE SET NULL,
    check_in_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detected_text       VARCHAR(100),
    access_method       access_method_enum NOT NULL,
    action_reason       VARCHAR(50),         -- UC-07: emergency_vehicle, shipper_delivery, ai_error...
    note                TEXT,                -- UC-08: biển số đã được Guard sửa
    image_snapshot_data BYTEA
);

-- Bảng audit trail: lịch sử thao tác hệ thống
--   actor_id     : bất kỳ user nào (Guard, Manager, Citizen) — không chỉ Manager
--   action_type  : VD 'APPROVE_VEHICLE', 'REJECT_VEHICLE', 'AI_CORRECTION', 'MANUAL_OPEN'
--   action_details: JSON chứa metadata chi tiết của hành động
CREATE TABLE system_audit_logs (
    audit_id       SERIAL PRIMARY KEY,
    actor_id       INT REFERENCES users(user_id) ON DELETE SET NULL,
    action_type    VARCHAR(50),
    target_table   VARCHAR(50),
    target_id      INT,
    action_details JSONB,
    performed_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

