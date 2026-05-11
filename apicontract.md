# Smart Toll Gate — API Contract

> **Dự án:** HK252 IoT Multidisciplinary Project  
> **Phiên bản:** 2.0 (Cập nhật theo `report.md`)  
> **Base URL:** `http://localhost:5000`  
> **Xác thực:** JWT Bearer Token — `Authorization: Bearer <token>`  
> **Ký hiệu:** ✅ Đã implement · ❌ Chưa implement (cần bổ sung)

---

## Tổng quan kiến trúc API

```
Frontend (React) ──HTTP/WS──► Backend (Node.js :5000) ──HTTP──► AI Service (Python)
                                       │
                              ┌────────┼────────┐
                              ▼        ▼        ▼
                          PostgreSQL  IoT     Audit
                          (DB :5433) Gateway  Logs
                                    (:8080)
```

Hệ thống có **5 nhóm route** phục vụ 3 role người dùng và 1 kênh giao tiếp AI/IoT:

| Nhóm Route | File | Role |
|------------|------|------|
| `/api/v1/auth` | `auth.routes.js` | Tất cả |
| `/api/v1/citizens` | `citizens.routes.js` | Citizen |
| `/api/v1/guards` | `guards.routes.js` | Guard |
| `/api/v1/managers` | `managers.routes.js` | Manager |
| `/api/v1/gates` | `gates.routes.js` | AI Service / IoT Gateway |

---

## 1. Authentication (`auth.routes.js`)

### ✅ POST `/api/v1/auth/login`
Đăng nhập hệ thống, trả về JWT.

**Request Body:**
```json
{ "username": "string", "password": "string" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "role": "citizen | guard | manager",
    "full_name": "string",
    "access_token": "eyJ..."
  }
}
```

**Response 401:** `{ "success": false, "message": "Tên đăng nhập hoặc mật khẩu không đúng" }`

---

### ✅ GET `/api/v1/auth/me`
Lấy thông tin tài khoản đang đăng nhập.

**Header:** `Authorization: Bearer <token>`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "username": "string",
    "full_name": "string",
    "email": "string",
    "role": "citizen | guard | manager"
  }
}
```

---

## 2. Citizen API (`citizens.routes.js`)

> **Yêu cầu header:** `Authorization: Bearer <token>` (role: `citizen`)

### 2.1 Quản lý phương tiện (UC-01)

#### ✅ GET `/api/v1/citizens/vehicles`
Lấy danh sách xe đã đăng ký của cư dân hiện tại.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "vehicle_id": "uuid",
      "license_plate": "51A-12345",
      "vehicle_type": "car | motorbike | bicycle | truck | emergency",
      "vehicle_color": "string",
      "is_active": true,
      "status": "approved | pending_new | pending_update | pending_delete",
      "is_inside": false,
      "last_log_time": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

#### ✅ GET `/api/v1/citizens/vehicle-types`
Lấy danh mục loại xe hợp lệ (enum reference).

**Response 200:**
```json
{
  "success": true,
  "data": [
    "car",
    "motorbike",
    "bicycle",
    "truck",
    "emergency"
  ]
}
```

---

#### ✅ POST `/api/v1/citizens/vehicles`
Đăng ký phương tiện mới, trạng thái mặc định `is_active = false` — chờ Manager duyệt (UC-09).

**Request Body:**
```json
{
  "license_plate": "51A-12345",
  "vehicle_type": "car",
  "vehicle_color": "Trắng"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Đăng ký xe thành công",
  "data": {
    "vehicle_id": "uuid",
    "license_plate": "51A-12345",
    "vehicle_type": "car",
    "vehicle_color": "Trắng",
    "is_active": false,
    "registered_at": "2026-01-05T10:00:00Z"
  }
}
```

**Response 409:** `{ "success": false, "message": "Biển số xe này đã được đăng ký trong hệ thống" }`

---

#### ✅ PUT `/api/v1/citizens/vehicles/:vehicleId`
Cập nhật thông tin phương tiện. Sau khi cập nhật thành công, xe sẽ chuyển sang trạng thái `pending_update` (is_active = false) và lưu các thay đổi vào `pending_changes` để Manager duyệt lại.

**Request Body:**
```json
{
  "license_plate": "51A-67890",
  "vehicle_type": "car",
  "vehicle_color": "Đen"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Cập nhật thông tin xe thành công, xe cần chờ Quản lý duyệt lại.",
  "data": {
    "vehicle_id": "uuid",
    "license_plate": "51A-67890",
    "is_active": false,
    "status": "pending_update"
  }
}
```

**Response 409:** `{ "success": false, "message": "Biển số xe này đã được đăng ký cho xe khác trong hệ thống" }`

---

#### ✅ PATCH `/api/v1/citizens/vehicles/:vehicleId`
Cập nhật trạng thái xe (`active` / `inactive`).

**Request Body:**
```json
{ "is_active": false }
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã kích hoạt xe | Đã vô hiệu hóa xe",
  "data": {
    "vehicle_id": "uuid",
    "is_active": false
  }
}
```

---

#### ✅ DELETE `/api/v1/citizens/vehicles/:vehicleId`
Xóa phương tiện cá nhân ngay lập tức (không cần Manager phê duyệt).

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa xe thành công.",
  "data": { "vehicle_id": 1, "license_plate": "51A-12345" }
}
```

