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
  "token": "eyJ...",
  "user": {
    "user_id": "uuid",
    "username": "string",
    "full_name": "string",
    "role": "citizen | guard | manager",
    "avatar_url": "string | null"
  }
}
```

**Response 401:** `{ "error": "Invalid credentials" }`

---

### ✅ GET `/api/v1/auth/me`
Lấy thông tin tài khoản đang đăng nhập.

**Header:** `Authorization: Bearer <token>`

**Response 200:**
```json
{
  "user_id": "uuid",
  "username": "string",
  "full_name": "string",
  "email": "string",
  "role": "citizen | guard | manager"
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
[
  {
    "vehicle_id": "uuid",
    "license_plate": "51A-12345",
    "vehicle_type": "car | motorbike | bicycle | truck | emergency",
    "vehicle_color": "string",
    "is_active": true,
    "is_inside": false,
    "last_log_time": "2026-01-01T00:00:00Z"
  }
]
```

---

#### ✅ GET `/api/v1/citizens/vehicle-types`
Lấy danh mục loại xe hợp lệ (enum reference).

**Response 200:**
```json
["car", "motorbike", "bicycle", "truck", "emergency"]
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
  "vehicle_id": "uuid",
  "license_plate": "51A-12345",
  "is_active": false,
  "message": "Xe đã được đăng ký, đang chờ phê duyệt."
}
```

**Response 409:** `{ "error": "Biển số đã tồn tại trong hệ thống." }`

---

#### ✅ PUT `/api/v1/citizens/vehicles/:vehicleId`
Cập nhật thông tin phương tiện. Sau khi cập nhật thành công, trạng thái sẽ tự động reset về `is_active = false` để Manager duyệt lại.

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
    "vehicle_type": "car",
    "vehicle_color": "Đen",
    "is_active": false
  }
}
```

**Response 409:** `{ "error": "Biển số xe này đã được đăng ký cho xe khác trong hệ thống" }`

---

#### ✅ PATCH `/api/v1/citizens/vehicles/:vehicleId`
Cập nhật trạng thái xe (`active` / `inactive`).

**Request Body:**
```json
{ "is_active": false }
```

**Response 200:** `{ "message": "Cập nhật thành công." }`

---

