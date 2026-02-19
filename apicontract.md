# API Contract

## CỤM 1: AUTHENTICATION (Xác thực)
FE cần gọi cái này đầu tiên để lấy Token và biết User đang đăng nhập là ai (Citizen, Guard hay Manager).

### 1. Đăng nhập hệ thống

**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**

```json
{
  "username": "admin_thinh",
  "password": "password123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "role": "manager",
    "full_name": "Nguyễn Văn Quản Lý",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## CỤM 2: SYSTEM & AI (Dành cho Python gọi sang)
Cốt lõi của hệ thống. Python vứt data sang đây, Node.js sẽ lưu ảnh BYTEA và ra quyết định.

### 2. AI Check-in (Xử lý xe vào/ra bằng AI)

**Endpoint:** `POST /api/v1/gates/check-in`

**Request Body:**

```json
{
  "gate_id": 1,
  "model_id": 1,
  "plate_text": "51F-123.45",
  "confidence_score": 0.98,
  "processing_time_ms": 200,
  "full_image_base64": "iVBORw0KGgo...", 
  "cropped_image_base64": "iVBORw0KGgo..." 
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "action": "OPEN", 
    "message": "Xe cư dân hợp lệ",
    "log_id": 105
  }
}
```

*(Note: Nếu biển số lạ, action trả về "KEEP_CLOSED").*

---

## CỤM 3: PHÂN HỆ BẢO VỆ (Security Guard)
Dành cho màn hình máy tính của bảo vệ tại chốt.

### 3. Xác minh mã OTP (Khách vãng lai / Edge Case 2.2)

**Endpoint:** `POST /api/v1/guards/verify-otp`

**Request Body:**

```json
{
  "gate_id": 1,
  "guard_id": 2,
  "otp_code": "123456"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "action": "OPEN",
    "message": "Mã hợp lệ. Đã ghi log hệ thống."
  }
}
```

### 3.1. Xử lý Mở cổng thủ công / Giao hàng (Edge Case 1)

**Endpoint:** `POST /api/v1/guards/manual-action`

**Request Body:**

```json
{
  "gate_id": 1,
  "guard_id": 2,
  "action_type": "open_barrier", 
  "note": "Xe cứu thương vào gấp"
}
```

*(Note: `action_type` có thể là `open_barrier` hoặc `keep_closed_log_only` cho vụ shipper).*

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Đã ghi nhận thao tác thủ công thành công."
}
```

---

## CỤM 4: PHÂN HỆ CƯ DÂN (Citizen)
Dành cho Mobile App / Web App của người dân.

### 4. Sinh mã OTP khẩn cấp

**Endpoint:** `POST /api/v1/citizens/tokens`

**Request Body:**

```json
{
  "citizen_id": 3
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "otp_code": "852963",
    "valid_until": "2026-02-19T17:00:00Z"
  }
}
```

### 4.1. Đăng ký khách có hẹn (Edge Case 2.1)

**Endpoint:** `POST /api/v1/citizens/guests`

**Request Body:**

```json
{
  "host_id": 3,
  "guest_name": "Trần Văn Khách",
  "guest_license_plate": "60A-999.99",
  "vehicle_type_id": 1,
  "visit_start_time": "2026-02-20T08:00:00Z",
  "visit_end_time": "2026-02-20T17:00:00Z"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Đã thêm khách vào danh sách Whitelist tạm thời."
}
```

---

## CỤM 5: PHÂN HỆ QUẢN LÝ (Manager)
Dành cho màn hình Dashboard tổng.

### 5. Lấy danh sách lịch sử ra vào (Kèm ảnh)

**Endpoint:** `GET /api/v1/managers/logs?zone_id=1&limit=50&page=1`

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "log_id": 105,
      "gate_name": "Cổng Chính A - Vào",
      "check_in_time": "2026-02-19T16:30:00Z",
      "access_method": "ai_recognition",
      "plate_text": "51F-123.45",
      "is_access_granted": true,
      "full_image_base64": "data:image/jpeg;base64,...",
      "cropped_image_base64": "data:image/jpeg;base64,..."
    }
  ]
}
```

### 5.1. Lấy dữ liệu thống kê biểu đồ

**Endpoint:** `GET /api/v1/managers/analytics/traffic?zone_id=1&days=7`

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    { "date": "2026-02-13", "inbound": 120, "outbound": 115 },
    { "date": "2026-02-14", "inbound": 150, "outbound": 140 }
  ]
}
```