**Response 404:** `{ "success": false, "message": "Không tìm thấy xe hoặc bạn không có quyền xóa" }`

---

### 2.2 Quản lý khách hẹn trước (UC-02)

#### ✅ GET `/api/v1/citizens/guests`
Xem danh sách khách có hẹn của cư dân.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "registration_id": "uuid",
      "guest_name": "Nguyễn Văn A",
      "guest_license_plate": "29A-99999",
      "vehicle_type": "motorbike",
      "visit_start_time": "2026-01-10T08:00:00Z",
      "visit_end_time": "2026-01-10T20:00:00Z",
      "status": "approved"
    }
  ]
}
```

---

#### ✅ POST `/api/v1/citizens/guests`
Đăng ký khách có hẹn (tạo temporary whitelist).

**Request Body:**
```json
{
  "guest_name": "Nguyễn Văn A",
  "guest_license_plate": "29A-99999",
  "vehicle_type": "motorbike",
  "visit_start_time": "2026-01-10T08:00:00Z",
  "visit_end_time": "2026-01-10T20:00:00Z"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Đã thêm khách vào danh sách Whitelist tạm thời.",
  "data": {
    "registration_id": "uuid",
    "status": "approved"
  }
}
```

**Response 409:** `{ "success": false, "message": "Biển số xe này đã được đăng ký trong khung giờ trùng lặp" }`

---

#### ✅ DELETE `/api/v1/citizens/guests/:registrationId`
Hủy lịch hẹn khách.

**Response 200:** `{ "success": true, "message": "Đã hủy đăng ký khách" }`

---

### 2.3 Mã OTP khẩn cấp (UC-03)

#### ✅ POST `/api/v1/citizens/tokens`
Tạo mã OTP 6 số cho khách đột xuất (hiệu lực 15 phút).

**Response 201:**
```json
{
  "success": true,
  "data": {
    "token_id": "uuid",
    "otp_code": "482917",
    "valid_from": "2026-01-10T10:00:00Z",
    "valid_until": "2026-01-10T10:15:00Z"
  }
}
```

---

#### ✅ GET `/api/v1/citizens/tokens`
Lấy danh sách OTP cá nhân đã tạo.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "token_id": "uuid",
      "token_data": "482917",
      "valid_from": "2026-01-10T10:00:00Z",
      "valid_until": "2026-01-10T10:15:00Z",
      "is_used": false,
      "used_at": null,
      "status": "active"
    }
  ]
}
```

---

### 2.4 Lịch sử cá nhân (UC-04)

#### ✅ GET `/api/v1/citizens/logs`
Xem lịch sử ra vào của tất cả xe thuộc sở hữu của cư dân.

**Query Params:** `?page=1&limit=20&from=2026-01-01&to=2026-01-31`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "page": 1,
    "data": [
      {
        "log_id": "uuid",
        "license_plate": "51A-12345",
        "gate_name": "Cổng chính",
        "lane_name": "Làn vào",
        "check_in_time": "2026-01-10T08:05:00Z",
        "access_method": "ai_plate_recognition",
        "action_reason": null
      }
    ]
  }
}
```

---

### 2.5 Mã QR định danh cá nhân (UC-15)

#### ✅ POST `/api/v1/citizens/qr-code`
Tạo mã QR động chứa UUID cá nhân, hết hạn sau 3 phút. Dùng cho cư dân đi bộ/xe đạp quét Camera tại cổng phụ (Scenario 4).

**Response 201:**
```json
{
  "success": true,
  "data": {
    "token_id": "uuid",
    "qr_data": "base64_encoded_qr_image",
    "valid_from": "2026-01-10T10:00:00Z",
    "valid_until": "2026-01-10T10:03:00Z"
  }
}
```

---

## 3. Guard API (`guards.routes.js`)

> **Yêu cầu header:** `Authorization: Bearer <token>` (role: `guard`)

### 3.1 Giám sát Real-time (UC-05)

#### ✅ GET `/api/v1/guards/logs`
Lấy 20 log gần nhất của cổng Guard đang trực — dùng để render bảng Dashboard thời gian thực.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "log_id": "uuid",
      "check_in_time": "2026-01-10T08:05:00Z",
      "detected_text": "51A-12345",
      "access_method": "ai_plate_recognition",
      "action_reason": null,
      "note": null,
      "lane_name": "Làn vào",
      "gate_name": "Cổng chính",
      "license_plate": "51A-12345",
      "guard_name": null
    }
  ]
}
```

