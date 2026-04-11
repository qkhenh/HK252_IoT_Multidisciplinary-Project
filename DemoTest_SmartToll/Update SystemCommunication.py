# import cv2
# import time
# import base64
# import requests
# import os
# import sys
# import serial  
# import unicodedata

# # Add parent directory to path to find ai_service
# sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# from ai_service.ai_engine import extract_license_plates

# # ==========================================
# # CONFIGURATION
# # ==========================================
# NODEJS_BACKEND_URL = "http://localhost:5000/api/v1/gates/check-in"
# GATE_ID = 1 
# ARDUINO_PORT = 'COM3' # Updated to match your laptop IDE
# BAUD_RATE = 9600

# # --- INITIALIZE SERIAL ---
# try:
#     ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
#     time.sleep(2) 
#     print(f"✅ Hardware Bridge Online on {ARDUINO_PORT}")
# except Exception as e:
#     print(f"⚠️ Warning: Could not connect to Arduino: {e}")
#     ser = None

# def strip_accents(text):
#     """Converts 'Lê Thị Cư Dân' to 'Le Thi Cu Dan' for the LCD."""
#     return "".join(c for c in unicodedata.normalize('NFD', text)
#                    if unicodedata.category(c) != 'Mn')

# def send_to_backend(plate_text, processing_time_ms, image_path):
#     try:
#         with open(image_path, "rb") as img_file:
#             full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            
#         payload = {
#             "gate_id": GATE_ID,
#             "plate_text": plate_text,
#             "processing_time_ms": processing_time_ms,
#             "full_image_base64": f"data:image/jpeg;base64,{full_image_base64}"
#         }
#         response = requests.post(NODEJS_BACKEND_URL, json=payload)
#         return response.json()
#     except Exception as e:
#         print(f"❌ Backend connection failed: {e}")
#         return None

# def process_and_authorize(frame):
#     """The core logic: AI -> Backend -> Hardware Trigger."""
#     print("\n[PROCESS] Starting AI extraction...")
#     start_time = time.time()
    
#     temp_path = f"temp_frame_{int(time.time())}.jpg"
#     cv2.imwrite(temp_path, frame)
    
#     ai_result = extract_license_plates(temp_path, debug=False)
#     proc_ms = int((time.time() - start_time) * 1000)
    
#     if ai_result.get("status") == "success" and ai_result.get("plates"):
#         plate_text = ai_result["plates"][0]
#         print(f"[AI] Plate Detected: {plate_text} ({proc_ms}ms)")
        
#         backend_response = send_to_backend(plate_text, proc_ms, temp_path)
        
#         # --- FIXED SAFETY LOGIC ---
#         if backend_response and backend_response.get("success"):
#             data = backend_response.get("data", {})
#             action = data.get("action")
            
#             # The 'or {}' ensures that if the backend returns None, we still have a dict to call .get() on
#             details = data.get("details") or {}
#             owner_info = details.get("owner_info") or {}
#             raw_name = owner_info.get("name", "User")
#             clean_name = strip_accents(raw_name)

#             if action == "OPEN" and ser:
#                 print(f"🔓 {data.get('message')}: {raw_name}")
#                 ser.write(f"ENTRY_GO:{clean_name}\n".encode())
#             else:
#                 print(f"⛔ Denied: {data.get('message', 'Not Authorized')}")
#                 if ser: ser.write(b"DENIED\n") # Tell Arduino to reset
#         else:
#             print("❌ Backend verification failed or Guest Detected.")
#             if ser: ser.write(b"DENIED\n")
#     else:
#         print("⚠️ No license plate found in frame.")
    
#     if os.path.exists(temp_path):
#         os.remove(temp_path)

# def main():
#     cap = cv2.VideoCapture(0)
#     if not cap.isOpened():
#         print("[ERROR] Camera access failed.")
#         return

#     print("[INFO] System Ready. Waiting for Sensor trigger...")

#     while True:
#         ret, frame = cap.read()
#         if not ret: break

#         cv2.imshow("Smart Toll Gate - Live Feed", frame)

#         if ser and ser.in_waiting > 0:
#             try:
#                 line = ser.readline().decode('utf-8').strip()
#                 if line == "CAR_ARRIVED":
#                     process_and_authorize(frame)
#             except:
#                 pass

#         key = cv2.waitKey(1) & 0xFF
#         if key == ord('c') or key == ord('C'):
#             process_and_authorize(frame)
#         elif key == ord('q') or key == ord('Q'):
#             break

#     cap.release()
#     cv2.destroyAllWindows()
#     if ser: ser.close()

# if __name__ == "__main__":
#     main()

import cv2
import time
import base64
import requests
import os
import sys
import serial  
import unicodedata
import socketio

# Nhúng thư viện AI của nhóm bạn
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_service.ai_engine import extract_license_plates

# ==========================================
# MASTER SYSTEM CONFIGURATION
# ==========================================
NODEJS_BACKEND_URL = "http://localhost:5000/api/v1/gates/check-in"
WEBSOCKET_URL = "http://localhost:5000"
GATE_ID = 1 

# Nhớ đổi cổng COM cho đúng với máy tính của bạn nhé!
ARDUINO_PORT = 'COM3' 
BAUD_RATE = 9600

# --- 1. KHỞI TẠO KẾT NỐI ARDUINO ---
try:
    ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
    time.sleep(2) 
    print(f"[OK] Đã kết nối Phần cứng Arduino tại {ARDUINO_PORT}")
