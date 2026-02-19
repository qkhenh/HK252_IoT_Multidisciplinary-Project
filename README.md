# HỆ THỐNG KIỂM SOÁT RA VÀO THÔNG MINH (SMART TOLL GATE)

## 1. Tổng quan dự án (Project Overview)

**Smart Toll Gate** là hệ thống quản lý kiểm soát phương tiện ra vào khu dân cư/chung cư tự động, tích hợp giữa Internet of Things (IoT) và Trí tuệ Nhân tạo (AI). Hệ thống hướng tới việc số hóa toàn bộ quy trình kiểm soát an ninh, giảm thiểu thao tác thủ công của lực lượng bảo vệ, đồng thời cung cấp trải nghiệm tiện lợi, minh bạch cho cư dân.

### Kiến trúc Công nghệ cốt lõi:

*   **Hardware (IoT):** Mạch Arduino điều khiển Barrier, nhận tín hiệu đóng/mở và quản lý hệ thống cảnh báo (đèn/còi).
*   **AI Service:** Xử lý hình ảnh qua 2 giai đoạn sử dụng Python:
    1.  **YOLOv8** để phát hiện và cắt (crop) vùng chứa biển số.
    2.  **Mô hình OCR** để trích xuất chuỗi ký tự biển số.
*   **Backend & Cơ sở dữ liệu:** Node.js làm máy chủ trung tâm xử lý logic. PostgreSQL quản lý dữ liệu quan hệ (16 bảng) và lưu trữ trực tiếp hình ảnh (chuẩn BYTEA) để đảm bảo tính toàn vẹn.
*   **Mô hình phân quyền:** Disjoint Total (Người dùng chỉ mang một vai trò duy nhất: Quản lý, Bảo vệ, hoặc Cư dân).

---

## 2. Kịch bản Nghiệp vụ (Business Scenarios)

Hệ thống được thiết kế để xử lý mượt mà luồng cơ bản và giải quyết triệt để 4 trường hợp ngoại lệ (Edge Cases) thường gặp trong quản lý khu dân cư:

*   **Happy Path (Xe cư dân hợp lệ):** Xe tiến vào vùng nhận diện -> Camera chụp ảnh -> AI đọc biển số -> Khớp với Whitelist cứng -> Barrier tự động mở.
*   **Trường hợp xe đạp/người đi bộ (Không biển số):** Không sử dụng AI. Cư dân sử dụng ứng dụng di động để quét mã định danh (QR Code) hoặc quẹt thẻ RFID tại đầu đọc -> Barrier mở.
*   **Edge Case 1 - Shipper giao hàng:** Lực lượng giao hàng dừng tại cổng. Bảo vệ ghi nhận sự kiện vào hệ thống với phân loại "Shipper" -> Không mở Barrier, giao nhận thực hiện tại sảnh.
*   **Edge Case 2.1 - Khách có báo trước:** Cư dân đăng ký thông tin khách và biển số xe trước 24h trên hệ thống. Xe khách đến -> AI nhận diện khớp với Whitelist tạm thời -> Barrier tự động mở.
*   **Edge Case 2.2 - Khách đến đột xuất:** Khách bị chặn tại cổng -> Cư dân tạo mã OTP 6 số (hiệu lực 15 phút) trên ứng dụng và đọc cho khách -> Khách báo mã cho bảo vệ nhập vào hệ thống -> Mã hợp lệ -> Barrier mở.

---

## 3. Yêu cầu Chức năng Chi tiết (Functional Requirements)

Hệ thống được chia thành 4 phân hệ chính, phục vụ cho các đối tượng và luồng xử lý khác nhau.

### 3.1. Phân hệ Lõi & Tự động hóa (Core System & IoT)
*Đây là các chức năng chạy ngầm, không có giao diện trực tiếp nhưng là xương sống của hệ thống.*

*   **FR_SYS_01 - Xử lý Nhận diện AI:** Hệ thống phải tiếp nhận hình ảnh từ Camera, gửi cho dịch vụ AI (Python) phân tích. Đầu ra phải bao gồm: Chuỗi text biển số, Độ tin cậy (Confidence score), Ảnh toàn cảnh và Ảnh crop biển số.
*   **FR_SYS_02 - Kiểm tra Quyền truy cập:** Backend tự động đối chiếu biển số vừa nhận diện với bảng `vehicles` (cư dân) và bảng `guest_registrations` (khách có hẹn) để ra quyết định đóng/mở hợp lệ.
*   **FR_SYS_03 - Giao tiếp Thiết bị ngoại vi:** Hệ thống Backend có khả năng phát lệnh HTTP/MQTT xuống mạch Arduino để kích hoạt động cơ servo (mở barrier) với độ trễ tối thiểu.
*   **FR_SYS_04 - Lưu trữ Hình ảnh Nhị phân:** Hệ thống phải tự động chuyển đổi hình ảnh (toàn cảnh và crop) thành kiểu nhị phân và lưu thẳng vào trường dữ liệu `BYTEA` của PostgreSQL.