---

#### ✅ GET `/api/v1/guards/stats`
Thống kê lượt vào/ra và cảnh báo của cổng trong ca trực hiện tại.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "last_hour": 15,
    "last_24h": 120,
    "granted_24h": 117,
    "denied_24h": 3
  }
}
```

---

### 3.2 OTP Thủ công (UC-06 fallback)

#### ✅ POST `/api/v1/guards/verify-otp`
Guard nhập tay mã OTP khi Camera OCR không đọc được.

**Request Body:**
```json
{ "lane_id": "MAIN-IN", "otp_code": "482917" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "action": "OPEN",
    "message": "Mã hợp lệ. Đã ghi log hệ thống.",
    "log_id": "uuid",
    "guest_info": {
      "host_name": "Nguyễn Thị B",
      "host_phone": "0901234567",
      "address": "A-101"
    }
  }
}
```

**Response 400:** `{ "success": false, "data": { "action": "KEEP_CLOSED", "message": "Mã OTP đã hết hạn" } }`

---

### 3.3 Thao tác thủ công (UC-07)

#### ✅ POST `/api/v1/guards/manual-action`
Guard mở/đóng cổng thủ công. **Bắt buộc chọn `action_reason`.**

**Request Body:**
```json
{
  "lane_id": "MAIN-IN",
  "action_type": "open_barrier | close_barrier | log_event",
  "action_reason": "emergency_vehicle | shipper_delivery | ai_error | security_alert",
  "note": "...",
  "image_base64": "..."
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã mở cổng và ghi nhận thao tác thủ công.",
  "data": {
    "action": "OPEN",
    "log_id": "uuid",
    "check_in_time": "2026-01-10T08:05:00Z"
  }
}
```

---

#### ✅ GET `/api/v1/guards/action-reasons`
Lấy danh sách lý do mặc định cho thao tác thủ công.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "action_types": ["open_barrier", "close_barrier", "log_event"],
    "common_reasons": ["emergency_vehicle", "shipper_delivery", "ai_error", "vip_guest", "maintenance", "other"]
  }
}
```

---

### 3.4 Sửa lỗi nhận dạng AI (UC-08)

#### ✅ POST `/api/v1/guards/ai-corrections`
Guard báo cáo biển số AI đọc sai, cập nhật cột `note` trong `access_logs`.

**Request Body:**
```json
{
  "log_id": "uuid",
  "corrected_plate_text": "51A-12346"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã ghi nhận sửa biển số",
  "data": {
    "log_id": "uuid"
  }
}
```

---

### 3.5 Đăng ký khách thay cư dân (UC-02 Guard)

#### ✅ POST `/api/v1/guards/guests`
Guard đăng ký thông tin khách tại cổng thay cho cư dân (khi cư dân yêu cầu qua điện thoại).

**Request Body:**
```json
{
  "host_citizen_id": "uuid",
  "guest_name": "Nguyễn Văn A",
  "guest_license_plate": "29A-99999",
  "vehicle_type": "motorbike",
  "visit_start_time": "2026-01-10T08:00:00Z",
  "visit_end_time": "2026-01-10T20:00:00Z"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Đã đăng ký khách thành công",
  "data": {
    "registration_id": "uuid",
    "status": "approved"
  }
}
```

---

## 4. Manager API (`managers.routes.js`)

> **Yêu cầu header:** `Authorization: Bearer <token>` (role: `manager`)

### 4.1 Phê duyệt phương tiện (UC-09)

