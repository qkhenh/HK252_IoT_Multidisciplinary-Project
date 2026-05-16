# Testing Guide — Smart Toll Gate (HK252)

> Tài liệu này mô tả kịch bản test toàn bộ chức năng backend API.
> Cập nhật: 16/05/2026

---

## Mục lục

1. [Chuẩn bị môi trường](#1-chuẩn-bị-môi-trường)
2. [Tài khoản test](#2-tài-khoản-test)
3. [Auth](#3-auth)
4. [Citizen — Quản lý OTP & QR](#4-citizen--quản-lý-otp--qr)
5. [Citizen — Quản lý phương tiện](#5-citizen--quản-lý-phương-tiện)
6. [Citizen — Đăng ký khách](#6-citizen--đăng-ký-khách)
7. [Citizen — Lịch sử ra vào](#7-citizen--lịch-sử-ra-vào)
8. [Guard — Xác minh OTP](#8-guard--xác-minh-otp)
9. [Guard — Thao tác thủ công](#9-guard--thao-tác-thủ-công)
10. [Guard — Logs & Stats](#10-guard--logs--stats)
11. [Guard — Đăng ký khách & AI Corrections](#11-guard--đăng-ký-khách--ai-corrections)
12. [Manager — Phê duyệt xe](#12-manager--phê-duyệt-xe)
13. [Manager — Analytics](#13-manager--analytics)
14. [Manager — Logs & Audit](#14-manager--logs--audit)
15. [Manager — Thao tác thủ công & Gates](#15-manager--thao-tác-thủ-công--gates)
16. [Manager — Quản lý người dùng](#16-manager--quản-lý-người-dùng)
17. [Gates — AI Service Endpoints](#17-gates--ai-service-endpoints)
18. [Kiểm thử lỗi phổ biến](#18-kiểm-thử-lỗi-phổ-biến)

---

## 1. Chuẩn bị môi trường

### 1.1 Khởi động backend

```powershell
# Khởi động PostgreSQL (nếu dùng Docker)
docker-compose up -d

# Khởi động backend
cd backend
npm run dev
# ✅ Thành công: "Server running on port 5000"
```

### 1.2 Seed dữ liệu

```powershell
cd backend
node src/scripts/seed.js
# ✅ Thành công: In ra "🎉 Seed dữ liệu hoàn tất!" và danh sách test accounts
```

### 1.3 Công cụ test

Dùng **curl**, **Postman**, hoặc bất kỳ HTTP client nào.

- **Base URL:** `http://localhost:5000`
- **Content-Type header:** `Content-Type: application/json`
- **Auth header:** `Authorization: Bearer <token>`  

> Thay `<citizen_token>`, `<guard_token>`, `<manager_token>` bằng token nhận được từ bước đăng nhập.

---

## 2. Tài khoản test

| Role | Username | Password | Ghi chú |
|------|----------|----------|---------|
| Manager | `manager_thinh` | `password123` | Quản lý Khu A |
| Guard | `guard_nam` | `password123` | Cổng Chính Khu A |
| Citizen | `citizen_hoa` | `password123` | Căn 101, Tòa A, Khu A |

**Dữ liệu mẫu có sẵn sau seed:**
- Xe của `citizen_hoa`: `51F-123.45` (car, màu Trắng), `59A1-12345` (motorbike, màu Đen)
- OTP mẫu: `123456` (có thể đã hết hạn — tạo OTP mới khi test)
- Lanes: `MAIN-IN`, `MAIN-OUT`, `B-IN`, `B-OUT`

---

## 3. Auth

### TC-AUTH-01: Đăng nhập thành công

```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "username": "citizen_hoa",
  "password": "password123"
}
```

**✅ Thành công (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 3,
    "username": "citizen_hoa",
    "full_name": "Lê Thị Cư Dân",
    "role": "citizen"
  }
}
```
> Lưu lại `token` để dùng cho các test tiếp theo.

---

### TC-AUTH-02: Đăng nhập manager

```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "username": "manager_thinh",
  "password": "password123"
}
```

**✅ Thành công (200):** Trả về token với `"role": "manager"`

---

### TC-AUTH-03: Đăng nhập guard

```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "username": "guard_nam",
  "password": "password123"
}
```

**✅ Thành công (200):** Trả về token với `"role": "guard"`

---

### TC-AUTH-04: Lấy thông tin user hiện tại

```http
GET http://localhost:5000/api/v1/auth/me
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
{
  "user_id": 3,
  "username": "citizen_hoa",
  "full_name": "Lê Thị Cư Dân",
  "email": "citizen@smartgate.vn",
  "role": "citizen"
}
```

---

### TC-AUTH-05: Đăng nhập sai mật khẩu

```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "username": "citizen_hoa",
  "password": "wrongpassword"
}
```

**✅ Thành công (test lỗi) (401):**
```json
{ "error": "Invalid credentials" }
```

---

## 4. Citizen — Quản lý OTP & QR

### TC-CIT-01: Tạo mã OTP mới

```http
POST http://localhost:5000/api/v1/citizens/tokens
Authorization: Bearer <citizen_token>
```

**✅ Thành công (201):**
```json
{
  "token_id": 2,
  "token_data": "847291",
  "valid_from": "2026-05-16T10:00:00.000Z",
  "valid_until": "2026-05-16T10:15:00.000Z",
  "is_used": false
}
```
> `token_data` là mã 6 chữ số. `valid_until` cách `valid_from` đúng 15 phút.

---

### TC-CIT-02: Lấy danh sách OTP

```http
GET http://localhost:5000/api/v1/citizens/tokens
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
[
  {
    "token_id": 1,
    "token_data": "123456",
    "valid_from": "...",
    "valid_until": "...",
    "is_used": false
  },
  {
    "token_id": 2,
    "token_data": "847291",
    ...
  }
]
```
> Danh sách các OTP đã tạo, sắp xếp theo thời gian mới nhất.

---

### TC-CIT-03: Tạo QR token

```http
POST http://localhost:5000/api/v1/citizens/qr-code
Authorization: Bearer <citizen_token>
```

**✅ Thành công (201):**
```json
{
  "token_id": 3,
  "token_data": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "valid_from": "2026-05-16T10:00:00.000Z",
  "valid_until": "2026-05-16T10:03:00.000Z",
  "is_used": false
}
```
> `token_data` là UUID. `valid_until` cách `valid_from` đúng 3 phút.

---

## 5. Citizen — Quản lý phương tiện

### TC-CIT-04: Lấy danh sách loại xe

```http
GET http://localhost:5000/api/v1/citizens/vehicle-types
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
["car", "motorbike", "bicycle", "truck", "emergency"]
```

---

### TC-CIT-05: Lấy danh sách xe của citizen

```http
GET http://localhost:5000/api/v1/citizens/vehicles
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
[
  {
    "vehicle_id": 1,
    "license_plate": "51F-123.45",
    "vehicle_type": "car",
    "vehicle_color": "Trắng",
    "is_active": true,
    "status": "approved"
  },
  {
    "vehicle_id": 2,
    "license_plate": "59A1-12345",
    "vehicle_type": "motorbike",
    "vehicle_color": "Đen",
    "is_active": true,
    "status": "approved"
  }
]
```

---

### TC-CIT-06: Đăng ký xe mới

```http
POST http://localhost:5000/api/v1/citizens/vehicles
Authorization: Bearer <citizen_token>
Content-Type: application/json

{
  "license_plate": "43B1-99999",
  "vehicle_type": "car",
  "vehicle_color": "Xanh"
}
```

**✅ Thành công (201):**
```json
{
  "vehicle_id": 3,
  "license_plate": "43B1-99999",
  "vehicle_type": "car",
  "vehicle_color": "Xanh",
  "status": "pending",
  "is_active": false
}
```
> `status` là `"pending"` — cần manager phê duyệt.

---

### TC-CIT-07: Cập nhật thông tin xe (PUT)

```http
PUT http://localhost:5000/api/v1/citizens/vehicles/3
Authorization: Bearer <citizen_token>
Content-Type: application/json

{
  "vehicle_color": "Đỏ",
  "vehicle_type": "car"
}
```

**✅ Thành công (200):**
```json
{
  "vehicle_id": 3,
  "vehicle_color": "Đỏ",
  "vehicle_type": "car"
}
```

---

### TC-CIT-08: Cập nhật trạng thái xe (PATCH)

```http
PATCH http://localhost:5000/api/v1/citizens/vehicles/1
Authorization: Bearer <citizen_token>
Content-Type: application/json

{
  "is_active": false
}
```

**✅ Thành công (200):**
```json
{
  "vehicle_id": 1,
  "is_active": false
}
```
> Xe bị vô hiệu hóa, sẽ không được phép vào cổng cho đến khi bật lại.

---

### TC-CIT-09: Xóa xe

```http
DELETE http://localhost:5000/api/v1/citizens/vehicles/3
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
{ "message": "Vehicle deleted successfully" }
```
> Xe biển số `43B1-99999` bị xóa ngay lập tức.

---

## 6. Citizen — Đăng ký khách

### TC-CIT-10: Đăng ký khách có hẹn

```http
POST http://localhost:5000/api/v1/citizens/guests
Authorization: Bearer <citizen_token>
Content-Type: application/json

{
  "guest_name": "Nguyễn Văn Khách",
  "guest_license_plate": "77B1-11111",
  "vehicle_type": "motorbike",
  "visit_start_time": "2026-05-16T08:00:00.000Z",
  "visit_end_time": "2026-05-16T18:00:00.000Z"
}
```

**✅ Thành công (201):**
```json
{
  "registration_id": 1,
  "guest_name": "Nguyễn Văn Khách",
  "guest_license_plate": "77B1-11111",
  "visit_start_time": "2026-05-16T08:00:00.000Z",
  "visit_end_time": "2026-05-16T18:00:00.000Z"
}
```

---

### TC-CIT-11: Lấy danh sách khách đã đăng ký

```http
GET http://localhost:5000/api/v1/citizens/guests
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
[
  {
    "registration_id": 1,
    "guest_name": "Nguyễn Văn Khách",
    "guest_license_plate": "77B1-11111",
    "vehicle_type": "motorbike",
    "visit_start_time": "...",
    "visit_end_time": "..."
  }
]
```

---

### TC-CIT-12: Hủy đăng ký khách

```http
DELETE http://localhost:5000/api/v1/citizens/guests/1
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
{ "message": "Guest registration cancelled" }
```

---

## 7. Citizen — Lịch sử ra vào

### TC-CIT-13: Xem lịch sử ra vào (mặc định)

```http
GET http://localhost:5000/api/v1/citizens/logs
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):**
```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```
> Nếu chưa có access log nào thì `data` là mảng rỗng. Sau khi có log từ gates endpoint, sẽ thấy dữ liệu.

---

### TC-CIT-14: Xem lịch sử với filter thời gian

```http
GET http://localhost:5000/api/v1/citizens/logs?from=2026-05-01&to=2026-05-31&page=1&limit=10
Authorization: Bearer <citizen_token>
```

**✅ Thành công (200):** Trả về danh sách access logs trong khoảng thời gian, phân trang.

---

## 8. Guard — Xác minh OTP

### TC-GRD-01: Xác minh OTP hợp lệ

> Trước tiên tạo OTP mới bằng TC-CIT-01, ghi nhớ `token_data`.

```http
POST http://localhost:5000/api/v1/guards/verify-otp
Authorization: Bearer <guard_token>
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "otp_code": "847291"
}
```

**✅ Thành công (200):**
```json
{
  "granted": true,
  "message": "Access granted",
  "log_id": 1
}
```

---

### TC-GRD-02: Xác minh OTP đã dùng hoặc hết hạn

```http
POST http://localhost:5000/api/v1/guards/verify-otp
Authorization: Bearer <guard_token>
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "otp_code": "000000"
}
```

**✅ Thành công (test lỗi) (400 hoặc 404):**
```json
{ "error": "Invalid or expired OTP" }
```

---

## 9. Guard — Thao tác thủ công

### TC-GRD-03: Mở cổng thủ công

```http
POST http://localhost:5000/api/v1/guards/manual-action
Authorization: Bearer <guard_token>
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "action_type": "open_barrier",
  "action_reason": "Cho xe cứu thương vào",
  "note": "Xe cứu thương cấp cứu"
}
```

**✅ Thành công (200 hoặc 201):**
```json
{
  "message": "Manual action logged",
  "log_id": 2
}
```

---

### TC-GRD-04: Đóng cổng thủ công

```http
POST http://localhost:5000/api/v1/guards/manual-action
Authorization: Bearer <guard_token>
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "action_type": "close_barrier",
  "action_reason": "Đóng cổng cuối ca"
}
```

**✅ Thành công (200 hoặc 201):**
```json
{
  "message": "Manual action logged",
  "log_id": 3
}
```

---

## 10. Guard — Logs & Stats

### TC-GRD-05: Lấy danh sách lý do thao tác (dropdown)

```http
GET http://localhost:5000/api/v1/guards/action-reasons
Authorization: Bearer <guard_token>
```

**✅ Thành công (200):**
```json
{
  "action_types": ["open_barrier", "close_barrier", "deny_entry"],
  "reasons": ["Xe cứu thương", "Sự cố kỹ thuật", "Kiểm tra an ninh", ...]
}
```

---

### TC-GRD-06: Lấy logs gần đây theo lane

```http
GET http://localhost:5000/api/v1/guards/logs?lane_id=MAIN-IN&limit=10
Authorization: Bearer <guard_token>
```

**✅ Thành công (200):**
```json
[
  {
    "log_id": 1,
    "lane_id": "MAIN-IN",
    "access_method": "manual_guard",
    "is_granted": true,
    "detected_text": null,
    "created_at": "2026-05-16T10:05:00.000Z"
  }
]
```
> Danh sách các log gần nhất tại lane `MAIN-IN`.

---

### TC-GRD-07: Lấy thống kê nhanh theo lane

```http
GET http://localhost:5000/api/v1/guards/stats?lane_id=MAIN-IN
Authorization: Bearer <guard_token>
```

**✅ Thành công (200):**
```json
{
  "lane_id": "MAIN-IN",
  "total_today": 5,
  "granted_today": 4,
  "denied_today": 1
}
```

---

## 11. Guard — Đăng ký khách & AI Corrections

### TC-GRD-08: Guard đăng ký khách thay cư dân

> Cần biết `user_id` của citizen. Dùng manager endpoint `GET /managers/users` để lấy, hoặc kiểm tra DB.

```http
POST http://localhost:5000/api/v1/guards/guests
Authorization: Bearer <guard_token>
Content-Type: application/json

{
  "host_citizen_id": 3,
  "guest_name": "Trần Văn Khách",
  "guest_license_plate": "29B1-88888",
  "vehicle_type": "car",
  "visit_start_time": "2026-05-16T08:00:00.000Z",
  "visit_end_time": "2026-05-16T20:00:00.000Z"
}
```

**✅ Thành công (201):**
```json
{
  "registration_id": 2,
  "guest_name": "Trần Văn Khách",
  "guest_license_plate": "29B1-88888"
}
```

---

### TC-GRD-09: Guard báo cáo AI đọc sai biển số

> Cần có `log_id` từ một access log do AI tạo ra (xem TC-GATE-01).

```http
POST http://localhost:5000/api/v1/guards/ai-corrections
Authorization: Bearer <guard_token>
Content-Type: application/json

{
  "log_id": 1,
  "corrected_plate_text": "51F-123.45"
}
```

**✅ Thành công (200 hoặc 201):**
```json
{
  "message": "AI correction recorded",
  "correction_id": 1
}
```

---

## 12. Manager — Phê duyệt xe

### TC-MAN-01: Lấy danh sách xe chờ phê duyệt

> Trước tiên đăng ký xe mới từ citizen (TC-CIT-06) để có xe ở trạng thái `pending`.

```http
GET http://localhost:5000/api/v1/managers/vehicles/pending
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{
  "data": [
    {
      "vehicle_id": 3,
      "license_plate": "43B1-99999",
      "vehicle_type": "car",
      "vehicle_color": "Đỏ",
      "status": "pending",
      "owner_name": "Lê Thị Cư Dân",
      "owner_username": "citizen_hoa"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### TC-MAN-02: Phê duyệt xe

```http
POST http://localhost:5000/api/v1/managers/vehicles/3/approve
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{ "message": "Vehicle approved", "vehicle_id": 3 }
```
> Xe chuyển sang `status: "approved"`, `is_active: true`.

---

### TC-MAN-03: Từ chối xe

> Đăng ký thêm 1 xe mới (TC-CIT-06 với biển số khác) để test từ chối.

```http
POST http://localhost:5000/api/v1/managers/vehicles/4/reject
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "reason": "Biển số không hợp lệ"
}
```

**✅ Thành công (200):**
```json
{ "message": "Vehicle rejected", "vehicle_id": 4 }
```
> Xe chuyển sang `status: "rejected"`.

---

## 13. Manager — Analytics

### TC-MAN-04: Tổng quan dashboard

```http
GET http://localhost:5000/api/v1/managers/analytics/overview
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{
  "total_vehicles_registered": 2,
  "total_access_today": 5,
  "granted_today": 4,
  "denied_today": 1,
  "pending_approvals": 0
}
```

---

### TC-MAN-05: Thống kê theo ngày (7 ngày gần nhất)

```http
GET http://localhost:5000/api/v1/managers/analytics/traffic-by-day?days=7
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
[
  { "date": "2026-05-10", "total": 12, "granted": 10, "denied": 2 },
  { "date": "2026-05-11", "total": 8, "granted": 7, "denied": 1 },
  ...
]
```
> Mảng 7 phần tử, mỗi phần tử là 1 ngày. Nếu không có traffic thì `total = 0`.

---

### TC-MAN-06: Thống kê theo giờ

```http
GET http://localhost:5000/api/v1/managers/analytics/traffic-by-hour
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
[
  { "hour": 0, "total": 0 },
  { "hour": 1, "total": 0 },
  ...
  { "hour": 10, "total": 3 },
  ...
]
```
> Mảng 24 phần tử (giờ 0–23).

---

### TC-MAN-07: Phân bố loại xe

```http
GET http://localhost:5000/api/v1/managers/analytics/vehicle-types
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
[
  { "vehicle_type": "car", "count": 3 },
  { "vehicle_type": "motorbike", "count": 2 }
]
```

---

### TC-MAN-08: Phân bố phương thức truy cập

```http
GET http://localhost:5000/api/v1/managers/analytics/access-methods
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
[
  { "access_method": "manual_guard", "count": 3 },
  { "access_method": "ai_plate_recognition", "count": 2 }
]
```

---

## 14. Manager — Logs & Audit

### TC-MAN-09: Tìm kiếm access logs

```http
GET http://localhost:5000/api/v1/managers/logs?page=1&limit=10
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{
  "data": [
    {
      "log_id": 1,
      "lane_id": "MAIN-IN",
      "license_plate": null,
      "access_method": "manual_guard",
      "is_granted": true,
      "created_at": "2026-05-16T10:05:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### TC-MAN-10: Tìm kiếm logs với filter

```http
GET http://localhost:5000/api/v1/managers/logs?is_granted=true&access_method=manual_guard&limit=5
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):** Chỉ trả về logs được cấp phép qua manual guard.

---

### TC-MAN-11: Xem chi tiết 1 log

```http
GET http://localhost:5000/api/v1/managers/logs/1
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{
  "log_id": 1,
  "lane_id": "MAIN-IN",
  "access_method": "manual_guard",
  "is_granted": true,
  "action_reason": "Xe cứu thương",
  "note": "Xe cứu thương cấp cứu",
  "image_base64": null,
  "created_at": "2026-05-16T10:05:00.000Z"
}
```

---

### TC-MAN-12: Xem audit logs

```http
GET http://localhost:5000/api/v1/managers/audit-logs?page=1&limit=10
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{
  "data": [
    {
      "audit_id": 1,
      "actor_id": 1,
      "actor_name": "Nguyễn Văn Quản Lý",
      "action": "approve_vehicle",
      "target": "vehicle_id=3",
      "created_at": "..."
    }
  ],
  "total": 1
}
```

---

## 15. Manager — Thao tác thủ công & Gates

### TC-MAN-13: Xem danh sách cổng

```http
GET http://localhost:5000/api/v1/managers/gates
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
[
  {
    "gate_id": 1,
    "gate_name": "Cổng Chính Khu A",
    "is_active": true,
    "lanes": [
      { "lane_id": "MAIN-IN", "lane_name": "Cổng Chính A - Làn Vào", "direction": "inbound" },
      { "lane_id": "MAIN-OUT", "lane_name": "Cổng Chính A - Làn Ra", "direction": "outbound" }
    ]
  },
  {
    "gate_id": 2,
    "gate_name": "Cổng Khu B",
    "is_active": true,
    "lanes": [...]
  }
]
```

---

### TC-MAN-14: Manager mở cổng khẩn cấp

```http
POST http://localhost:5000/api/v1/managers/manual-action
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "action_type": "open_barrier",
  "action_reason": "Sự cố hệ thống",
  "note": "Mở khẩn cấp do mất điện"
}
```

**✅ Thành công (200 hoặc 201):**
```json
{ "message": "Manual action logged", "log_id": 4 }
```

---

### TC-MAN-15: Xem hiệu năng AI

```http
GET http://localhost:5000/api/v1/managers/ai/performance
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{
  "total_ai_logs": 10,
  "correct_recognitions": 9,
  "corrections_submitted": 1,
  "accuracy_rate": 0.9
}
```

---

### TC-MAN-16: Manager đăng ký khách thay cư dân

```http
POST http://localhost:5000/api/v1/managers/guests
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "host_citizen_id": 3,
  "guest_name": "Phạm Thị Khách",
  "guest_license_plate": "51H-55555",
  "vehicle_type": "car",
  "visit_start_time": "2026-05-17T08:00:00.000Z",
  "visit_end_time": "2026-05-17T20:00:00.000Z"
}
```

**✅ Thành công (201):**
```json
{
  "registration_id": 3,
  "guest_name": "Phạm Thị Khách",
  "guest_license_plate": "51H-55555"
}
```

---

## 16. Manager — Quản lý người dùng

### TC-MAN-17: Lấy danh sách users

```http
GET http://localhost:5000/api/v1/managers/users
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{
  "data": [
    { "user_id": 1, "username": "manager_thinh", "full_name": "Nguyễn Văn Quản Lý", "role": "manager" },
    { "user_id": 2, "username": "guard_nam",      "full_name": "Trần Văn Bảo Vệ",    "role": "guard" },
    { "user_id": 3, "username": "citizen_hoa",    "full_name": "Lê Thị Cư Dân",      "role": "citizen" }
  ],
  "total": 3
}
```

---

### TC-MAN-18: Lọc users theo role

```http
GET http://localhost:5000/api/v1/managers/users?role=citizen
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):** Chỉ trả về danh sách citizens.

---

### TC-MAN-19: Tạo user mới (citizen)

```http
POST http://localhost:5000/api/v1/managers/users
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "username": "citizen_test01",
  "password": "password123",
  "full_name": "Test Citizen",
  "email": "test01@smartgate.vn",
  "role": "citizen",
  "role_details": {
    "zone_id": 1,
    "address": "Tòa B, Tầng 2, Căn 201",
    "phone_number": "0987654321"
  }
}
```

**✅ Thành công (201):**
```json
{
  "user_id": 4,
  "username": "citizen_test01",
  "full_name": "Test Citizen",
  "role": "citizen"
}
```

---

### TC-MAN-20: Tạo user mới (guard)

```http
POST http://localhost:5000/api/v1/managers/users
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "username": "guard_test01",
  "password": "password123",
  "full_name": "Test Guard",
  "email": "guard01@smartgate.vn",
  "role": "guard",
  "role_details": {
    "assigned_gate_id": 1,
    "employee_code": "GD002",
    "shift_start": "14:00:00",
    "shift_end": "22:00:00"
  }
}
```

**✅ Thành công (201):** Trả về user mới với `"role": "guard"`.

---

### TC-MAN-21: Cập nhật thông tin user (PATCH)

```http
PATCH http://localhost:5000/api/v1/managers/users/4
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "full_name": "Test Citizen Updated",
  "email": "test01_updated@smartgate.vn"
}
```

**✅ Thành công (200):**
```json
{
  "user_id": 4,
  "username": "citizen_test01",
  "full_name": "Test Citizen Updated",
  "email": "test01_updated@smartgate.vn",
  "role": "citizen"
}
```

---

### TC-MAN-22: Cập nhật password user

```http
PATCH http://localhost:5000/api/v1/managers/users/4
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "password": "newpassword456"
}
```

**✅ Thành công (200):** Trả về thông tin user. Sau đó thử login với password mới để xác nhận.

---

### TC-MAN-23: Manager không thể tự xóa mình

```http
DELETE http://localhost:5000/api/v1/managers/users/1
Authorization: Bearer <manager_token>
```

**✅ Thành công (test lỗi) (400):**
```json
{ "error": "Cannot delete your own account" }
```

---

### TC-MAN-24: Xóa user

```http
DELETE http://localhost:5000/api/v1/managers/users/4
Authorization: Bearer <manager_token>
```

**✅ Thành công (200):**
```json
{ "message": "User deleted successfully" }
```
> User `citizen_test01` bị xóa hoàn toàn, bao gồm cả record trong bảng `citizens`.

---

## 17. Gates — AI Service Endpoints

> Các endpoint này thường được gọi từ Python AI service, không cần auth token. Test bằng cách giả lập request từ AI service.

### TC-GATE-01: AI nhận dạng biển số (check-in)

```http
POST http://localhost:5000/api/v1/gates/check-in
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "plate_text": "51F-123.45",
  "confidence_score": 0.95,
  "image_base64": null
}
```

**✅ Thành công — Xe được phép vào (200):**
```json
{
  "granted": true,
  "message": "Access granted",
  "vehicle_type": "car",
  "log_id": 5
}
```

---

### TC-GATE-02: AI nhận dạng biển số không có trong whitelist

```http
POST http://localhost:5000/api/v1/gates/check-in
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "plate_text": "99Z-99999",
  "confidence_score": 0.92,
  "image_base64": null
}
```

**✅ Thành công (test từ chối) (200):**
```json
{
  "granted": false,
  "message": "Vehicle not in whitelist",
  "log_id": 6
}
```

---

### TC-GATE-03: Camera xác thực OTP 6 số

> Tạo OTP mới bằng TC-CIT-01, dùng `token_data` nhận được.

```http
POST http://localhost:5000/api/v1/gates/verify-camera-otp
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "token_data": "847291",
  "code_type": "otp_6digit",
  "image_base64": null
}
```

**✅ Thành công (200):**
```json
{
  "granted": true,
  "message": "OTP verified, access granted",
  "log_id": 7
}
```

---

### TC-GATE-04: Camera xác thực QR UUID

> Tạo QR token bằng TC-CIT-03 (lưu ý hạn 3 phút), dùng `token_data` nhận được.

```http
POST http://localhost:5000/api/v1/gates/verify-camera-otp
Content-Type: application/json

{
  "lane_id": "MAIN-IN",
  "token_data": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "code_type": "qr_uuid",
  "image_base64": null
}
```

**✅ Thành công (200):**
```json
{
  "granted": true,
  "message": "QR verified, access granted",
  "log_id": 8
}
```

---

### TC-GATE-05: Lấy thông tin cổng (heartbeat)

```http
GET http://localhost:5000/api/v1/gates/1
```

**✅ Thành công (200):**
```json
{
  "gate_id": 1,
  "gate_name": "Cổng Chính Khu A",
  "is_active": true,
  "lanes": [
    { "lane_id": "MAIN-IN", "direction": "inbound" },
    { "lane_id": "MAIN-OUT", "direction": "outbound" }
  ]
}
```

---

## 18. Kiểm thử lỗi phổ biến

### TC-ERR-01: Gọi API không có token

```http
GET http://localhost:5000/api/v1/citizens/vehicles
```

**✅ Thành công (test lỗi) (401):**
```json
{ "error": "No token provided" }
```

---

### TC-ERR-02: Gọi API với token sai role

> Dùng `citizen_token` gọi endpoint của guard.

```http
GET http://localhost:5000/api/v1/guards/logs
Authorization: Bearer <citizen_token>
```

**✅ Thành công (test lỗi) (403):**
```json
{ "error": "Forbidden" }
```

---

### TC-ERR-03: Gọi API với token hết hạn

> Dùng một token JWT đã hết hạn (sau 7 ngày).

```http
GET http://localhost:5000/api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.EXPIRED_PAYLOAD.SIGNATURE
```

**✅ Thành công (test lỗi) (401):**
```json
{ "error": "Token expired" }
```

---

### TC-ERR-04: Đăng ký xe trùng biển số

```http
POST http://localhost:5000/api/v1/citizens/vehicles
Authorization: Bearer <citizen_token>
Content-Type: application/json

{
  "license_plate": "51F-123.45",
  "vehicle_type": "car",
  "vehicle_color": "Trắng"
}
```

**✅ Thành công (test lỗi) (409 hoặc 400):**
```json
{ "error": "License plate already exists" }
```

---

### TC-ERR-05: Tạo username trùng

```http
POST http://localhost:5000/api/v1/managers/users
Authorization: Bearer <manager_token>
Content-Type: application/json

{
  "username": "citizen_hoa",
  "password": "password123",
  "full_name": "Duplicate User",
  "role": "citizen"
}
```

**✅ Thành công (test lỗi) (409 hoặc 400):**
```json
{ "error": "Username already exists" }
```

---

## Thứ tự test đề xuất

Để đảm bảo test có dữ liệu liên kết, thực hiện theo thứ tự sau:

```
1.  TC-AUTH-02  → Lấy manager_token
2.  TC-AUTH-03  → Lấy guard_token
3.  TC-AUTH-01  → Lấy citizen_token
4.  TC-AUTH-04  → Xác nhận /me
5.  TC-CIT-01   → Tạo OTP (ghi nhớ token_data)
6.  TC-CIT-03   → Tạo QR (ghi nhớ token_data, dùng ngay)
7.  TC-GATE-03  → Xác thực OTP qua camera
8.  TC-GATE-01  → AI check-in biển số 51F-123.45
9.  TC-CIT-13   → Kiểm tra lịch sử ra vào (có log từ bước 8)
10. TC-CIT-06   → Đăng ký xe mới 43B1-99999 (pending)
11. TC-MAN-01   → Xem xe pending
12. TC-MAN-02   → Phê duyệt xe
13. TC-GRD-03   → Mở cổng thủ công
14. TC-GRD-06   → Xem logs tại MAIN-IN
15. TC-GRD-09   → Báo AI sai (dùng log_id từ bước 8)
16. TC-MAN-12   → Xem audit logs
17. TC-MAN-19   → Tạo user mới
18. TC-MAN-21   → Cập nhật user
19. TC-MAN-24   → Xóa user
20. TC-MAN-23   → Thử tự xóa mình (phải thất bại)
```