### 3.2. Phân hệ Cư dân (Citizen Web/App)
*Phục vụ các chủ hộ và thành viên trong nhà để tự quản lý quyền ra vào.*

*   **FR_CIT_01 - Quản lý Phương tiện cá nhân:** Cho phép cư dân xem danh sách các xe đang sở hữu. Hỗ trợ tính năng thêm xe mới (yêu cầu điền biển số, loại xe) và gửi yêu cầu chờ Ban quản lý phê duyệt.
*   **FR_CIT_02 - Đăng ký Khách (Guest Registration):** Cung cấp biểu mẫu cho phép cư dân nhập tên khách, biển số xe và thời gian dự kiến đến thăm. Hệ thống tự động cấp quyền Whitelist tạm thời trong khung giờ này.
*   **FR_CIT_03 - Khởi tạo Mã OTP Khẩn cấp:** Cung cấp nút tạo mã OTP ngẫu nhiên (6 chữ số). Hệ thống phải hiển thị rõ thời gian đếm ngược hết hạn của mã (mặc định 15 phút).
*   **FR_CIT_04 - Mã QR Định danh:** Hiển thị mã QR động đại diện cho thông tin căn hộ để cư dân sử dụng qua cổng phụ hoặc khi đi xe đạp/đi bộ.
*   **FR_CIT_05 - Tra cứu Lịch sử Cá nhân:** Cư dân chỉ được phép xem danh sách lịch sử ra vào của các xe thuộc quyền sở hữu của mình và xe của khách do mình bảo lãnh.

### 3.3. Phân hệ Lực lượng Bảo vệ (Security Guard Dashboard)
*Giao diện thời gian thực (Real-time) đặt tại nhà bốt bảo vệ để giám sát và xử lý sự cố.*

*   **FR_SEC_01 - Giám sát Thời gian thực (Live Monitoring):** Màn hình liên tục cập nhật kết quả từ AI (bao gồm ảnh chụp, text biển số và trạng thái hợp lệ/cảnh báo) mà không cần tải lại trang.
*   **FR_SEC_02 - Xác thực OTP (Guest Check-in):** Cung cấp ô nhập liệu để bảo vệ điền mã OTP do khách cung cấp. Nếu hệ thống báo mã đúng, tự động mở cổng và ghi log định danh người bảo vệ thao tác.
*   **FR_SEC_03 - Thao tác Thủ công (Manual Override):** Cung cấp các nút bấm vật lý/ảo để Mở hoặc Đóng cổng khẩn cấp. Bắt buộc bảo vệ phải chọn lý do từ danh sách có sẵn (VD: Xe cứu thương, Shipper, Lỗi AI) hoặc nhập tay trước khi cổng mở.
*   **FR_SEC_04 - Cải thiện Dữ liệu AI (Human-in-the-loop):** Trong trường hợp hệ thống AI nhận dạng sai ký tự, cung cấp cơ chế cho bảo vệ sửa lại chuỗi biển số đúng. Thông tin này được lưu vào bảng `ai_predictions` để phục vụ tái huấn luyện (retrain) mô hình sau này.

### 3.4. Phân hệ Ban Quản lý (Manager Dashboard)
*Giao diện quản trị cấp cao, dữ liệu được phân vùng dựa trên Khu vực (Zone) mà Manager đó phụ trách.*

*   **FR_MAN_01 - Phê duyệt Phương tiện:** Xem xét, chấp nhận hoặc từ chối các yêu cầu đăng ký xe mới của cư dân trong phân khu mình quản lý.
*   **FR_MAN_02 - Thống kê Lưu lượng (Analytics):** Cung cấp dữ liệu đã được tổng hợp để hiển thị trên biểu đồ (vẽ tại phía Client) về số lượt xe vào/ra theo ngày, giờ cao điểm, tỷ lệ loại xe.
*   **FR_MAN_03 - Tra cứu Nhật ký Hệ thống (Access & Audit Logs):** Cung cấp công cụ tìm kiếm, lọc lịch sử ra vào chi tiết (bao gồm việc trích xuất và hiển thị trực tiếp ảnh `BYTEA` từ Database). Xem nhật ký thao tác của lực lượng bảo vệ.
*   **FR_MAN_04 - Đánh giá Hiệu năng AI:** Xem báo cáo về độ chính xác của AI (dựa trên điểm Confidence Score và số lần bị bảo vệ sửa tay), quản lý các phiên bản `ai_models` đang được kích hoạt.