#### ✅ GET `/api/v1/managers/vehicles/pending`
Danh sách xe đang chờ phê duyệt trong zone quản lý (Bao gồm đăng ký mới, yêu cầu cập nhật, yêu cầu xóa).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "vehicle_id": "uuid",
        "license_plate": "51A-12345",
        "vehicle_type": "car",
        "vehicle_color": "Trắng",
        "last_log_time": null,
        "registered_at": "2026-01-05T10:00:00Z",
        "is_active": false,
        "status": "pending_new | pending_update | pending_delete",
        "pending_changes": null,
        "owner_name": "Trần Văn C",
        "owner_email": "tranvanc@example.com",
        "owner_phone": "0901234567",
        "owner_address": "A-101",
        "zone_name": "Khu A"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "total_pages": 1
    }
  }
}
```

---

#### ✅ POST `/api/v1/managers/vehicles/:id/approve`
Phê duyệt xe (Xử lý cho cả đăng ký mới, cập nhật thông tin và yêu cầu xóa).

**Response 200:**
```json
{
  "success": true,
  "message": "Đã phê duyệt thông tin xe thành công. | Đã phê duyệt yêu cầu xóa. Xe đã được gỡ khỏi hệ thống.",
  "data": {
    "vehicle_id": "uuid",
    "license_plate": "51A-12345",
    "is_active": true
  }
}
```

---

#### ✅ POST `/api/v1/managers/vehicles/:id/reject`
Từ chối xe kèm lý do. `reason` là **bắt buộc**. Citizen sẽ nhận thông báo qua WebSocket event `vehicle_status_changed`.

**Request Body:**
```json
{ "reason": "Biển số không hợp lệ." }
```
> **Lưu ý:** `reason` bắt buộc. Thiếu sẽ trả về 400.

**Response 200:** 
```json
{
  "success": true,
  "message": "Đã từ chối và xóa đăng ký xe mới. | Đã từ chối bản cập nhật, khôi phục lại trạng thái xe cũ.",
  "data": {
    "vehicle_id": "uuid",
    "license_plate": "51A-12345"
  }
}
```
> Chỉ xử lý `pending_new` và `pending_update`. `pending_delete` không còn tồn tại (citizen xóa trực tiếp).

---

### 4.2 Dashboard KPIs (UC-10)

#### ✅ GET `/api/v1/managers/analytics/overview`
4 KPIs cốt lõi trên Manager Dashboard.

**Query Params:** `?period=day|week|month` (default: `day`)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "zone_name": "Khu A",
    "department": "Ban Quản lý",
    "stats": {
      "total_traffic": 320,
      "automation_rate_percent": 87.5,
      "security_alerts": 12,
      "vehicles_inside": 8,
      "period": "day"
    }
  }
}
```

> - `total_traffic`: COUNT access_logs trong period (day = hôm nay, week = 7 ngày, month = 30 ngày)
> - `automation_rate_percent`: % log có `access_method IN ('ai_plate_recognition','ai_camera_otp','ai_camera_qr') AND (vehicle_id OR guest_reg_id OR token_id IS NOT NULL)`
> - `security_alerts`: COUNT log mà cả `vehicle_id`, `guest_reg_id`, `token_id` đều NULL (từ chối)
> - `vehicles_inside`: COUNT vehicles WHERE `is_inside = true AND is_active = true` trong zone (real-time, không phụ thuộc period)

---

#### ✅ GET `/api/v1/managers/analytics/traffic-by-day`
Lưu lượng ra vào theo từng ngày (7 hoặc 30 ngày gần nhất).

**Query Params:** `?days=7`

**Response 200:**
```json
[
  { "date": "2026-01-10", "total": 310, "granted": 298, "denied": 12 }
]
```

---

#### ✅ GET `/api/v1/managers/analytics/traffic-by-hour`
Phân bố lưu lượng theo từng khung giờ trong ngày.

**Response 200:**
```json
[
  { "hour": 7, "total": 45 },
  { "hour": 8, "total": 120 }
]
```

---

#### ✅ GET `/api/v1/managers/analytics/vehicle-types`
Phân bổ loại phương tiện (dữ liệu cho biểu đồ tròn).

**Response 200:**
```json
[
  { "vehicle_type": "motorbike", "count": 180 },
  { "vehicle_type": "car",       "count": 95 }
]
```

---

#### ✅ GET `/api/v1/managers/analytics/access-methods`
Tỉ lệ các phương thức qua cổng.

**Response 200:**
```json
[
  { "method": "ai_plate_recognition", "count": 260 },
  { "method": "ai_camera_otp",        "count": 42 },
  { "method": "ai_camera_qr",         "count": 8 },
  { "method": "manual_guard",         "count": 10 }
]
```

---

### 4.3 Tra cứu lịch sử (UC-11)

