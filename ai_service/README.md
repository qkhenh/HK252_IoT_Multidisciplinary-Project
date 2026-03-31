# 🚗 Smart Toll Gate - AI Service (License Plate Recognition)

Module này chịu trách nhiệm chụp ảnh từ Camera, sử dụng AI (YOLOv8 + EasyOCR) để bóc tách biển số xe và gửi dữ liệu về Node.js Backend.

## 🛠 Yêu cầu hệ thống (Prerequisites)
- **Python:** Phiên bản `3.11` (Bắt buộc để tránh lỗi C++ của thư viện Paddle/OpenCV).
- **Webcam:** Laptop có tích hợp camera hoặc cắm camera rời.
- **Mô hình YOLO:** Cần có file mô hình đã train (ví dụ: `best.pt`) đặt trong cùng thư mục này.

## 🚀 Hướng dẫn cài đặt (Setup Instructions)

**Bước 1: Khởi tạo môi trường ảo (Virtual Environment)**
Mở Terminal tại thư mục `ai_service` và chạy lệnh:
`py -3.11 -m venv venv_ai`

**Bước 2: Kích hoạt môi trường**
- Trên Windows: `.\venv_ai\Scripts\activate`
- Trên Mac/Linux: `source venv_ai/bin/activate`

**Bước 3: Cài đặt thư viện**
Chạy lệnh sau để tải toàn bộ các thư viện cần thiết:
`pip install -r requirements.txt`

## 🎮 Hướng dẫn sử dụng (How to run)

1. Đảm bảo Node.js Backend đã được khởi động và đang chạy (Mặc định ở `http://localhost:3000`).
2. Mở Terminal (đã kích hoạt `venv_ai`) và chạy lệnh:
   `python camera_app.py`
3. Cửa sổ Live Camera sẽ hiện lên. 
4. **Thao tác:**
   - Bấm phím **`C`**: Chụp ảnh, nhận diện biển số và tự động gửi sang Backend.
   - Bấm phím **`Q`**: Tắt Camera và thoát chương trình.

## 📂 Cấu trúc thư mục (Project Structure)
- `camera_app.py`: File chạy chính, quản lý Webcam và luồng gửi API.
- `ai_engine.py`: Thư viện lõi chứa logic tiền xử lý ảnh và nhận diện OCR.
- `best.pt`: File trọng số (weights) của mô hình YOLOv8.
- `requirements.txt`: Danh sách các thư viện phụ thuộc.