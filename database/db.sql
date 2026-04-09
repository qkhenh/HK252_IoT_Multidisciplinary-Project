
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

CREATE TYPE user_role_enum AS ENUM ('citizen', 'guard', 'manager');

CREATE TYPE vehicle_type_enum AS ENUM ('car', 'motorbike', 'bicycle', 'truck', 'emergency');

CREATE TYPE direction_enum AS ENUM ('inbound', 'outbound');

CREATE TYPE access_method_enum AS ENUM (
    'ai_plate_recognition',
    'ai_camera_otp',
    'ai_camera_qr',
    'manual_guard'
);

CREATE TABLE zones (
    zone_id     SERIAL PRIMARY KEY,
    zone_name   VARCHAR(50) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE houses (
    house_id     SERIAL PRIMARY KEY,
    zone_id      INT REFERENCES zones(zone_id) ON DELETE SET NULL,
    house_number VARCHAR(20) NOT NULL,
    block_number VARCHAR(20),
    floor_number INT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gates (
    gate_id   SERIAL PRIMARY KEY,
    zone_id   INT REFERENCES zones(zone_id) ON DELETE CASCADE,
    gate_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

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

CREATE TABLE system_audit_logs (
    audit_id       SERIAL PRIMARY KEY,
    actor_id       INT REFERENCES users(user_id) ON DELETE SET NULL,
    action_type    VARCHAR(50),
    target_table   VARCHAR(50),
    target_id      INT,
    action_details JSONB,
    performed_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

select * from  vehicles;