#### ✅ GET `/api/v1/managers/logs`
Tra cứu toàn bộ access logs với bộ lọc đa tiêu chí.

**Query Params:**
| Param | Type | Mô tả |
|-------|------|-------|
| `page` | int | Trang (default: 1) |
| `limit` | int | Số bản ghi/trang (default: 20) |
| `from` | ISO date | Từ ngày |
| `to` | ISO date | Đến ngày |
| `gate_id` | uuid | Lọc theo cổng |
| `access_method` | string | Lọc theo phương thức |
| `license_plate` | string | Tìm theo biển số |
| `granted` | boolean | Lọc granted/denied |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "log_id": "uuid",
        "check_in_time": "2026-01-10T08:05:00Z",
        "detected_text": "51A-12345",
        "access_method": "ai_plate_recognition",
        "action_reason": null,
        "note": null,
        "lane_name": "Làn vào",
        "direction": "inbound",
        "gate_name": "Cổng chính",
        "license_plate": "51A-12345",
        "guard_name": null
      }
    ],
    "pagination": { "total": 1200, "page": 1, "limit": 50, "total_pages": 24 }
  }
}
```

---

#### ✅ GET `/api/v1/managers/logs/:id`
Chi tiết log kèm ảnh snapshot dạng Base64.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "log_id": "uuid",
    "check_in_time": "2026-01-10T08:05:00Z",
    "detected_text": "51A-12345",
    "access_method": "ai_plate_recognition",
    "action_reason": null,
    "note": null,
    "image_snapshot": "data:image/jpeg;base64,/9j/...",
    "lane_id": "MAIN-IN",
    "lane_name": "Làn vào",
    "direction": "inbound",
    "gate_id": 1,
    "gate_name": "Cổng chính",
    "vehicle_id": 1,
    "license_plate": "51A-12345",
    "vehicle_type": "car",
    "vehicle_color": "Trắng",
    "vehicle_owner_name": "Trần Văn C",
    "guard_name": null,
    "guest_name": null
  }
}
```

---

#### ✅ GET `/api/v1/managers/audit-logs`
Lịch sử thao tác của người dùng trên hệ thống (audit trail).

**Query Params:** `?actor_id=uuid&action_type=APPROVE_VEHICLE&from=...&to=...`

**Response 200:**
```json
[
  {
    "audit_id": "uuid",
    "actor": { "user_id": "uuid", "full_name": "Manager A" },
    "action_type": "APPROVE_VEHICLE",
    "target_table": "vehicles",
    "target_id": "uuid",
    "action_details": { "license_plate": "51A-12345" },
    "performed_at": "2026-01-10T09:00:00Z"
  }
]
```

---

### 4.4 Quản lý cổng & IoT (UC-12)

#### ✅ GET `/api/v1/managers/gates`
Danh sách cổng vật lý và thiết bị IoT.

**Response 200:**
```json
[
  {
    "gate_id": "uuid",
    "gate_name": "Cổng chính",
    "zone_name": "Khu A",
    "is_active": true,
    "lanes": [
      { "lane_id": "MAIN-IN", "lane_name": "Làn vào", "direction": "inbound" }
    ]
  }
]
```

---

#### ✅ GET `/api/v1/managers/ai/performance`
Đánh giá hiệu suất AI dựa trên access_logs (30 ngày gần nhất).

**Response 200:**
```json
{
  "total_ai_events": 1500,
  "successful_recognitions": 1380,
  "accuracy_rate_percent": 92.0,
  "corrections_submitted": 25
}
```

---

### 4.5 Thao tác thủ công của Manager (UC-07 Override)

#### ✅ POST `/api/v1/managers/manual-action`
Manager mở/đóng cổng khẩn cấp, có thể override bất kỳ cổng nào trong zone quản lý (không bị giới hạn bởi lane được assign như Guard).

**Request Body:**
```json
{
  "lane_id": "MAIN-IN",        // ← đổi từ gate_id sang lane_id để tường minh
  "action_type": "open_barrier | close_barrier",
  "action_reason": "...",
  "note": "..."
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã mở cổng và ghi log",
  "data": { "log_id": "uuid" }
}
```

---

### 4.6 Đăng ký khách thay cư dân — Manager (UC-02 Override)

#### ✅ POST `/api/v1/managers/guests`
Manager đăng ký thông tin khách cho bất kỳ cư dân nào trong zone.