except Exception as e:
    print(f"[CẢNH BÁO] Không tìm thấy Arduino: {e}")
    ser = None

# --- 2. KHỞI TẠO KẾT NỐI WEBSOCKET ---
sio = socketio.Client()

def connect_websocket():
    try:
        sio.connect(WEBSOCKET_URL)
        print("[OK] Đã kết nối luồng Video lên Web Dashboard!")
    except Exception as e:
        print(f"[CẢNH BÁO] Không kết nối được Web: {e}")

def strip_accents(text):
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def send_to_backend(plate_text, processing_time_ms, image_path):
    try:
        with open(image_path, "rb") as img_file:
            full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            
        payload = {
            "gate_id": GATE_ID,
            "plate_text": plate_text,
            "processing_time_ms": processing_time_ms,
            "full_image_base64": f"data:image/jpeg;base64,{full_image_base64}"
        }
        response = requests.post(NODEJS_BACKEND_URL, json=payload)
        return response.json(), f"data:image/jpeg;base64,{full_image_base64}"
    except Exception as e:
        print(f"❌ Kết nối Backend thất bại: {e}")
        return None, None

def process_and_authorize(frame):
    """Hàm lõi: Chụp ảnh -> Quét AI -> Gọi API -> Nháy Web -> Bật Cổng"""
    print("\n[AI] Nhận lệnh từ Cảm biến! Đang chộp ảnh quét biển số...")
    start_time = time.time()
    
    temp_path = f"temp_frame_{int(time.time())}.jpg"
    cv2.imwrite(temp_path, frame)
    
    ai_result = extract_license_plates(temp_path, debug=False)
    proc_ms = int((time.time() - start_time) * 1000)
    
    if ai_result.get("status") == "success" and ai_result.get("plates"):
        plate_text = ai_result["plates"][0]
        print(f"[AI] Phát hiện biển số: {plate_text} ({proc_ms}ms)")
        
        backend_response, img_base64 = send_to_backend(plate_text, proc_ms, temp_path)
        
        if backend_response and backend_response.get("success"):
            data = backend_response.get("data", {})
            action = data.get("action")
            
            # Khai quật dữ liệu Tên và Màu xe từ API
            details = data.get("details") or {}
            citizen_info = details.get("citizen", details.get("owner_info", {}))
            raw_name = data.get("name", details.get("name", citizen_info.get("name", "Khách lạ")))
            clean_name = strip_accents(raw_name)

            vehicle_info = details.get("vehicle", details.get("vehicle_info", {}))
            v_color = data.get("color", details.get("color", vehicle_info.get("color", "")))

            # Phát sóng WebSocket lên Frontend React
            status = 'success' if action == 'OPEN' else 'fail'
            if sio.connected:
                sio.emit('scan_result', {
                    'status': status,
                    'plate': plate_text,
                    'captured_image': img_base64,
                    'owner_name': raw_name,
                    'vehicle_color': str(v_color)
                })

            # Ra lệnh xuống Arduino
            if action == "OPEN":
                print(f"🔓 Cho phép qua: {raw_name} | Xe màu: {v_color}")
                if ser: ser.write(f"ENTRY_GO:{clean_name}\n".encode())
            else:
                print(f"⛔ Từ chối: {data.get('message', 'Không có quyền')}")
                if ser: ser.write(b"DENIED\n")
        else:
            print("❌ Lỗi Backend hoặc Biển số không có trong DB.")
            if ser: ser.write(b"DENIED\n")
    else:
        print("⚠️ Camera không đọc được biển số nào trong khung hình.")
    
    if os.path.exists(temp_path):
        os.remove(temp_path)

def main():
    # 1. Bật kết nối Web
    connect_websocket() 

    # 2. Khởi động Camera
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Không tìm thấy Camera.")
        return

    print("\n[INFO] HỆ THỐNG SẴN SÀNG (CHẾ ĐỘ TRIGGER CẢM BIẾN)")
    print("[INFO] Đang truyền luồng Video lên Web. Chờ xe chạy ngang cảm biến...")

    while True:
        ret, frame = cap.read()
        if not ret: break

        # --- LIÊN TỤC TRUYỀN LIVE STREAM LÊN WEB ---
        if sio.connected:
            stream_frame = cv2.resize(frame, (640, 480))
            _, buffer = cv2.imencode('.jpg', stream_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            sio.emit('video_stream', {'image': f"data:image/jpeg;base64,{frame_base64}"})

        # Hiện khung hình tại máy tính cục bộ
        cv2.putText(frame, "WAITING SENSOR...", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.imshow("Smart Toll Gate - Hardware Bridge", frame)
        
        # --- LẮNG NGHE TÍN HIỆU CẢM BIẾN TỪ ARDUINO ---
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8').strip()
                if line == "CAR_ARRIVED":
                    # Kích hoạt quét ngay lập tức khi nghe tín hiệu!
                    process_and_authorize(frame)
            except:
                pass

        # Phím tắt dự phòng (Bấm C để quét tay, Q để thoát)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('c') or key == ord('C'):
            print("\n[MANUAL] Bấm nút quét tay!")
            process_and_authorize(frame)
        elif key == ord('q') or key == ord('Q'):
            break

    # Dọn dẹp hệ thống khi tắt
    cap.release()
    cv2.destroyAllWindows()
    if ser: ser.close()
    if sio.connected: sio.disconnect()

if __name__ == "__main__":
    main()

