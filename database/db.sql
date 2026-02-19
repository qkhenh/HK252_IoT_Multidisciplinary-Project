-- 1. Xóa các bảng tầng ngoài cùng (Không có bảng nào tham chiếu đến chúng)
DROP TABLE IF EXISTS system_audit_logs;
DROP TABLE IF EXISTS ai_predictions;
DROP TABLE IF EXISTS access_logs;
DROP TABLE IF EXISTS access_tokens;

-- 2. Xóa các bảng trung gian phụ thuộc vào Citizens và Vehicle Types
DROP TABLE IF EXISTS guest_registrations;
DROP TABLE IF EXISTS vehicles;

-- 3. Xóa các bảng phân quyền người dùng (Phụ thuộc vào Users, Zones, Gates, Houses)
DROP TABLE IF EXISTS managers;
DROP TABLE IF EXISTS security_guards;
DROP TABLE IF EXISTS citizens;

-- 4. Xóa các thiết bị (Phụ thuộc vào Gates)
DROP TABLE IF EXISTS iot_devices;

-- 5. Xóa các bảng quản lý hạ tầng (Phụ thuộc vào Zones)
DROP TABLE IF EXISTS houses;
DROP TABLE IF EXISTS gates;

-- 6. Xóa các bảng gốc (Không chứa khóa ngoại nào tham chiếu ra ngoài)
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS vehicle_types;
DROP TABLE IF EXISTS ai_models;
DROP TABLE IF EXISTS zones;

-- 7. Xóa các Enum Types (Chỉ xóa được sau khi các bảng sử dụng chúng đã bay màu)
DROP TYPE IF EXISTS user_role_enum;
DROP TYPE IF EXISTS vehicle_type_enum;
DROP TYPE IF EXISTS gate_direction_enum;
DROP TYPE IF EXISTS access_method_enum;

create type user_role_enum as enum ('citizen', 'guard', 'manager');
create type vehicle_type_enum as enum ('car', 'motorbike', 'bicycle', 'truck', 'emergency');
create type gate_direction_enum as enum ('inbound', 'outbound');
create type access_method_enum as enum ('ai_recognition', 'card_rfid', 'qrcode', 'manual_otp', 'manual_guard');

create table zones ( -- Quản lý zone 
    zone_id serial primary key,
    zone_name varchar(50) not null,
    description text,
    created_at timestamp default current_timestamp
);

create table houses ( -- Quản lý nhà
    house_id serial primary key,
    zone_id int references zones(zone_id) on delete set null,
    house_number varchar(20) not null,
    block_number varchar(20),
    floor_number int,
    created_at timestamp default current_timestamp
);

create table gates ( -- Quản lý cổng
    gate_id serial primary key,
    zone_id int references zones(zone_id) on delete cascade,
    gate_name varchar(50) not null,
    direction gate_direction_enum not null,
    is_active boolean default true
);

create table iot_devices ( -- Quản lý thiết bị 
    device_id serial primary key,
    gate_id int references gates(gate_id) on delete cascade,
    device_name varchar(100),
    device_type varchar(50),
    ip_address varchar(45),
    mac_address varchar(17),
    status varchar(20) default 'online',
    last_ping timestamp
);

create table users ( -- Quản lý người dùng 
    user_id serial primary key,
    username varchar(50) unique not null,
    password_hash varchar(255) not null,
    full_name varchar(100) not null,
    email varchar(100),
    role user_role_enum not null,
    avatar_url text,
    created_at timestamp default current_timestamp
);

create table citizens (
    user_id int primary key references users(user_id) on delete cascade,
    house_id int references houses(house_id) on delete set null,
    phone_number varchar(15) unique,
    identity_card_number varchar(20),
    is_house_owner boolean default false
);

create table security_guards (
    user_id int primary key references users(user_id) on delete cascade,
    assigned_gate_id int references gates(gate_id),
    employee_code varchar(20) unique,
    shift_start time,
    shift_end time
);


create table managers ( -- Quản lý zone
    user_id int primary key references users(user_id) on delete cascade,
    managed_zone_id int references zones(zone_id) on delete set null, 
    department_name varchar(50) 
);

create table vehicle_types ( -- Loại xe. Vd truck thì cổng không mở
    type_id serial primary key,
    type_name vehicle_type_enum not null,
    description text
);

create table vehicles ( -- Whitelist của citizen
    vehicle_id serial primary key,
    owner_id int references citizens(user_id) on delete cascade,
    type_id int references vehicle_types(type_id),
    license_plate varchar(20) unique not null,
    vehicle_color varchar(30),
    vehicle_image_url text,
    is_active boolean default true,
    registered_at timestamp default current_timestamp
);

create table guest_registrations ( -- Whitelist cho edge case 2.1
    registration_id serial primary key,
    host_id int references citizens(user_id) on delete cascade,
    guest_name varchar(100),
    guest_license_plate varchar(20),
    vehicle_type_id int references vehicle_types(type_id),
    visit_start_time timestamp not null,
    visit_end_time timestamp not null,
    status varchar(20) default 'pending',
    purpose text
);

create table access_tokens ( -- CHo edge case 2.2
    token_id serial primary key,
    issued_by int references citizens(user_id) on delete cascade,
    otp_code varchar(10) not null,
    valid_from timestamp default current_timestamp,
    valid_until timestamp not null,
    is_used boolean default false,
    used_at timestamp
);

create table ai_models ( -- Đánh giá model
    model_id serial primary key,
    model_name varchar(50) not null,
    version varchar(20),
    accuracy_rate float,
    is_active boolean default false,
    created_at timestamp default current_timestamp
);

create table access_logs ( -- Cơ chế logging
    log_id serial primary key,
    gate_id int references gates(gate_id),
    vehicle_id int references vehicles(vehicle_id) on delete set null,
    guest_registration_id int references guest_registrations(registration_id) on delete set null,
    guard_id int references security_guards(user_id) on delete set null,
    check_in_time timestamp default current_timestamp,
    image_snapshot_data BYTEA,
    access_method access_method_enum not null,
    is_access_granted boolean default false,
    note text
);

create table ai_predictions ( -- Bảng thống kê dữ liệu phân tích 
    prediction_id serial primary key,
    log_id int references access_logs(log_id) on delete cascade,
    model_id int references ai_models(model_id),
    detected_plate_text varchar(20),
    confidence_score float,
    processing_time_ms int,
    is_correct boolean default null,
    corrected_plate_text varchar(20),
    bounding_box_json jsonb,
    cropped_plate_image_data BYTEA
);

create table system_audit_logs (
    audit_id serial primary key,
    actor_id int references managers(user_id), -- Ai lam? (Thuong la Manager)
    action_type varchar(50), -- VD: 'approve_vehicle', 'delete_guard', 'update_config'
    target_table varchar(50), -- Tac dong vao bang nao?
    target_id int, -- ID cua dong bi tac dong
    action_details text, -- Ghi chu chi tiet (JSON hoac Text)
    performed_at timestamp default current_timestamp
);