**Request Body:**
```json
{
  "host_citizen_id": "uuid",
  "guest_name": "Nguyễn Văn A",
  "guest_license_plate": "29A-99999",
  "vehicle_type": "motorbike",
  "visit_start_time": "2026-01-10T08:00:00Z",
  "visit_end_time": "2026-01-10T20:00:00Z"
}
```

**Response 201:** `{ "registration_id": "uuid", "status": "approved" }`

---

### 4.7 Quản lý người dùng (FR_MAN_07)

#### ✅ GET `/api/v1/managers/users`
Danh sách users trong zone (citizens, guards, managers).

**Query Params:** `?role=citizen|guard|manager&page=1&limit=20`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": 1,
      "username": "nguyen_van_a",
      "full_name": "Nguyễn Văn A",
      "email": "a@example.com",
      "role": "citizen",
      "created_at": "2026-01-01T00:00:00Z",
      "phone_number": "0901234567",
      "address": "101 Lê Lợi"
    }
  ]
}
```

---

#### ✅ POST `/api/v1/managers/users`
Tạo tài khoản mới trong zone. Manager có thể tạo citizen, guard, hoặc manager.

**Request Body:**
```json
{
  "username": "nguyen_van_b",
  "password": "matkhau123",
  "full_name": "Nguyễn Văn B",
  "email": "b@example.com",
  "role": "citizen",
  "role_details": {
    "phone_number": "0901234568",
    "address": "102 Lê Lợi",
    "identity_card_number": "012345678901",
    "is_house_owner": false
  }
}
```

> - `role` bắt buộc: `citizen | guard | manager`
> - `password` tối thiểu 6 ký tự
> - `role_details.zone_id` tự động gán theo zone của manager nếu không truyền
> - Trả lỗi `409` nếu username đã tồn tại

**Response 201:**
```json
{
  "success": true,
  "message": "Đã tạo tài khoản citizen thành công",
  "data": {
    "user_id": 10,
    "username": "nguyen_van_b",
    "full_name": "Nguyễn Văn B",
    "email": "b@example.com",
    "role": "citizen",
    "created_at": "2026-03-31T10:00:00Z"
  }
}
```

---

## 5. Gates / AI-IoT API (`gates.routes.js`)

> Kênh giao tiếp dành riêng cho **AI Service (Python)** và **IoT Gateway**. Không dùng cho người dùng thông thường.

### 5.1 AI Check-in Tự động (UC-13 & UC-14)

#### ✅ POST `/api/v1/gates/check-in`
AI Service gửi kết quả nhận diện biển số lên Backend. Backend thực hiện logic kiểm tra 3 bước (Whitelist vĩnh viễn → Whitelist tạm thời → Fallback) và trả lệnh điều khiển cổng.

**Request Body:**
```json
{
  "lane_id": "MAIN-IN",
  "plate_text": "51A-12345",
  "confidence_score": 0.97,
  "image_base64": "base64_encoded_jpeg"
}
```

**Response 200 — Mở cổng (Pass):**
```json
{
  "action": "OPEN",
  "access_type": "resident | guest",
  "log_id": "uuid",
  "message": "Xe cư dân hợp lệ. Mở cổng."
}
```

**Response 200 — Giữ đóng (Denied):**
```json
{
  "action": "KEEP_CLOSED",
  "log_id": "uuid",
  "message": "Xe không có trong whitelist. Bảo vệ được thông báo."
}
```

> **Logic 3 bước xử lý trong Backend:**
> 1. Tìm `plate_text` trong bảng `vehicles` (`is_active = true`) + kiểm tra Anti-Passback (`is_inside`). PASS → OPEN.
> 2. Tìm trong `guest_registrations` (`status = 'approved'` và trong time window). PASS → OPEN.
> 3. Fallback: ghi log với `vehicle_id` và `guest_reg_id` đều NULL, giữ CLOSED, đẩy thông báo real-time cho Guard qua WebSocket `scan_result` event.

---

### 5.2 OCR OTP/QR từ Camera (UC-06)

#### ✅ POST `/api/v1/gates/verify-camera-otp`
AI Service gửi nội dung đã OCR từ màn hình điện thoại của khách (6 chữ số OTP hoặc UUID QR) lên Backend để xác thực tự động — không cần Guard gõ phím.

**Request Body:**
```json
{
  "lane_id": "MAIN-IN",
  "token_data": "482917",
  "code_type": "otp_6digit | qr_uuid",
  "image_base64": "base64_encoded_jpeg"
}
```

**Response 200 — OTP hợp lệ:**
```json
{
  "action": "OPEN",
  "log_id": "uuid",
  "issued_by": "Nguyễn Thị B (A-101)",
  "message": "OTP hợp lệ. Mở cổng tự động."
}
```

**Response 200 — OTP không hợp lệ:**
```json
{
  "action": "KEEP_CLOSED",
  "log_id": "uuid",
  "message": "OTP không hợp lệ hoặc đã hết hạn."
}
```

---

### 5.3 Heartbeat / Trạng thái Gateway (UC-05)

#### ✅ GET `/api/v1/gates/:gateId`
IoT Gateway gọi định kỳ để báo cáo trạng thái Online/Offline.

**Response 200:**
```json
{
  "gate_id": "uuid",
  "gate_name": "Cổng chính",
  "is_active": true,
  "last_heartbeat": "2026-01-10T10:00:00Z"
}
```

---

## 6. IoT Gateway — Giao tiếp WebSocket (Socket.IO)

> Giao tiếp giữa **Backend (Node.js)** và **IoT Gateway (Python `TestingMode.py`)** thực hiện qua **WebSocket (Socket.IO)**.  
> IoT Gateway đóng vai trò **Socket.IO client**, kết nối đến Backend tại `http://localhost:5000`.  
> IoT Gateway **không expose HTTP API** — toàn bộ điều khiển đi qua WebSocket events.

