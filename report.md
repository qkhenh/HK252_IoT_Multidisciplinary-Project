# BÁO CÁO DỰ ÁN: HỆ THỐNG KIỂM SOÁT RA VÀO THÔNG MINH
# (SMART TOLL GATE - IoT Multidisciplinary Project)

**Mã môn học:** HK252 - Đa ngành IoT  
**Ngày hoàn thành:** Tháng 02/2026

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Business Requirements](#3-business-requirements)
4. [Functional Requirements & Use Cases](#4-functional-requirements--use-cases)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [IoT Gateway Implementation (Python)](#7-iot-gateway-implementation-python)
8. [Phụ lục](#8-phụ-lục)
9. [Manager Dashboard KPIs](#10-manager-dashboard-kpis)

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1 Mô tả dự án

**Smart Toll Gate** là hệ thống quản lý kiểm soát phương tiện ra vào khu dân cư/chung cư tự động, tích hợp giữa **Internet of Things (IoT)** và **Trí tuệ Nhân tạo (AI)**. Hệ thống hướng tới việc số hóa toàn bộ quy trình kiểm soát an ninh, giảm thiểu thao tác thủ công của lực lượng bảo vệ, đồng thời cung cấp trải nghiệm tiện lợi, minh bạch cho cư dân.

### 1.2 Mục tiêu

| Mục tiêu | Mô tả |
|----------|-------|
| **Tự động hóa** | Giảm 80% thời gian xử lý thủ công tại cổng |
| **An ninh** | Ghi log 100% lượt ra vào với hình ảnh minh chứng |
| **Minh bạch** | Dashboard real-time cho bảo vệ, thống kê cho Ban quản lý |
| **Linh hoạt** | Hỗ trợ xác thực tự động toàn diện: AI đọc biển số xe, Camera OCR đọc OTP/QR từ màn hình điện thoại |

### 1.3 Đối tượng sử dụng

1. **Cư dân (Citizens):** Chủ hộ/thành viên trong khu dân cư
2. **Bảo vệ (Security Guards):** Lực lượng an ninh tại các cổng
3. **Ban Quản lý (Managers):** Quản lý khu vực/zone cụ thể

---

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 Tổng quan kiến trúc

Hệ thống được thiết kế theo **mô hình microservices** với các luồng giao tiếp được quy định rõ ràng giữa các thành phần như sau:

- **Frontend (React) ↔ Backend (Node.js)**: 2 chiều (Frontend gửi API Request, Backend trả Response hoặc chủ động đẩy thông báo Realtime qua WebSocket).
- **Backend (Node.js) ↔ Database (PostgreSQL)**: 2 chiều (Backend gửi câu lệnh SQL, Database trả về kết quả truy vấn).
- **Backend (Node.js) ↔ IoT Gateway (Python)**: 2 chiều *(Điểm mấu chốt)* (Gateway đẩy ảnh/thông tin lên xin phép mở cổng; Backend trả lời hợp lệ/không hợp lệ, hoặc chủ động ra lệnh OPEN/CLOSE từ xa xuống Gateway).
- **AI Service (Python) ↔ Backend (Node.js)**: 2 chiều (Hệ thống gửi ảnh cần nhận diện sang AI; AI Service trả về chuỗi JSON chứa text biển số xe hoặc nội dung OCR từ màn hình điện thoại — OTP 6 số / QR code — cùng độ tin cậy).
- **IoT Gateway (Python) ↔ Arduino**: 2 chiều (Gateway truyền lệnh xuống mạch qua cổng Serial, Arduino báo cáo ngược lại tín hiệu phát hiện xe từ cảm biến IR/Ultrasonic).
- **IP Camera → AI Service / IoT Gateway**: 1 chiều (Camera đẩy luồng Video Stream phục vụ hai tác vụ: (1) nhận diện biển số xe cư dân/khách, (2) đọc mã OTP 6 số hoặc QR code trên màn hình điện thoại của khách vãng lai).
- **Arduino → Barrier (Servo) / LED & Buzzer**: 1 chiều (Arduino xuất tín hiệu điện PWM để kéo rào chắn lên và bật đèn/còi).

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MÔ HÌNH GIAO TIẾP HỆ THỐNG                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   ┌─────────────┐ 2 chiều (HTTP/WS) ┌─────────────┐  2 chiều (HTTP)  ┌─────────────┐   │
│   │  FRONTEND   │◄─────────────────►│   BACKEND   │◄────────────────►│ AI SERVICE  │   │
│   │   (React)   │                   │  (Node.js)  │                  │  (Python)   │   │
│   └─────────────┘                   └──────┬──────┘                  └──────▲──────┘   │
│                                            │                                │          │
│                                            │ 2 chiều                        │ 1 chiều  │
│                                            │ (SQL)                          │ (Stream) │
│                                    ┌───────▼───────┐                        │          │
│                                    │  POSTGRESQL   │                        │          │
│                                    │  (Database)   │                        │          │
│                                    └───────────────┘                        │          │
│                                                                             │          │
│   ┌─────────────┐    1 chiều (HTTP POST)   │                                │          │
│   │ QR SCANNER  ├──────────────────────────┤                                │          │
│   │  (Reader)   │                          │                                │          │
│   └─────────────┘                          │ 2 chiều                        │          │
│                                            │ (HTTP)                         │          │
│   ┌─────────────┐                  ┌───────▼───────┐    1 chiều (Stream)    │          │
│   │  IP CAMERA  ├─────────────────►│  IOT GATEWAY  │◄───────────────────────┘          │
│   └─────────────┘ 1 chiều (Stream) │   (Python)    │                                   │
│                                    └───────┬───────┘                                   │
│                                            │                                           │
│                                            │ 2 chiều (Serial)                          │
│                                            │                                           │
│                                    ┌───────▼───────┐                                   │
│                                    │    ARDUINO    │                                   │
│                                    │    (C/C++)    │                                   │
│                                    └───────┬───────┘                                   │
│                                            │                                           │
│                                            │ 1 chiều (PWM/Digital)                     │
│                            ┌───────────────┴───────────────┐                           │
│                    ┌───────▼───────┐               ┌───────▼───────┐                   │
│                    │    BARRIER    │               │ LED & BUZZER  │                   │
│                    │ (Servo Motor) │               │   Indicators  │                   │
│                    └───────────────┘               └───────────────┘                   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Backend Architecture - MVC Pattern

Backend được xây dựng theo kiến trúc **Model-View-Controller (MVC)** với Express.js:

```
backend/
└── src/
    ├── server.js           # Entry point, Express app configuration
    ├── libs/
    │   └── db.js           # PostgreSQL connection pool (pg)
    ├── middlewares/
    │   └── auth.middleware.js  # JWT authentication & role-based authorization
    ├── models/             # DATA ACCESS LAYER (MODEL)
    │   ├── auth.model.js       # User authentication queries
    │   ├── citizens.model.js   # OTP, vehicles, guests management
    │   ├── guards.model.js     # OTP verification, manual actions, logs
    │   ├── gates.model.js      # AI check-in, whitelist logic
    │   └── managers.model.js   # Analytics, vehicle approval, AI performance
    ├── controllers/        # BUSINESS LOGIC LAYER (CONTROLLER)
    │   ├── auth.controller.js
    │   ├── citizens.controller.js
    │   ├── guards.controller.js
    │   ├── gates.controller.js
    │   └── managers.controller.js
    └── routes/             # API ROUTING LAYER (VIEW routing)
        ├── auth.routes.js
        ├── citizens.routes.js
        ├── guards.routes.js
        ├── gates.routes.js
        └── managers.routes.js
```

#### Phân tách trách nhiệm (Separation of Concerns):

| Layer | Trách nhiệm | Files |
|-------|-------------|-------|
| **Model** | Truy vấn database, business rules cấp data | `*.model.js` |
| **Controller** | Xử lý request, validation, gọi model, format response | `*.controller.js` |
| **Route** | Định nghĩa endpoints, gắn middleware, delegate to controller | `*.routes.js` |
| **Middleware** | Cross-cutting concerns (auth, logging) | `auth.middleware.js` |

### 2.3 Mô hình phân quyền - Disjoint Total

```
                    ┌───────────┐
                    │   USERS   │
                    │ (Base)    │
                    └─────┬─────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ CITIZENS  │   │  GUARDS   │   │ MANAGERS  │
    │ (Role 1)  │   │ (Role 2)  │   │ (Role 3)  │
    └───────────┘   └───────────┘   └───────────┘
```

- Mỗi user chỉ có **duy nhất một role**
- Sử dụng `user_role_enum` để enforce tại database level
- JWT token chứa role để authorization ở middleware

### 2.4 Công nghệ sử dụng

| Component | Technology | Version |
|-----------|------------|---------|
| **Backend** | Node.js + Express | 5.x |
| **Database** | PostgreSQL (pgvector) | 17 |
| **AI Service** | Python + YOLOv8 + OCR | 3.11+ |
| **IoT Gateway** | Python + pySerial | 3.11+ |
| **Hardware** | Arduino + Servo Motor | - |
| **Authentication** | JWT (jsonwebtoken) | - |
| **Containerization** | Docker + Docker Compose | - |

---

## 3. BUSINESS REQUIREMENTS

### 3.1 Bối cảnh kinh doanh

Các khu dân cư/chung cư hiện đại đối mặt với thách thức:
- **Chi phí nhân sự cao:** Cần bảo vệ 24/7 tại mỗi cổng
- **Xác minh thủ công chậm:** Gây ùn tắc giờ cao điểm
- **Thiếu minh bạch:** Không có bằng chứng lịch sử ra vào
- **Khó quản lý khách:** Không kiểm soát được xe lạ

### 3.2 Business Goals

| ID | Business Goal | Success Metric |
|----|---------------|----------------|
| **BG-01** | Giảm thời gian check-in trung bình | < 3 giây/xe (với AI) |
| **BG-02** | Tối ưu chi phí vận hành | Giảm 50% nhân sự bảo vệ |
| **BG-03** | Tăng an ninh khu vực | 100% ghi log có hình ảnh |
| **BG-04** | Cải thiện trải nghiệm cư dân | Satisfaction > 90% |
| **BG-05** | Dữ liệu phục vụ ra quyết định | Dashboard analytics real-time |

### 3.3 Business Scenarios

#### Scenario 1: Happy Path (Fully Automated Flow — AI OCR Biển Số)
```markdown
🔍 Bước 1: AI đọc biển số → Quét Whitelist Vĩnh viễn (Bảng vehicles)
- Camera tại làn xe chụp ảnh và gửi đến AI Service.
- AI Service (YOLOv8 + OCR) thực hiện DUY NHẤT một tác vụ: ĐỌC TEXT BIỂN SỐ XE và trả về plate_text.
  (Không có cơ chế dán tem ePass hay QR tag trên xe.)
- Backend truy vấn bảng `vehicles`: tìm xe có `license_plate = plate_text` và `is_active = true`.
- Kiểm tra kết quả:
  + Nếu KHÔNG TÌM THẤY → xe không phải cư dân → chuyển sang Bước 2.
  + Nếu TÌM THẤY → kiểm tra Anti-Passback:
    * Đọc cờ `is_inside` của xe trong DB.
    * Nếu làn đang là inbound (xe vào) nhưng `is_inside = true` → Lỗi logic → Chặn ngay, cảnh báo "Xe đang ở trong bãi".
- Phê duyệt: Pass Anti-Passback → Cập nhật `is_inside = true` → Ghi access_log → Gửi lệnh OPEN. Kết thúc luồng.

🔍 Bước 2: Quét Whitelist Tạm thời (Bảng guest_registrations)
- Nếu biển số không khớp Whitelist Vĩnh viễn, Backend tìm trong danh sách khách đã hẹn trước.
- Truy vấn bảng `guest_registrations` với điều kiện:
  + `guest_license_plate = plate_text`
  + `status = 'approved'`
- Kiểm tra Thời gian (Time Window Validation):
  + Thời gian hiện tại có nằm trong khoảng `[visit_start_time, visit_end_time]` không?
- Kiểm tra kết quả:
  + Nếu TÌM THẤY và ĐÚNG GIỜ → Ghi log (lưu guest_reg_id) → Mở cổng. Kết thúc luồng.
  + Nếu KHÔNG TÌM THẤY hoặc SAI GIỜ → Từ chối → chuyển sang Bước 3.

🛑 Bước 3: Fallback (Từ chối & Cảnh báo Bảo vệ)
- Trượt cả Bước 1 và Bước 2:
- Backend ghi log `is_access_granted = false`.
- Trả lệnh KEEP_CLOSED xuống IoT Gateway.
- Đẩy thông báo Real-time lên màn hình Bảo vệ: "Xe không hợp lệ — vui lòng xử lý!".
- Khách muốn vào có thể chuyển sang Scenario 3: yêu cầu chủ nhà tạo OTP, sau đó dùng Camera OCR để xác thực tự động.
```

#### Scenario 2: Manual Override (Remote Human Intervention)
```
1. This flow is used for special cases that require visual confirmation by the Security Guard or Manager
2. Priority vehicles (ambulances, fire trucks, police) or exceptional cases enter the lane
3. The Security Guard or Manager monitors the live camera feed on the respective dashboard
4. The Guard or Manager clicks the Emergency Gate Open button on their web interface to remotely open the gate
5. The system requires the operator to select a reason (e.g., emergency_vehicle, system_maintenance)
6. The backend stores the action log together with the operator ID and sends the gate-open command
```

#### Scenario 3: Tự động hóa Luồng Khách Vãng Lai bằng Camera OCR
```markdown
1. Khách vãng lai (xe máy, ô tô) hoặc shipper đến cổng và bị chặn do biển số chưa đăng ký.
2. Khách gọi điện thông báo cho cư dân (chủ nhà).
3. Cư dân mở Mobile App → chọn "Tạo OTP" → hệ thống sinh mã 6 số ngẫu nhiên (hạn 15 phút) và hiển thị trên app.
4. Cư dân gửi mã OTP cho khách qua tin nhắn/đọc miệng.
5. **[Tự động — Không cần Bảo vệ gõ phím]** Khách chỉ cần MỞ MÀN HÌNH ĐIỆN THOẠI chứa 6 số OTP vào trước Camera tại làn cổng.
6. AI Service (Computer Vision / OCR) phân tích khung hình từ Camera, detect vùng màn hình sáng, OCR đọc chuỗi 6 chữ số và gửi lên Backend.
7. Backend kiểm tra OTP: hợp lệ + chưa dùng + chưa hết hạn → Đánh dấu OTP `is_used = true` → Ghi access_log → Ghi lệnh OPEN → Hệ thống tự động mở cổng.
```

#### Scenario 4: Pedestrian/Bicycle Access (Cư dân đi bộ sử dụng QR trên Camera)
```markdown
1. Cư dân đi tập thể dục hoặc đi xe đạp không có biển số để AI nhận diện.
2. Cư dân mở Mobile App → xin mã QR định danh cá nhân (Dynamic QR chứa UUID, hạn 3 phút).
3. Cư dân MỞ MÀN HÌNH PHONE chứa mã QR hướng vào Camera tại làn cổng.
4. AI Service decode QR từ nội dung Camera → gửi UUID lên Backend.
5. Backend đối chiếu UUID → xác nhận cư dân hợp lệ và QR còn hạn → Mở cổng tự động.
```

---

## 4. FUNCTIONAL REQUIREMENTS & USE CASES

### 4.1 Use Case Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │           Smart Toll Gate System            │
                    │                                             │
    ┌───────┐       │  ┌─────────────────────────────────┐       │
    │Citizen│───────┼──│ UC-01: Quản lý phương tiện      │       │
    │       │       │  │ UC-02: Đăng ký khách có hẹn     │       │
    │       │───────┼──│ UC-03: Tạo mã OTP khẩn cấp      │       │
    │       │       │  │ UC-04: Xem lịch sử cá nhân      │       │
    └───────┘       │  └─────────────────────────────────┘       │
                    │                                             │
    ┌───────┐       │  ┌─────────────────────────────────┐       │
    │ Guard │───────┼──│ UC-05: Giám sát real-time       │       │
    │       │───────┼──│ UC-07: Thao tác thủ công        │       │
    │       │       │  │ UC-08: Sửa lỗi nhận dạng AI     │       │
    │       │───────┼──│ (UC-02): Đăng ký khách cho CD   │       │
    └───────┘       │  └─────────────────────────────────┘       │
                    │                                             │
    ┌───────┐       │  ┌─────────────────────────────────┐       │
    │Manager│───────┼──│ UC-09: Phê duyệt phương tiện    │       │
    │       │       │  │ UC-10: Manager Dashboard KPIs  │       │
    │       │───────┼──│ UC-11: Tra cứu nhật ký hệ thống │       │
    │       │───────┼──│ (UC-02): Đăng ký khách có hẹn   │       │
    │       │       │  │ (UC-07): Thao tác mở cổng từ xa │       │
    └───────┘       │  └─────────────────────────────────┘       │
                    │                                             │
    ┌───────┐       │  ┌─────────────────────────────────┐       │
    │  AI   │───────┼──│ UC-13/14: Nhận diện biển số    │       │
    │Service│       │  │ UC-06: OCR OTP/QR từ Camera    │       │
    └───────┘       │  └─────────────────────────────────┘       │
                    │                                             │
    └─────────────────────────────────────────────────────────────┘
```

### 4.2 Use Cases Chi Tiết

---

#### UC-01: Quản lý phương tiện cá nhân

| Attribute | Description |
|-----------|-------------|
| **Actor** | Citizen |
| **Description** | Citizen xem, thêm phương tiện vào whitelist cá nhân |
| **Precondition** | Citizen đã đăng nhập |
| **Postcondition** | Xe được thêm vào hệ thống chờ duyệt |

**Main Flow:**
1. Citizen truy cập trang "My Vehicles"
2. Hệ thống hiển thị danh sách xe hiện có
3. Citizen chọn "Thêm xe mới"
4. Citizen nhập: Biển số, Loại xe, Màu sắc, Ảnh (optional)
5. Hệ thống validate biển số (format, trùng lặp)
6. Hệ thống lưu xe với `is_active = false` (chờ duyệt)
7. Thông báo thành công cho Citizen

**Alternative Flow:**
- 5a. Biển số không hợp lệ → Hiển thị lỗi, yêu cầu nhập lại
- 5b. Biển số đã tồn tại → Thông báo xe đã được đăng ký

---

#### UC-02: Đăng ký khách có hẹn trước

| Attribute | Description |
|-----------|-------------|
| **Actor** | Citizen, Security Guard, Manager |
| **Description** | Đăng ký thông tin khách sẽ đến thăm. Guard và Manager cũng có quyền đăng ký thay |
| **Precondition** | Actor đã đăng nhập |
| **Postcondition** | Guest registration được tạo với status "approved" |

**Main Flow:**
1. Actor truy cập trang "Guest Management"
2. Actor chọn "Đăng ký khách mới"
3. Actor nhập: Tên khách, Biển số xe, Thời gian đến, Thời gian về, Mục đích
4. Hệ thống validate khung giờ (không overlap với registration khác)
5. Hệ thống lưu guest_registration với status = "approved" (hệ thống sẽ check-in tự động bằng AI nhận diện biển số)
6. Thông báo thành công

**Alternative Flow:**
- 4a. Khung giờ bị overlap → Hiển thị cảnh báo, yêu cầu chọn giờ khác

---

#### UC-03: Tạo mã OTP khẩn cấp

| Attribute | Description |
|-----------|-------------|
| **Actor** | Citizen |
| **Description** | Citizen tạo mã OTP cho khách đột xuất (khách vãng lai gọi điện) |
| **Precondition** | Citizen đã đăng nhập |
| **Postcondition** | OTP 6 số được tạo, hiển thị cho Citizen & màn hình Guard |

**Main Flow:**
1. Khách gọi điện cho Citizen báo đến cổng
2. Citizen mở app, chọn "Tạo mã OTP" cho khách
3. Hệ thống sinh mã 6 số ngẫu nhiên (unique trong pool active)
4. Hệ thống lưu vào access_tokens với valid_until = NOW() + 15 phút
5. Mã OTP hiển thị trên app của Citizen VÀ tự động đồng bộ lên màn hình của Security Guard
6. Citizen đọc hoặc gửi mã OTP cho khách qua điện thoại/tin nhắn

---

#### UC-04: Xem lịch sử cá nhân

| Attribute | Description |
|-----------|-------------|
| **Actor** | Citizen |
| **Description** | Citizen xem lịch sử ra vào của xe mình |
| **Precondition** | Citizen đã đăng nhập |
| **Postcondition** | Hiển thị danh sách access_logs liên quan |

**Main Flow:**
1. Citizen truy cập "Lịch sử của tôi"
2. Hệ thống query access_logs WHERE vehicle.owner_id = citizen_id
3. Hiển thị danh sách: Thời gian, Cổng, Phương thức, Trạng thái

---

#### UC-05: Giám sát real-time (Guard)

| Attribute | Description |
|-----------|-------------|
| **Actor** | Security Guard |
| **Description** | Guard theo dõi hoạt động cổng theo thời gian thực |
| **Precondition** | Guard đã đăng nhập, được assign cổng cụ thể |
| **Postcondition** | Màn hình cập nhật liên tục |

**Main Flow:**
1. Guard đăng nhập → Redirect đến Dashboard cổng được assign
2. Hệ thống hiển thị: Stream camera, 20 logs gần nhất, Stats (1h, 24h)
3. Khi có xe mới → AI xử lý → Dashboard cập nhật real-time
4. Guard có thể xem chi tiết từng log (ảnh, biển số, trạng thái)

---

#### UC-06: Xác thực OTP/QR bằng Camera (Tự động — Không cần Guard gõ phím)

| Attribute | Description |
|-----------|-------------|
| **Actor** | AI Service / Khách vãng lai |
| **Description** | Khách đưa màn hình điện thoại có chứa mã OTP 6 số hoặc QR code (cho người đi bộ) vào Camera tại cổng. AI Service OCR tự động đọc nội dung và gửi lên Backend kiểm tra — Không yêu cầu Bảo vệ can thiệp. |
| **Precondition** | Citizen đã tạo mã OTP hợp lệ (UC-03) |
| **Postcondition** | OTP được đánh dấu `is_used = true`, ghi access_log, barrier mở tự động |

**Main Flow:**
1. Khách gốc lấy mã OTP từ Citizen (qua điện thoại/tin nhắn), hiển thị lên màn hình.
2. Khách hướng màn hình điện thoại (6 số OTP hoặc QR) vào Camera tại làn cổng.
3. AI Service phân tích luft ảnh từ Camera: detect vùng màn hình sáng, OCR đọc chuỗi số/giải mã QR.
4. Gửi kết quả lên API: `POST /api/v1/gates/verify-otp-camera` với `{ extracted_code }`.
5. Backend kiểm tra: `extracted_code` khớp OTP còn hiệu lực → đánh dấu `is_used = true` → ghi access_log → gửi lệnh OPEN.
6. Bảo vệ thấy thông tin log xuất hiện trên Dashboard real-time (chủ hộ, tên khách, thời gian).

**Alternative Flow:**
- 3a. OCR không thể đọc được (màn hình mờ, góc lệch) → Hệ thống hiển thị hướng dẫn trên màn hình tại cổng → Khách điều chỉnh.
- 5a. OTP không tồn tại → Báo lỗi, thông báo Bảo vệ.
- 5b. OTP đã dùng hoặc hết hạn → Từ chối, báo Bảo vệ can thiệp nếu cần.

---

#### UC-07: Thao tác thủ công (Manual Override & Hỗ trợ từ xa)

| Attribute | Description |
|-----------|-------------|
| **Actor** | Security Guard, Manager |
| **Description** | Guard hoặc Manager mở/đóng cổng thủ công (tại chỗ hoặc từ xa). **Bắt buộc chọn lý do** trước khi thực thi — lý do được lưu vào cột `action_reason` trong `access_logs`. |
| **Precondition** | Actor đã đăng nhập |
| **Postcondition** | Action được ghi log đầy đủ bao gồm `action_reason`; có thể tra cứu lại trên Dashboard lịch sử ca trực |

**Main Flow:**
1. Guard/Manager chọn Action: "Mở cổng khNn cấp" hoặc "Giữ đóng".
2. Hệ thống **bắt buộc** hiển thị Dropdown chọn lý do (không thể Submit nếu chưa chọn):
   - `emergency_vehicle` — Xe cứu thương / cứu hỏa / cảnh sát
   - `shipper_delivery` — Shipper / giao hàng
   - `ai_error` — Lỗi AI nhận dạng
   - `vip_guest` — Khách VIP / ban lãnh đạo
   - `maintenance` — Bảo trì cổng
   - `other` — Khác (yêu cầu nhập thêm ghi chú vào ô `note`)
3. Guard/Manager xác nhận hành động.
4. Hệ thống ghi `access_logs` với `access_method = 'manual_guard'` **và `action_reason = <lý do đã chọn>`**.
5. Nếu "Mở cổng" → Gửi lệnh OPEN đến IoT Gateway.
6. Lý do luôn hiển thị rõ trên cột bên phải của bảng lịch sử ca trực (Guard Dashboard) giúp giải trình minh bạch.

---

#### UC-08: Sửa lỗi nhận dạng AI (Human-in-the-loop)

| Attribute | Description |
|-----------|-------------|
| **Actor** | Security Guard |
| **Description** | Guard sửa text biển số khi AI nhận dạng sai |
| **Precondition** | Có access_log gần đây với biển số AI đọc |
| **Postcondition** | Biển số đúng được lưu vào cột `note` của `access_logs` để tra cứu |

**Main Flow:**
1. AI nhận dạng biển số là "51A-12345" với confidence thấp
2. Guard nhận thấy thực tế là "51A-12346"
3. Guard click vào log → Chọn "Sửa biển số"
4. Guard nhập biển số đúng → Submit
5. Hệ thống update `access_logs.note` với biển số được sửa

---

#### UC-09: Phê duyệt phương tiện (Manager)

| Attribute | Description |
|-----------|-------------|
| **Actor** | Manager |
| **Description** | Manager duyệt/từ chối yêu cầu đăng ký xe mới |
| **Precondition** | Manager đã đăng nhập, quản lý zone cụ thể |
| **Postcondition** | Xe được phê duyệt (is_active=true) hoặc bị xóa |

**Main Flow:**
1. Manager vào trang "Pending Vehicles"
2. Hệ thống hiển thị danh sách xe chờ duyệt trong zone
3. Manager click vào xe cụ thể → Xem chi tiết (ảnh, thông tin chủ)
4. Manager chọn "Approve" hoặc "Reject"
5. Hệ thống cập nhật và ghi audit log

---

#### UC-10: Manager Dashboard KPIs

| Attribute | Description |
|-----------|-------------|
| **Actor** | Manager |
| **Description** | Manager xem 4 chỉ số KPIs cốt lõi về vận hành cổng |
| **Precondition** | Manager đã đăng nhập |
| **Postcondition** | Hiển thị 4 KPIs real-time |

**Main Flow:**
1. Manager truy cập "Manager Dashboard"
2. Hệ thống hiển thị 4 KPIs (xem chi tiết tại Mục 10):
   - **Total Traffic Volume** — Tổng lưu lượng trong ngày
   - **Automation Rate** — % cổng mở tự động bằng AI
   - **Security Alerts** — Tổng lượt `is_access_granted = false`
   - **Active Visitors** — Khách vãng lai đang ở trong khu

#### UC-11: Tra cứu nhật ký hệ thống

| Attribute | Description |
|-----------|-------------|
| **Actor** | Manager |
| **Description** | Manager tìm kiếm, lọc access logs chi tiết |
| **Precondition** | Manager đã đăng nhập |
| **Postcondition** | Hiển thị danh sách logs với filter |

**Main Flow:**
1. Manager vào trang "Access Logs"
2. Manager có thể filter theo: Ngày, Cổng, Phương thức, Biển số, Granted/Denied
3. Hệ thống query và hiển thị kết quả pagination
4. Manager click vào log cụ thể → Xem ảnh snapshot

---

#### UC-13 & UC-14: Nhận diện & Check-in tự động (AI Service)

| Attribute | Description |
|-----------|-------------|
| **Actor** | AI Service (automated) |
| **Description** | Xử lý ảnh camera, nhận diện biển số xe bằng AI OCR, kiểm tra whitelist và anti-passback |
| **Trigger** | Camera phát hiện xe trong vùng nhận diện |

**Main Flow:**
1. Camera capture ảnh → Gửi đến AI Service.
2. YOLOv8 detect vùng biển số xe trong ảnh.
3. OCR model đọc text biển số → Lấy `plate_text`.
4. Gửi kết quả đến Backend: `plate_text`, `image_snapshot`.
5. Backend áp dụng luồng 3 Bước:
   - **Bước 1**: Tìm `plate_text` trong bảng `vehicles` (Whitelist Vĩnh viễn). Kèm check anti-passback (`is_inside`). NẾU PASS -> MỞ CỔNG. NẾU FAIL -> Qua Bước 2.
   - **Bước 2**: Tìm `plate_text` trong `guest_registrations` (Whitelist Tạm thời). NẾU PASS -> MỞ CỔNG. NẾU FAIL -> Qua Bước 3.
   - **Bước 3**: Fallback, ghi log `is_access_granted = false`, giữ cổng ĐÓNG, cảnh báo Security Guard.
6. Ghi log `is_inside` (nếu mở cổng) & `access_log`.
7. Gửi action đến IoT Gateway.

---

### 4.3 Functional Requirements Matrix

| FR ID | Requirement | Use Case | Priority |
|-------|-------------|----------|----------|
| **FR_SYS_01** | Xử lý nhận diện AI (YOLOv8 + OCR) | UC-13 | Must |
| **FR_SYS_02** | Kiểm tra quyền truy cập (whitelist check) | UC-14 | Must |
| **FR_SYS_03** | Giao tiếp IoT Gateway (HTTP/MQTT) | UC-14 | Must |
| **FR_SYS_04** | Lưu trữ hình ảnh nhị phân (BYTEA) | All | Must |
| **FR_CIT_01** | Quản lý phương tiện cá nhân | UC-01 | Must |
| **FR_CIT_02** | Đăng ký khách có hẹn | UC-02 | Must |
| **FR_CIT_03** | Tạo mã OTP khẩn cấp | UC-03 | Must |
| **FR_CIT_04** | Mã QR định danh | - | Should |
| **FR_CIT_05** | Tra cứu lịch sử cá nhân | UC-04 | Should |
| **FR_SEC_01** | Giám sát real-time | UC-05 | Must |
| **FR_SEC_02** | Xác thực OTP/QR tự động bằng Camera OCR | UC-06 | Must |
| **FR_SEC_03** | Thao tác thủ công (bắt buộc `action_reason`) | UC-07 | Must |
| **FR_SEC_04** | Human-in-the-loop (sửa biển số AI) | UC-08 | Should |
| **FR_MAN_01** | Phê duyệt phương tiện | UC-09 | Must |
| **FR_MAN_02** | Manager Dashboard KPIs (4 chỉ số) | UC-10 | Must |
| **FR_MAN_03** | Tra cứu nhật ký hệ thống | UC-11 | Must |

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### 5.1 Performance Requirements

| NFR ID | Requirement | Metric | Target |
|--------|-------------|--------|--------|
| **NFR_PERF_01** | Thời gian nhận diện AI | End-to-end latency | < 1000ms |
| **NFR_PERF_02** | API response time | 95th percentile | < 200ms |
| **NFR_PERF_03** | Database query time | Complex queries | < 100ms |
| **NFR_PERF_04** | Concurrent users | Simultaneous requests | > 100 |
| **NFR_PERF_05** | Image upload size | Max payload | 10MB |

### 5.2 Security Requirements

| NFR ID | Requirement | Implementation |
|--------|-------------|----------------|
| **NFR_SEC_01** | Authentication | JWT với expiry 7 ngày |
| **NFR_SEC_02** | Password storage | bcrypt với salt rounds = 10 |
| **NFR_SEC_03** | Authorization | Role-based access control (RBAC) |
| **NFR_SEC_04** | API protection | Rate limiting, CORS policy |
| **NFR_SEC_05** | Data encryption | HTTPS/TLS in transit |
| **NFR_SEC_06** | OTP security | 6 digits, unique, 15-min expiry |

### 5.3 Reliability Requirements

| NFR ID | Requirement | Target |
|--------|-------------|--------|
| **NFR_REL_01** | System availability | 99.5% uptime |
| **NFR_REL_02** | Data durability | PostgreSQL with WAL |
| **NFR_REL_03** | Graceful shutdown | Session handling |
| **NFR_REL_04** | Database connection pool | Max 20 connections |
| **NFR_REL_05** | Transaction rollback | On any operation failure |

### 5.4 Scalability Requirements

| NFR ID | Requirement | Approach |
|--------|-------------|----------|
| **NFR_SCA_01** | Horizontal scaling | Stateless API design |
| **NFR_SCA_02** | Database scaling | Connection pooling |
| **NFR_SCA_03** | Image storage | BYTEA (có thể migrate S3) |
| **NFR_SCA_04** | Microservices | Độc lập AI Service |

### 5.5 Maintainability Requirements

| NFR ID | Requirement | Implementation |
|--------|-------------|----------------|
| **NFR_MNT_01** | Code structure | MVC pattern |
| **NFR_MNT_02** | API documentation | RESTful conventions |
| **NFR_MNT_03** | Logging | Structured logs với timestamps |
| **NFR_MNT_04** | Configuration | Environment variables (.env) |
| **NFR_MNT_05** | Testing | PowerShell test suite |

---

## 6. DATA REQUIREMENTS

### 6.1 Entity-Relationship Diagram

```
                                    ┌─────────────────┐
                                    │     ZONES       │
                                    │─────────────────│
                                    │ zone_id (PK)    │
                                    │ zone_name       │
                                    │ description     │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌─────────────────┐     ┌─────────────────┐      ┌─────────────────┐
           │     HOUSES      │     │     GATES       │      │    MANAGERS     │
           │─────────────────│     │─────────────────│      │─────────────────│
           │ house_id (PK)   │     │ gate_id (PK)    │      │ user_id (PK/FK) │
           │ zone_id (FK)    │     │ zone_id (FK)    │      │ managed_zone_id │
           │ house_number    │     │ gate_name       │      │ department_name │
           │ block_number    │     │ is_active       │      └────────┬────────┘
           └────────┬────────┘     └────────┬────────┘               │
                    │                       │                        │
                    ▼               ┌───────▼──────────┐            │
           ┌─────────────────┐      │     LANES (New)  │            │
           │    CITIZENS     │      │──────────────────│            │
           │─────────────────│      │ lane_id (PK,VC)  │            │
           │ user_id (PK/FK) │      │ gate_id (FK)     │            │
           │ house_id (FK)   │      │ lane_name        │            │
           │ phone_number    │      │ direction_enum   │            │
           │ is_house_owner  │      └────────┬─────────┘            │
           └────────┬────────┘               │                      │
                    │           ┌────────────┼──────────────────┐   │
        ┌───────────┼───┐       │            │                  │   │
        │           │   │       ▼            ▼                  │   │
        ▼           ▼   │  ┌─────────┐  ┌───────────────┐      │   │
┌──────────┐ ┌──────────┐│  │IOT_DEVIC│  │SECURITY_GUARDS│     │   │
│ VEHICLES │ │  GUESTS  ││  │─────────│  │───────────────│     │   │
│──────────│ │──────────││  │device_id│  │ user_id (PK)  │◄────┘   │
│vehicle_id│ │registr_id││  │lane_id  │  │assigned_lane  │◄────────┘
│ owner_id │ │ host_id  ││  │(FK)     │  │employee_code  │
│lic_plate │ │gst_plate ││  └─────────┘  │ shift_start   │
│veh_type  │ │veh_type  ││               │ shift_end     │
│(enum)    │ │(enum)    ││               └───────┬───────┘
│ is_inside│ │start_time││                       │
│ is_active│ │ end_time ││                       │
└─────┬────┘ └─────┬────┘│                       │
      │             │    │                       │
      └─────────────┴────┴───────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                     │  ACCESS_LOGS    │
                     │─────────────────│
                     │ log_id (PK)     │
                     │ lane_id (FK)    │  ← Cập nhật từ gate_id
                     │ vehicle_id (FK) │
                     │ guest_reg_id    │
                     │ token_id (FK)   │  ← FK → access_tokens (người đi bộ/xe đạp)
                     │ guard_id (FK)   │
                     │ access_method   │
                     │ detected_text   │  ← Chuỗi OCR thô (biển số / OTP / UUID)
                     │ action_reason   │  ← Lý do mở thủ công (UC-07)
                     │ image_snapshot  │
                     │is_access_granted│
                     └─────────────────┘
```

### 6.2 Database Schema (13 Bảng — Đã tinh gọn)

#### 6.2.1 Enum Types

```sql
CREATE TYPE user_role_enum AS ENUM ('citizen', 'guard', 'manager');

-- Nhúng trực tiếp vào vehicles và guest_registrations (Xóa bảng vehicle_types riêng biệt)
CREATE TYPE vehicle_type_enum AS ENUM ('car', 'motorbike', 'bicycle', 'truck', 'emergency');

-- Dùng cho bảng lanes
CREATE TYPE direction_enum AS ENUM ('inbound', 'outbound');

CREATE TYPE access_method_enum AS ENUM ('ai_plate_recognition', 'ai_camera_otp', 'ai_camera_qr', 'manual_guard');
```

#### 6.2.2 Core Tables

| Table | Description | Columns |
|-------|-------------|---------|
| **zones** | Khu vực quản lý | zone_id, zone_name, description, created_at |
| **houses** | Căn hộ/nhà | house_id, zone_id, house_number, block_number, floor_number |
| **gates** | Cổng vật lý | gate_id, zone_id, gate_name, is_active |
| **lanes** | Làn xe *(Mới)* | lane_id (PK, VARCHAR, VD: 'MAIN-IN'), gate_id (FK → gates), lane_name, direction_enum |
| **iot_devices** | Thiết bị IoT | device_id, **lane_id (FK)**, device_name, device_type, ip_address, status |
| **users** | Người dùng (base) | user_id, username, password_hash, full_name, email, role, avatar_url |

#### 6.2.3 Role-Specific Tables (ISA relationship)

| Table | Description | Columns |
|-------|-------------|---------|
| **citizens** | Cư dân | user_id (PK/FK), house_id, phone_number, identity_card_number, is_house_owner |
| **security_guards** | Bảo vệ | user_id (PK/FK), **assigned_gate_id (FK → gates)**, employee_code, shift_start, shift_end |
| **managers** | Quản lý | user_id (PK/FK), managed_zone_id, department_name |

#### 6.2.4 Business Tables

| Table | Description | Columns |
|-------|-------------|---------|
| **vehicles** | Xe cư dân (whitelist) | vehicle_id, owner_user_id (FK), **vehicle_type_enum** *(nhúng trực tiếp)*, license_plate, vehicle_color, **is_inside** (cờ anti-passback), is_active, last_log_time |
| **guest_registrations** | Khách có hẹn | registration_id, host_id, guest_name, **vehicle_type_enum**, guest_license_plate, visit_start/end_time, status |
| **access_tokens** | Mã OTP | token_id, issued_by, token_data, valid_from, valid_until, is_used, used_at |

#### 6.2.5 Logging & Audit Tables

| Table | Description | Columns |
|-------|-------------|---------|
| **access_logs** | Log ra vào | log_id, **gate_id (FK)**, vehicle_id, guest_reg_id, **token_id (FK → access_tokens)**, guard_id, check_in_time, **detected_text** *(chuỗi OCR thô: biển số / OTP 6 số / UUID QR)*, image_snapshot_data (BYTEA), access_method, is_access_granted, **action_reason** *(lý do mở thủ công — UC-07)* |
| **system_audit_logs** | Audit trail | audit_id, actor_id, action_type, target_table, target_id, action_details, performed_at |

> **Đã xóa hoàn toàn:** `vehicle_types`, `ai_predictions`, `ai_models`.
> **FK cập nhật:** `access_logs.lane_id`, `iot_devices.lane_id`, `security_guards.assigned_lane_id` — tất cả trỏ vào bảng `lanes` thay vì `gates`.
### 6.3 Data Storage Strategy

#### Binary Image Storage (BYTEA)

Hệ thống lưu trữ hình ảnh trực tiếp trong PostgreSQL dưới dạng binary:

```javascript
// Chuyển đổi Base64 → Buffer → BYTEA
const base64ToBuffer = (base64String) => {
    const base64Data = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;
    return Buffer.from(base64Data, 'base64');
};

// Đọc từ DB: ENCODE(image_data, 'base64') AS image_base64
```

**Lý do chọn BYTEA thay vì File System/S3:**
- Đảm bảo tính toàn vẹn dữ liệu (ACID)
- Backup cùng database
- Không cần quản lý file paths
- Phù hợp với quy mô dự án

### 6.4 Data Integrity Constraints

```sql
-- Foreign Key với CASCADE
vehicles.owner_user_id REFERENCES users(user_id) ON DELETE CASCADE
access_logs.lane_id REFERENCES lanes(lane_id)
access_logs.token_id REFERENCES access_tokens(token_id) ON DELETE SET NULL

-- Foreign Key với SET NULL
citizens.house_id REFERENCES houses(house_id) ON DELETE SET NULL
managers.managed_zone_id REFERENCES zones(zone_id) ON DELETE SET NULL

-- UNIQUE constraints
users.username UNIQUE
vehicles.license_plate UNIQUE
citizens.phone_number UNIQUE
security_guards.employee_code UNIQUE
```

---

## 7. IOT GATEWAY IMPLEMENTATION (PYTHON)

### 7.1 Tổng quan IoT Gateway

IoT Gateway đóng vai trò cầu nối giữa Backend (Node.js) và Hardware (Arduino):

```
┌──────────────┐        HTTP/MQTT         ┌──────────────┐        Serial         ┌──────────────┐
│   Backend    │ ──────────────────────►  │ IoT Gateway  │ ──────────────────►  │   Arduino    │
│   (Node.js)  │         Command          │   (Python)   │       Command        │   (Servo)    │
│              │ ◄──────────────────────  │              │ ◄──────────────────  │              │
│              │         Response         │              │        Status        │              │
└──────────────┘                          └──────────────┘                      └──────────────┘
```

### 7.2 Cấu trúc thư mục IoT Gateway

```
iot_gateway/
├── main.py                 # Entry point
├── config.py               # Configuration
├── requirements.txt        # Dependencies
├── gateway/
│   ├── __init__.py
│   ├── http_server.py      # Flask HTTP API
│   ├── mqtt_client.py      # MQTT subscriber (optional)
│   ├── serial_controller.py # PySerial communication
│   └── command_handler.py  # Business logic
├── hardware/
│   ├── __init__.py
│   └── arduino_protocol.py # Protocol definition
└── utils/
    ├── __init__.py
    └── logger.py           # Logging utility
```

### 7.3 Implementation Code

#### `config.py` - Configuration

```python
"""
IoT Gateway Configuration
"""
import os
from dataclasses import dataclass

@dataclass
class Config:
    # Serial Port Configuration
    SERIAL_PORT: str = os.getenv('SERIAL_PORT', 'COM3')  # Windows: COM3, Linux: /dev/ttyUSB0
    SERIAL_BAUDRATE: int = int(os.getenv('SERIAL_BAUDRATE', '9600'))
    SERIAL_TIMEOUT: float = float(os.getenv('SERIAL_TIMEOUT', '1.0'))
    
    # HTTP Server Configuration
    HTTP_HOST: str = os.getenv('HTTP_HOST', '0.0.0.0')
    HTTP_PORT: int = int(os.getenv('HTTP_PORT', '8080'))
    
    # MQTT Configuration (Optional)
    MQTT_BROKER: str = os.getenv('MQTT_BROKER', 'localhost')
    MQTT_PORT: int = int(os.getenv('MQTT_PORT', '1883'))
    MQTT_TOPIC_COMMAND: str = os.getenv('MQTT_TOPIC_COMMAND', 'smartgate/command')
    MQTT_TOPIC_STATUS: str = os.getenv('MQTT_TOPIC_STATUS', 'smartgate/status')
    
    # Gate Configuration
    GATE_ID: int = int(os.getenv('GATE_ID', '1'))
    BARRIER_OPEN_DURATION: int = int(os.getenv('BARRIER_OPEN_DURATION', '5'))  # seconds
    
    # Logging
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')

config = Config()
```

#### `hardware/arduino_protocol.py` - Protocol Definition

```python
"""
Arduino Communication Protocol
Defines command structure for serial communication
"""
from enum import Enum
from dataclasses import dataclass
from typing import Optional


class CommandType(Enum):
    """Available commands for barrier control"""
    OPEN = "OPEN"           # Open barrier
    CLOSE = "CLOSE"         # Close barrier
    STATUS = "STATUS"       # Get current status
    BUZZER_ON = "BUZZ_ON"   # Turn on warning buzzer
    BUZZER_OFF = "BUZZ_OFF" # Turn off warning buzzer
    LED_GREEN = "LED_G"     # Green LED (access granted)
    LED_RED = "LED_R"       # Red LED (access denied)
    HEARTBEAT = "HB"        # Health check


class BarrierStatus(Enum):
    """Barrier states"""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    MOVING = "MOVING"
    ERROR = "ERROR"
    UNKNOWN = "UNKNOWN"


@dataclass
class ArduinoCommand:
    """Command to send to Arduino"""
    command: CommandType
    duration: Optional[int] = None  # Optional duration in seconds
    
    def to_serial(self) -> str:
        """Convert to serial string format"""
        if self.duration:
            return f"{self.command.value}:{self.duration}\n"
        return f"{self.command.value}\n"


@dataclass
class ArduinoResponse:
    """Response from Arduino"""
    success: bool
    status: BarrierStatus
    message: str
    
    @classmethod
    def from_serial(cls, raw: str) -> 'ArduinoResponse':
        """Parse serial response from Arduino"""
        raw = raw.strip()
        
        if raw.startswith("OK"):
            parts = raw.split(":")
            status_str = parts[1] if len(parts) > 1 else "UNKNOWN"
            try:
                status = BarrierStatus(status_str)
            except ValueError:
                status = BarrierStatus.UNKNOWN
            return cls(success=True, status=status, message=raw)
        
        elif raw.startswith("ERR"):
            return cls(success=False, status=BarrierStatus.ERROR, message=raw)
        
        else:
            return cls(success=False, status=BarrierStatus.UNKNOWN, message=raw)
```

#### `gateway/serial_controller.py` - Serial Communication

```python
"""
Serial Controller
Handles communication with Arduino via PySerial
"""
import serial
import threading
import time
from typing import Optional, Callable
from queue import Queue

from config import config
from hardware.arduino_protocol import (
    ArduinoCommand, 
    ArduinoResponse, 
    CommandType,
    BarrierStatus
)
from utils.logger import get_logger

logger = get_logger(__name__)


class SerialController:
    """Manages serial connection to Arduino"""
    
    def __init__(self):
        self._serial: Optional[serial.Serial] = None
        self._lock = threading.Lock()
        self._command_queue: Queue = Queue()
        self._is_running = False
        self._worker_thread: Optional[threading.Thread] = None
        self._status_callback: Optional[Callable] = None
        self._current_status = BarrierStatus.UNKNOWN
    
    def connect(self) -> bool:
        """Establish serial connection to Arduino"""
        try:
            self._serial = serial.Serial(
                port=config.SERIAL_PORT,
                baudrate=config.SERIAL_BAUDRATE,
                timeout=config.SERIAL_TIMEOUT
            )
            time.sleep(2)  # Wait for Arduino to reset
            logger.info(f"Connected to Arduino on {config.SERIAL_PORT}")
            return True
        except serial.SerialException as e:
            logger.error(f"Failed to connect to Arduino: {e}")
            return False
    
    def disconnect(self):
        """Close serial connection"""
        self._is_running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=2)
        if self._serial and self._serial.is_open:
            self._serial.close()
            logger.info("Disconnected from Arduino")
    
    def start_worker(self):
        """Start background worker for processing commands"""
        self._is_running = True
        self._worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self._worker_thread.start()
        logger.info("Serial worker started")
    
    def _process_queue(self):
        """Background worker to process command queue"""
        while self._is_running:
            try:
                if not self._command_queue.empty():
                    command = self._command_queue.get(timeout=0.1)
                    self._send_command(command)
                else:
                    time.sleep(0.1)
            except Exception as e:
                logger.error(f"Error processing command queue: {e}")
    
    def send_command(self, command: ArduinoCommand) -> ArduinoResponse:
        """Send command to Arduino (blocking)"""
        with self._lock:
            return self._send_command(command)
    
    def _send_command(self, command: ArduinoCommand) -> ArduinoResponse:
        """Internal method to send command"""
        if not self._serial or not self._serial.is_open:
            return ArduinoResponse(
                success=False, 
                status=BarrierStatus.ERROR,
                message="Serial connection not open"
            )
        
        try:
            # Clear buffers
            self._serial.reset_input_buffer()
            
            # Send command
            cmd_str = command.to_serial()
            self._serial.write(cmd_str.encode('utf-8'))
            logger.debug(f"Sent: {cmd_str.strip()}")
            
            # Wait for response
            time.sleep(0.1)
            response_raw = self._serial.readline().decode('utf-8')
            logger.debug(f"Received: {response_raw.strip()}")
            
            response = ArduinoResponse.from_serial(response_raw)
            
            if response.success:
                self._current_status = response.status
                if self._status_callback:
                    self._status_callback(response.status)
            
            return response
            
        except Exception as e:
            logger.error(f"Error sending command: {e}")
            return ArduinoResponse(
                success=False,
                status=BarrierStatus.ERROR,
                message=str(e)
            )
    
    def open_barrier(self, duration: int = None) -> ArduinoResponse:
        """Open the barrier"""
        duration = duration or config.BARRIER_OPEN_DURATION
        return self.send_command(ArduinoCommand(CommandType.OPEN, duration))
    
    def close_barrier(self) -> ArduinoResponse:
        """Close the barrier"""
        return self.send_command(ArduinoCommand(CommandType.CLOSE))
    
    def get_status(self) -> ArduinoResponse:
        """Get current barrier status"""
        return self.send_command(ArduinoCommand(CommandType.STATUS))
    
    def signal_granted(self) -> ArduinoResponse:
        """Signal access granted (green LED)"""
        return self.send_command(ArduinoCommand(CommandType.LED_GREEN))
    
    def signal_denied(self) -> ArduinoResponse:
        """Signal access denied (red LED + buzzer)"""
        self.send_command(ArduinoCommand(CommandType.LED_RED))
        return self.send_command(ArduinoCommand(CommandType.BUZZER_ON))
    
    def heartbeat(self) -> bool:
        """Check if Arduino is responsive"""
        response = self.send_command(ArduinoCommand(CommandType.HEARTBEAT))
        return response.success
    
    def set_status_callback(self, callback: Callable):
        """Set callback for status changes"""
        self._status_callback = callback
    
    @property
    def current_status(self) -> BarrierStatus:
        return self._current_status
```

#### `gateway/command_handler.py` - Business Logic

```python
"""
Command Handler
Processes commands from Backend and orchestrates Arduino operations
"""
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any
import time

from gateway.serial_controller import SerialController
from hardware.arduino_protocol import BarrierStatus
from utils.logger import get_logger
from config import config

logger = get_logger(__name__)


class ActionType(Enum):
    """Actions received from Backend"""
    OPEN = "OPEN"
    KEEP_CLOSED = "KEEP_CLOSED"
    EMERGENCY_OPEN = "EMERGENCY_OPEN"
    TEST = "TEST"


@dataclass
class GateCommand:
    """Command structure from Backend"""
    action: ActionType
    gate_id: int
    log_id: int = None
    plate_text: str = None
    access_type: str = None  # 'resident', 'guest', 'otp', 'manual'
    duration: int = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GateCommand':
        """Parse from JSON request"""
        return cls(
            action=ActionType(data.get('action', 'KEEP_CLOSED')),
            gate_id=data.get('gate_id', config.GATE_ID),
            log_id=data.get('log_id'),
            plate_text=data.get('plate_text'),
            access_type=data.get('access_type'),
            duration=data.get('duration')
        )


@dataclass
class GateResponse:
    """Response structure to Backend"""
    success: bool
    gate_id: int
    barrier_status: str
    message: str
    execution_time_ms: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'gate_id': self.gate_id,
            'barrier_status': self.barrier_status,
            'message': self.message,
            'execution_time_ms': self.execution_time_ms
        }


class CommandHandler:
    """Handles gate commands from Backend"""
    
    def __init__(self, serial_controller: SerialController):
        self._serial = serial_controller
        self._gate_id = config.GATE_ID
    
    def handle_command(self, command: GateCommand) -> GateResponse:
        """Process incoming command"""
        start_time = time.time()
        
        logger.info(f"Processing command: {command.action.value} for gate {command.gate_id}")
        
        # Verify gate_id matches this gateway
        if command.gate_id != self._gate_id:
            return GateResponse(
                success=False,
                gate_id=self._gate_id,
                barrier_status=self._serial.current_status.value,
                message=f"Gate ID mismatch. This gateway controls gate {self._gate_id}",
                execution_time_ms=int((time.time() - start_time) * 1000)
            )
        
        # Route to appropriate handler
        if command.action == ActionType.OPEN:
            return self._handle_open(command, start_time)
        elif command.action == ActionType.KEEP_CLOSED:
            return self._handle_keep_closed(command, start_time)
        elif command.action == ActionType.EMERGENCY_OPEN:
            return self._handle_emergency(command, start_time)
        elif command.action == ActionType.TEST:
            return self._handle_test(start_time)
        else:
            return GateResponse(
                success=False,
                gate_id=self._gate_id,
                barrier_status=self._serial.current_status.value,
                message=f"Unknown action: {command.action}",
                execution_time_ms=int((time.time() - start_time) * 1000)
            )
    
    def _handle_open(self, command: GateCommand, start_time: float) -> GateResponse:
        """Handle OPEN command - access granted"""
        logger.info(f"Opening barrier for {command.access_type}: {command.plate_text}")
        
        # Signal granted (green LED)
        self._serial.signal_granted()
        
        # Open barrier
        duration = command.duration or config.BARRIER_OPEN_DURATION
        response = self._serial.open_barrier(duration)
        
        return GateResponse(
            success=response.success,
            gate_id=self._gate_id,
            barrier_status=response.status.value,
            message=f"Barrier opened for {command.plate_text}" if response.success else response.message,
            execution_time_ms=int((time.time() - start_time) * 1000)
        )
    
    def _handle_keep_closed(self, command: GateCommand, start_time: float) -> GateResponse:
        """Handle KEEP_CLOSED command - access denied"""
        logger.info(f"Keeping barrier closed for: {command.plate_text}")
        
        # Signal denied (red LED + short buzzer)
        self._serial.signal_denied()
        
        return GateResponse(
            success=True,
            gate_id=self._gate_id,
            barrier_status=BarrierStatus.CLOSED.value,
            message=f"Access denied for {command.plate_text}",
            execution_time_ms=int((time.time() - start_time) * 1000)
        )
    
    def _handle_emergency(self, command: GateCommand, start_time: float) -> GateResponse:
        """Handle EMERGENCY_OPEN command - immediate open"""
        logger.warning("EMERGENCY OPEN triggered!")
        
        # Open immediately without duration limit
        response = self._serial.open_barrier(duration=30)  # 30 seconds for emergency
        
        return GateResponse(
            success=response.success,
            gate_id=self._gate_id,
            barrier_status=response.status.value,
            message="Emergency barrier open" if response.success else response.message,
            execution_time_ms=int((time.time() - start_time) * 1000)
        )
    
    def _handle_test(self, start_time: float) -> GateResponse:
        """Handle TEST command - heartbeat check"""
        is_responsive = self._serial.heartbeat()
        
        return GateResponse(
            success=is_responsive,
            gate_id=self._gate_id,
            barrier_status=self._serial.current_status.value,
            message="Gateway and Arduino responsive" if is_responsive else "Arduino not responding",
            execution_time_ms=int((time.time() - start_time) * 1000)
        )
    
    def get_status(self) -> GateResponse:
        """Get current gate status"""
        start_time = time.time()
        response = self._serial.get_status()
        
        return GateResponse(
            success=response.success,
            gate_id=self._gate_id,
            barrier_status=response.status.value,
            message=response.message,
            execution_time_ms=int((time.time() - start_time) * 1000)
        )
```

#### `gateway/http_server.py` - Flask HTTP API

```python
"""
HTTP Server
REST API for receiving commands from Backend
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading

from gateway.command_handler import CommandHandler, GateCommand
from gateway.serial_controller import SerialController
from config import config
from utils.logger import get_logger

logger = get_logger(__name__)


def create_app(command_handler: CommandHandler) -> Flask:
    """Create Flask application"""
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'ok',
            'gate_id': config.GATE_ID,
            'message': 'IoT Gateway is running'
        })
    
    @app.route('/api/v1/command', methods=['POST'])
    def receive_command():
        """
        Receive command from Backend
        
        Expected JSON:
        {
            "action": "OPEN" | "KEEP_CLOSED" | "EMERGENCY_OPEN" | "TEST",
            "gate_id": 1,
            "log_id": 123,
            "plate_text": "51A-12345",
            "access_type": "resident" | "guest" | "otp" | "manual",
            "duration": 5
        }
        """
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'Invalid JSON'}), 400
            
            command = GateCommand.from_dict(data)
            response = command_handler.handle_command(command)
            
            return jsonify(response.to_dict()), 200 if response.success else 500
            
        except ValueError as e:
            logger.error(f"Invalid command: {e}")
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            logger.error(f"Command processing error: {e}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @app.route('/api/v1/status', methods=['GET'])
    def get_status():
        """Get current gate status"""
        response = command_handler.get_status()
        return jsonify(response.to_dict())
    
    @app.route('/api/v1/open', methods=['POST'])
    def manual_open():
        """Manual open command (for testing)"""
        command = GateCommand.from_dict({
            'action': 'OPEN',
            'gate_id': config.GATE_ID,
            'access_type': 'manual_test'
        })
        response = command_handler.handle_command(command)
        return jsonify(response.to_dict())
    
    @app.route('/api/v1/close', methods=['POST'])
    def manual_close():
        """Manual close command (for testing)"""
        serial_controller = command_handler._serial
        response = serial_controller.close_barrier()
        return jsonify({
            'success': response.success,
            'status': response.status.value,
            'message': response.message
        })
    
    return app


def start_http_server(command_handler: CommandHandler):
    """Start Flask HTTP server in a thread"""
    app = create_app(command_handler)
    
    logger.info(f"Starting HTTP server on {config.HTTP_HOST}:{config.HTTP_PORT}")
    
    # Use production server in deployment
    app.run(
        host=config.HTTP_HOST,
        port=config.HTTP_PORT,
        debug=False,
        threaded=True
    )
```

#### `utils/logger.py` - Logging Utility

```python
"""
Logger Utility
Structured logging for IoT Gateway
"""
import logging
import sys
from config import config


def get_logger(name: str) -> logging.Logger:
    """Get configured logger instance"""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
        log_level = getattr(logging, config.LOG_LEVEL.upper(), logging.INFO)
        logger.setLevel(log_level)
    
    return logger
```

#### `main.py` - Entry Point

```python
"""
IoT Gateway - Main Entry Point
Smart Toll Gate System
"""
import signal
import sys
import time

from gateway.serial_controller import SerialController
from gateway.command_handler import CommandHandler
from gateway.http_server import start_http_server
from config import config
from utils.logger import get_logger

logger = get_logger('main')


def main():
    """Main entry point"""
    logger.info("=" * 50)
    logger.info("  SMART TOLL GATE - IoT Gateway")
    logger.info(f"  Gate ID: {config.GATE_ID}")
    logger.info("=" * 50)
    
    # Initialize serial controller
    serial_controller = SerialController()
    
    # Connect to Arduino
    logger.info(f"Connecting to Arduino on {config.SERIAL_PORT}...")
    if not serial_controller.connect():
        logger.error("Failed to connect to Arduino. Exiting.")
        sys.exit(1)
    
    # Start serial worker
    serial_controller.start_worker()
    
    # Initial status check
    status = serial_controller.get_status()
    logger.info(f"Initial barrier status: {status.status.value}")
    
    # Initialize command handler
    command_handler = CommandHandler(serial_controller)
    
    # Graceful shutdown handler
    def shutdown_handler(signum, frame):
        logger.info("\nShutting down IoT Gateway...")
        serial_controller.disconnect()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)
    
    # Start HTTP server (blocking)
    try:
        start_http_server(command_handler)
    except Exception as e:
        logger.error(f"HTTP server error: {e}")
        serial_controller.disconnect()
        sys.exit(1)


if __name__ == '__main__':
    main()
```

#### `requirements.txt` - Dependencies

```
flask>=2.0.0
flask-cors>=3.0.0
pyserial>=3.5
python-dotenv>=0.19.0
```

### 7.4 Arduino Sketch (Reference)

```cpp
/*
 * Smart Toll Gate - Arduino Barrier Controller
 * Receives commands via Serial, controls servo motor
 */

#include <Servo.h>

// Pin definitions
#define SERVO_PIN 9
#define LED_GREEN_PIN 10
#define LED_RED_PIN 11
#define BUZZER_PIN 12

// Servo positions
#define BARRIER_OPEN_ANGLE 90
#define BARRIER_CLOSED_ANGLE 0

Servo barrierServo;
String inputString = "";
bool stringComplete = false;
String currentStatus = "CLOSED";

void setup() {
    Serial.begin(9600);
    inputString.reserve(50);
    
    barrierServo.attach(SERVO_PIN);
    barrierServo.write(BARRIER_CLOSED_ANGLE);
    
    pinMode(LED_GREEN_PIN, OUTPUT);
    pinMode(LED_RED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    
    // Initial state
    digitalWrite(LED_GREEN_PIN, LOW);
    digitalWrite(LED_RED_PIN, HIGH);
    
    Serial.println("OK:CLOSED");
}

void loop() {
    if (stringComplete) {
        processCommand(inputString);
        inputString = "";
        stringComplete = false;
    }
}

void serialEvent() {
    while (Serial.available()) {
        char inChar = (char)Serial.read();
        inputString += inChar;
        if (inChar == '\n') {
            stringComplete = true;
        }
    }
}

void processCommand(String cmd) {
    cmd.trim();
    
    if (cmd.startsWith("OPEN")) {
        int duration = 5; // default 5 seconds
        int colonIndex = cmd.indexOf(':');
        if (colonIndex > 0) {
            duration = cmd.substring(colonIndex + 1).toInt();
        }
        openBarrier(duration);
    }
    else if (cmd == "CLOSE") {
        closeBarrier();
    }
    else if (cmd == "STATUS") {
        Serial.println("OK:" + currentStatus);
    }
    else if (cmd == "LED_G") {
        digitalWrite(LED_GREEN_PIN, HIGH);
        digitalWrite(LED_RED_PIN, LOW);
        Serial.println("OK:" + currentStatus);
    }
    else if (cmd == "LED_R") {
        digitalWrite(LED_GREEN_PIN, LOW);
        digitalWrite(LED_RED_PIN, HIGH);
        Serial.println("OK:" + currentStatus);
    }
    else if (cmd == "BUZZ_ON") {
        tone(BUZZER_PIN, 1000, 500);
        Serial.println("OK:" + currentStatus);
    }
    else if (cmd == "BUZZ_OFF") {
        noTone(BUZZER_PIN);
        Serial.println("OK:" + currentStatus);
    }
    else if (cmd == "HB") {
        Serial.println("OK:" + currentStatus);
    }
    else {
        Serial.println("ERR:Unknown command");
    }
}

void openBarrier(int durationSeconds) {
    currentStatus = "MOVING";
    Serial.println("OK:MOVING");
    
    barrierServo.write(BARRIER_OPEN_ANGLE);
    delay(500);
    
    currentStatus = "OPEN";
    Serial.println("OK:OPEN");
    
    // Auto-close after duration
    delay(durationSeconds * 1000);
    closeBarrier();
}

void closeBarrier() {
    currentStatus = "MOVING";
    barrierServo.write(BARRIER_CLOSED_ANGLE);
    delay(500);
    
    currentStatus = "CLOSED";
    Serial.println("OK:CLOSED");
    
    // Reset LEDs
    digitalWrite(LED_GREEN_PIN, LOW);
    digitalWrite(LED_RED_PIN, HIGH);
}
```

### 7.5 Integration với Backend

Backend gửi command đến IoT Gateway qua HTTP:

```javascript
// backend/src/services/iot.service.js
const axios = require('axios');

const IOT_GATEWAY_URL = process.env.IOT_GATEWAY_URL || 'http://localhost:8080';

const sendGateCommand = async ({ action, gateId, logId, plateText, accessType, duration }) => {
    try {
        const response = await axios.post(`${IOT_GATEWAY_URL}/api/v1/command`, {
            action,
            gate_id: gateId,
            log_id: logId,
            plate_text: plateText,
            access_type: accessType,
            duration
        }, {
            timeout: 5000
        });
        
        return response.data;
    } catch (error) {
        console.error('IoT Gateway error:', error.message);
        throw error;
    }
};

module.exports = { sendGateCommand };
```

---

## 8. PHỤ LỤC

### 8.1 API Endpoints Summary

| Module | Method | Endpoint | Description |
|--------|--------|----------|-------------|
| **Auth** | POST | /api/v1/auth/login | Đăng nhập |
| | GET | /api/v1/auth/me | Thông tin user hiện tại |
| **Citizens** | POST | /api/v1/citizens/tokens | Tạo OTP |
| | GET | /api/v1/citizens/tokens | Danh sách OTP |
| | GET | /api/v1/citizens/vehicles | Danh sách xe |
| | POST | /api/v1/citizens/vehicles | Đăng ký xe mới |
| | GET | /api/v1/citizens/guests | Danh sách khách |
| | POST | /api/v1/citizens/guests | Đăng ký khách |
| **Guards** | POST | /api/v1/guards/verify-otp | Xác thực OTP |
| | POST | /api/v1/guards/manual-action | Thao tác thủ công |
| | GET | /api/v1/guards/logs | Access logs gần nhất |
| | GET | /api/v1/guards/stats | Thống kê cổng |
| **Gates** | POST | /api/v1/gates/check-in | AI check-in |
| | POST | /api/v1/gates/verify-camera-otp | AI Service gửi kết quả OCR OTP/QR đọc từ màn hình điện thoại |
| **Managers** | GET | /api/v1/managers/analytics/* | Thống kê |
| | GET | /api/v1/managers/logs | Tra cứu logs |
| | GET | /api/v1/managers/vehicles/pending | Xe chờ duyệt |
| | POST | /api/v1/managers/vehicles/:id/approve | Phê duyệt xe |
| | GET | /api/v1/managers/dashboard | Dashboard KPIs (Traffic, Automation Rate, Alerts, Visitors) |

### 8.2 Test Coverage

Hệ thống có **37 automated tests** covering:
- Authentication (5 tests)
- Citizens Module (5 tests)
- Guards Module (6 tests)
- Gates Module (2 tests)
- Managers Module (13 tests)
- Authorization (3 tests)

### 8.3 Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5433
DB_USER=admin
DB_PASS=12345678
DB_NAME=iot_main_db_252

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# IoT Gateway
IOT_GATEWAY_URL=http://localhost:8080
```

---

## 10. MANAGER DASHBOARD KPIs

Dashboard dành cho Manager được thiết kế **tối giản, loại bỏ các biểu đồ rườm rà**, tập trung hiển thị trực tiếp **4 chỉ số cốt lõi (KPIs)** phản ánh tình trạng vận hành khu dân cư theo thời gian thực.

| # | KPI | Mô tả | Nguồn dữ liệu |
|---|-----|--------|---------------|
| **1** | **Total Traffic Volume** | Tổng số lượt ra vào trong ngày (tính từ 0:00 đến hiện tại) | `COUNT(*) FROM access_logs WHERE DATE = TODAY` |
| **2** | **Automation Rate** | Tỉ lệ % cổng tự động mở thành công (do AI nhận diện biển số hoặc Camera OCR đọc OTP/QR) trên tổng số lượt | `COUNT(*) WHERE access_method IN ('ai_plate_recognition','ai_camera_otp','ai_camera_qr') AND is_access_granted = true` |
| **3** | **Security Alerts** | Tổng số lượt truy cập bị từ chối (xe không rõ nguồn gốc, OTP sai, anti-passback) | `COUNT(*) WHERE is_access_granted = false` |
| **4** | **Active Visitors** | Số lượng khách vãng lai đang còn lưu trú trong khu (Số lượt Inbound − Số lượt Outbound từ `guest_registrations`) | `SUM(inbound) - SUM(outbound) FROM access_logs JOIN guest_registrations` |

> **Ghi chú thiết kế:** Các KPIs chiết xuất trực tiếp từ bảng `access_logs` mà không cần bảng AI phụ trợ. Cột `action_reason` giúp bảo vệ giải thích minh bạch từng lượt mở cổng thủ công trên bảng lịch sử ca trực.

---

**Kết thúc báo cáo.**