#### ✅ DELETE `/api/v1/citizens/vehicles/:vehicleId`
Xóa phương tiện cá nhân khỏi hệ thống (Dùng khi cư dân đã bán xe hoặc đăng ký nhầm).

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa phương tiện cá nhân"
}
```

**Response 404:** `{ "error": "Không tìm thấy xe hoặc bạn không có quyền xóa" }`

---

### 2.2 Quản lý khách hẹn trước (UC-02)

#### ✅ GET `/api/v1/citizens/guests`
Xem danh sách khách có hẹn của cư dân.

**Response 200:**
```json
[
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

**Response 201:** `{ "registration_id": "uuid", "status": "approved" }`

**Response 409:** `{ "error": "Khung giờ bị trùng với lần đăng ký khác." }`

---

#### ✅ DELETE `/api/v1/citizens/guests/:registrationId`
Hủy lịch hẹn khách.

**Response 200:** `{ "message": "Đăng ký khách đã được hủy." }`

---

### 2.3 Mã OTP khẩn cấp (UC-03)

#### ✅ POST `/api/v1/citizens/tokens`
Tạo mã OTP 6 số cho khách đột xuất (hiệu lực 15 phút).

**Response 201:**
```json
{
  "token_id": "uuid",
  "token_data": "482917",
  "valid_until": "2026-01-10T10:15:00Z"
}
```

---

#### ✅ GET `/api/v1/citizens/tokens`
Lấy danh sách OTP cá nhân đã tạo.

**Response 200:**
```json
[
  {
    "token_id": "uuid",
    "token_data": "482917",
    "valid_from": "2026-01-10T10:00:00Z",
    "valid_until": "2026-01-10T10:15:00Z",
    "is_used": false,
    "used_at": null
  }
]
```

---

### 2.4 Lịch sử cá nhân (UC-04)

#### ✅ GET `/api/v1/citizens/logs`
Xem lịch sử ra vào của tất cả xe thuộc sở hữu của cư dân.

**Query Params:** `?page=1&limit=20&from=2026-01-01&to=2026-01-31`

**Response 200:**
```json
{
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
      "is_access_granted": true
    }
  ]
}
```

---

### 2.5 Mã QR định danh cá nhân (UC-15)

#### ✅ POST `/api/v1/citizens/qr-code`
Tạo mã QR động chứa UUID cá nhân, hết hạn sau 3 phút. Dùng cho cư dân đi bộ/xe đạp quét Camera tại cổng phụ (Scenario 4).

**Response 201:**
```json
{
  "token_id": "uuid",
  "qr_data": "base64_encoded_qr_image",
  "uuid_payload": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "valid_until": "2026-01-10T10:03:00Z"
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
[
  {
    "log_id": "uuid",
    "check_in_time": "2026-01-10T08:05:00Z",
    "detected_text": "51A-12345",
    "access_method": "ai_plate_recognition",
    "is_access_granted": true,
    "action_reason": null,
    "image_snapshot": "base64_string"
  }
]
```

---

#### ✅ GET `/api/v1/guards/stats`
Thống kê lượt vào/ra và cảnh báo của cổng trong ca trực hiện tại.

**Response 200:**
```json
{
  "total_last_1h": 15,
  "total_last_24h": 120,
  "denied_last_24h": 3,
  "gate_name": "Cổng chính",
  "lane_name": "Làn vào"
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
  "is_valid": true,
  "message": "OTP hợp lệ",
  "issued_by": "Nguyễn Thị B (căn hộ A-101)"
}
```

**Response 400:** `{ "is_valid": false, "message": "OTP đã hết hạn hoặc không hợp lệ." }`

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
  "log_id": "uuid",
  "action": "OPEN",
  "action_reason": "emergency_vehicle",
  "message": "Lệnh mở cổng đã được ghi nhận và gửi đến IoT Gateway."
}
```

---

#### ✅ GET `/api/v1/guards/action-reasons`
Lấy danh sách lý do mặc định cho thao tác thủ công.

**Response 200:**
```json
[
  { "value": "emergency_vehicle", "label": "Xe cứu thương / Cứu hỏa / Cảnh sát" },
  { "value": "shipper_delivery",  "label": "Shipper / Giao hàng" },
  { "value": "ai_error",          "label": "Lỗi AI nhận dạng" },
  { "value": "vip_guest",         "label": "Khách VIP / Ban lãnh đạo" },
  { "value": "maintenance",       "label": "Bảo trì cổng" },
  { "value": "other",             "label": "Khác (nhập ghi chú)" }
]
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
{ "message": "Đã cập nhật sửa lỗi AI cho log_id: uuid." }
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

**Response 201:** `{ "registration_id": "uuid", "status": "approved" }`

---

## 4. Manager API (`managers.routes.js`)

> **Yêu cầu header:** `Authorization: Bearer <token>` (role: `manager`)

### 4.1 Phê duyệt phương tiện (UC-09)

#### ✅ GET `/api/v1/managers/vehicles/pending`
Danh sách xe đang chờ phê duyệt trong zone quản lý.

**Response 200:**
```json
[
  {
    "vehicle_id": "uuid",
    "license_plate": "51A-12345",
    "vehicle_type": "car",
    "vehicle_color": "Trắng",
    "owner": {
      "user_id": "uuid",
      "full_name": "Trần Văn C",
      "house_number": "A-101"
    },
    "created_at": "2026-01-05T10:00:00Z"
  }
]
```

---

#### ✅ POST `/api/v1/managers/vehicles/:id/approve`
Phê duyệt xe — set `is_active = true`.

**Response 200:** `{ "message": "Xe đã được phê duyệt." }`

---

#### ✅ POST `/api/v1/managers/vehicles/:id/reject`
Từ chối xe kèm lý do.

**Request Body:**
```json
{ "reason": "Biển số không hợp lệ." }
```

**Response 200:** `{ "message": "Xe đã bị từ chối." }`

---

### 4.2 Dashboard KPIs (UC-10)

#### ✅ GET `/api/v1/managers/analytics/overview`
4 KPIs cốt lõi trên Manager Dashboard.