```
Backend (:5000)              IoT Gateway (TestingMode.py)     Arduino (Serial)
     │                                  │                           │
     │◄──── socket.connect ─────────────│                           │
     │                                  │◄── CAR_ARRIVED ───────────│
     │◄── HTTP POST /api/v1/gates/check-in ──│                      │
     │                                  │                           │
     │──── scan_result event ──────────►│                           │
     │                                  │──── ENTRY_GO:Name\n ─────►│
     │                                  │  hoặc FORCE_CLOSE\n       │
     │                                  │  hoặc DENY_PLATE:Plate\n  │
     │                                  │                           │
     │──── manual_command event ────────►│                           │
     │  {action, operator_name, lane_id} │                           │
     │                                  │──── ENTRY_GO:Name\n ─────►│
     │                                  │  hoặc FORCE_CLOSE\n       │
```

### Events từ Backend → IoT Gateway

#### `manual_command`
Backend push lệnh điều khiển cổng khi Guard hoặc Manager thao tác thủ công.

**Payload:**
```json
{
  "action": "OPEN | CLOSE",
  "operator_name": "string",
  "lane_id": "MAIN-IN"
}
```

**Xử lý tại Gateway:**
- `OPEN` → gửi Serial `ENTRY_GO:<operator_name>\n` xuống Arduino
- `CLOSE` → gửi Serial `FORCE_CLOSE\n` xuống Arduino

---

### Events từ Backend → Citizen (React Frontend)

> Citizen cần emit `join_user_room` với `user_id` sau khi kết nối WebSocket để nhận thông báo cá nhân.

#### `vehicle_status_changed`
Gửi đến citizen khi Manager approve hoặc reject xe của họ.

**Payload (approved):**
```json
{
  "vehicle_id": 1,
  "status": "approved",
  "license_plate": "51A-12345",
  "message": "Xe của bạn đã được phê duyệt."
}
```

**Payload (rejected):**
```json
{
  "vehicle_id": 1,
  "status": "rejected",
  "license_plate": "51A-12345",
  "reason": "Biển số không hợp lệ.",
  "message": "Xe bị từ chối: Biển số không hợp lệ."
}
```

---

### Events từ IoT Gateway → Backend

#### `scan_result`
Gateway gửi kết quả nhận diện sau khi nhận phản hồi từ `POST /api/v1/gates/check-in`.

**Payload:**
```json
{
  "status": "OPEN | DENIED",
  "plate": "51A-12345",
  "owner_name": "string",
  "vehicle_type": "car | motorbike | ...",
  "captured_image": "base64_jpeg"
}
```

#### `video_stream`
Gateway stream frame camera liên tục lên Frontend để hiển thị live feed.

**Payload:**
```json
{ "image": "base64_encoded_jpeg" }
```

---

### HTTP từ Gateway → Backend (khi phát hiện xe)

Khi Arduino gửi tín hiệu `CAR_ARRIVED` qua Serial, Gateway gọi `POST /api/v1/gates/check-in` (xem mục 5.1).  
Payload thực tế từ Gateway:
```json
{
  "lane_id": "MAIN-IN",
  "plate_text": "51A-12345",
  "processing_time_ms": 0,
  "image_base64": "base64_jpeg"
}
```

---

## 7. Tóm tắt trạng thái implement

| # | Endpoint | Status | Use Case |
|---|----------|--------|----------|
| 1 | `POST /api/v1/auth/login` | ✅ | - |
| 2 | `GET /api/v1/auth/me` | ✅ | - |
| 3 | `GET /api/v1/citizens/vehicles` | ✅ | UC-01 |
| 4 | `GET /api/v1/citizens/vehicle-types` | ✅ | UC-01 |
| 5 | `POST /api/v1/citizens/vehicles` | ✅ | UC-01 |
| 6 | `PATCH /api/v1/citizens/vehicles/:vehicleId` | ✅ | UC-01 |
| 7 | `GET /api/v1/citizens/guests` | ✅ | UC-02 |
| 8 | `POST /api/v1/citizens/guests` | ✅ | UC-02 |
| 9 | `DELETE /api/v1/citizens/guests/:registrationId` | ✅ | UC-02 |
| 10 | `POST /api/v1/citizens/tokens` | ✅ | UC-03 |
| 11 | `GET /api/v1/citizens/tokens` | ✅ | UC-03 |
| 12 | `GET /api/v1/citizens/logs` | ✅ | UC-04 |
| 13 | `POST /api/v1/citizens/qr-code` | ✅ | UC-15 |
| 14 | `GET /api/v1/guards/logs` | ✅ | UC-05 |
| 15 | `GET /api/v1/guards/stats` | ✅ | UC-05 |
| 16 | `POST /api/v1/guards/verify-otp` | ✅ | UC-06 fallback |
| 17 | `POST /api/v1/guards/manual-action` | ✅ | UC-07 |
| 18 | `GET /api/v1/guards/action-reasons` | ✅ | UC-07 |
| 19 | `POST /api/v1/guards/ai-corrections` | ✅ | UC-08 |
| 20 | `POST /api/v1/guards/guests` | ✅ | UC-02 |
| 21 | `GET /api/v1/managers/vehicles/pending` | ✅ | UC-09 |
| 22 | `POST /api/v1/managers/vehicles/:id/approve` | ✅ | UC-09 |
| 23 | `POST /api/v1/managers/vehicles/:id/reject` | ✅ | UC-09 |
| 24 | `GET /api/v1/managers/analytics/overview` | ✅ | UC-10 |
| 25 | `GET /api/v1/managers/analytics/traffic-by-day` | ✅ | UC-10 |
| 26 | `GET /api/v1/managers/analytics/traffic-by-hour` | ✅ | UC-10 |
| 27 | `GET /api/v1/managers/analytics/vehicle-types` | ✅ | UC-10 |
| 28 | `GET /api/v1/managers/analytics/access-methods` | ✅ | UC-10 |
| 29 | `GET /api/v1/managers/logs` | ✅ | UC-11 |
| 30 | `GET /api/v1/managers/logs/:id` | ✅ | UC-11 |
| 31 | `GET /api/v1/managers/audit-logs` | ✅ | UC-11 |
| 32 | `GET /api/v1/managers/gates` | ✅ | UC-12 |
| 33 | `GET /api/v1/managers/ai/performance` | ✅ | UC-12 |
| 34 | `POST /api/v1/managers/manual-action` | ✅ | UC-07 Override |
| 35 | `POST /api/v1/managers/guests` | ✅ | UC-02 Override |
| 36 | `GET /api/v1/managers/users` | ✅ | FR_MAN_07 |
| 37 | `POST /api/v1/managers/users` | ✅ | FR_MAN_07 |
| 38 | `POST /api/v1/gates/check-in` | ✅ | UC-13, UC-14 |
| 39 | `POST /api/v1/gates/verify-camera-otp` | ✅ | UC-06 Auto |
| 40 | `GET /api/v1/gates/:gateId` | ✅ | Heartbeat |
| 41 | `PUT /api/v1/citizens/vehicles/:vehicleId` | ✅ | UC-01 |
| 42 | `DELETE /api/v1/citizens/vehicles/:vehicleId` | ✅ | UC-01 |

**Tổng: 42 endpoints — 42 ✅ đã implement · 0 ❌ còn thiếu**

> **Lưu ý:** Các endpoint `GET /api/v1/managers/ai/models`, `PATCH /api/v1/managers/ai/models/:id`, `GET /api/v1/managers/ai/corrections` đã được **loại bỏ** vì bảng `ai_models` và `ai_predictions` không còn trong schema v2.  
> IoT Gateway giao tiếp qua **WebSocket Socket.IO** (không phải HTTP Flask API) — xem chi tiết tại Mục 6.