**Response 200:**
```json
{
  "total_traffic_today": 320,
  "automation_rate_percent": 87.5,
  "security_alerts_today": 12,
  "active_visitors_now": 8
}
```

> - `total_traffic_today`: `COUNT(*) FROM access_logs WHERE DATE = TODAY`
> - `automation_rate_percent`: % log có `access_method IN ('ai_plate_recognition','ai_camera_otp','ai_camera_qr') AND is_access_granted = true`
> - `security_alerts_today`: `COUNT(*) WHERE is_access_granted = false`
> - `active_visitors_now`: Lượt inbound − outbound từ `guest_registrations`

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
  "total": 1200,
  "page": 1,
  "data": [
    {
      "log_id": "uuid",
      "check_in_time": "2026-01-10T08:05:00Z",
      "detected_text": "51A-12345",
      "access_method": "ai_plate_recognition",
      "is_access_granted": true,
      "action_reason": null,
      "gate_name": "Cổng chính",
      "lane_name": "Làn vào"
    }
  ]
}
```

---

#### ✅ GET `/api/v1/managers/logs/:id`
Chi tiết log kèm ảnh snapshot dạng Base64.

**Response 200:**
```json
{
  "log_id": "uuid",
  "check_in_time": "2026-01-10T08:05:00Z",
  "detected_text": "51A-12345",
  "access_method": "ai_plate_recognition",
  "is_access_granted": true,
  "action_reason": null,
  "image_snapshot": "data:image/jpeg;base64,/9j/...",
  "gate_name": "Cổng chính",
  "lane_name": "Làn vào",
  "guard": { "user_id": "uuid", "full_name": "Bảo vệ 1" }
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
> 3. Fallback: ghi log `is_access_granted = false`, giữ CLOSED, đẩy thông báo real-time cho Guard.

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

## 6. IoT Gateway Internal API (Python Flask — Port 8080)

> API nội bộ của **IoT Gateway (Python)**. Backend gọi để điều khiển phần cứng.

### ✅ GET `/health`
Kiểm tra trạng thái IoT Gateway.

**Response 200:**
```json
{ "status": "ok", "gate_id": 1, "message": "IoT Gateway is running" }
```

---

### ✅ POST `/api/v1/command`
Backend gửi lệnh điều khiển cổng vật lý xuống IoT Gateway.

**Request Body:**
```json
{
  "action": "OPEN | KEEP_CLOSED | EMERGENCY_OPEN | TEST",
  "gate_id": 1,
  "log_id": 123,
  "plate_text": "51A-12345",
  "access_type": "resident | guest | otp | manual",
  "duration": 5
}
```

**Response 200:**
```json
{
  "success": true,
  "gate_id": 1,
  "barrier_status": "OPEN | CLOSED | MOVING | ERROR",
  "message": "Barrier opened for 51A-12345",
  "execution_time_ms": 350
}
```

---

### ✅ GET `/api/v1/status`
Lấy trạng thái hiện tại của rào chắn từ IoT Gateway.

**Response 200:**
```json
{
  "success": true,
  "gate_id": 1,
  "barrier_status": "CLOSED",
  "message": "OK:CLOSED",
  "execution_time_ms": 120
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
| 36 | `POST /api/v1/gates/check-in` | ✅ | UC-13, UC-14 |
| 37 | `POST /api/v1/gates/verify-camera-otp` | ✅ | UC-06 Auto |
| 38 | `GET /api/v1/gates/:gateId` | ✅ | Heartbeat |
| 39 | `GET /health` (Gateway) | ✅ | IoT Internal |
| 40 | `POST /api/v1/command` (Gateway) | ✅ | IoT Internal |
| 41 | `GET /api/v1/status` (Gateway) | ✅ | IoT Internal |

**Tổng: 41 endpoints — 41 ✅ đã implement · 0 ❌ còn thiếu**

> **Lưu ý:** Các endpoint `GET /api/v1/managers/ai/models`, `PATCH /api/v1/managers/ai/models/:id`, `GET /api/v1/managers/ai/corrections` đã được **loại bỏ** vì bảng `ai_models` và `ai_predictions` không còn trong schema v2.

