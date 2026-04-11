import cv2
import time
import base64
import requests
import os
import sys
import serial  
import unicodedata
import socketio

# Nhúng thư viện AI
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_service.ai_engine import extract_license_plates

# ==========================================
# CẤU HÌNH HỆ THỐNG
# ==========================================
NODEJS_BACKEND_URL = "http://localhost:5000/api/v1/gates/check-in"
WEBSOCKET_URL = "http://localhost:5000"
GATE_ID = 1 

# Nhớ đổi cổng COM cho đúng mạch Arduino nhé!
ARDUINO_PORT = 'COM3' 
BAUD_RATE = 9600
SCAN_INTERVAL = 1.0       # Tự động quét mỗi 1 giây (như camera_app)
PLATE_COOLDOWN = 5.0      # Quét trúng thì nghỉ 5 giây

# --- KHỞI TẠO ARDUINO ---
try:
    ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
    time.sleep(2) 
    print(f"[OK] Đã kết nối Phần cứng Arduino tại cổng {ARDUINO_PORT}")
except Exception as e:
    print(f"[CẢNH BÁO] Không tìm thấy Arduino: {e}. Hệ thống vẫn chạy Camera bình thường.")
    ser = None

# --- KHỞI TẠO WEBSOCKET ---
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

def process_and_authorize(frame, current_plate=""):
    start_time = time.time()
    
    temp_path = f"temp_frame_{int(time.time())}.jpg"
    cv2.imwrite(temp_path, frame)
    
    ai_result = extract_license_plates(temp_path, debug=False)
    proc_ms = int((time.time() - start_time) * 1000)
    
    found_plate = ""
    
    if ai_result.get("status") == "success" and ai_result.get("plates"):
        plate_text = ai_result["plates"][0]
        found_plate = plate_text
        
        # Tránh việc quét lại biển số cũ liên tục gây spam
        if plate_text == current_plate:
            if os.path.exists(temp_path): os.remove(temp_path)
            return found_plate

        print(f"\n[AI] CHỤP ĐƯỢC BIỂN SỐ: {plate_text} ({proc_ms}ms)")
        
        backend_response, img_base64 = send_to_backend(plate_text, proc_ms, temp_path)
        
        if backend_response and backend_response.get("success"):
            data = backend_response.get("data", {})
            action = data.get("action")
            
            # --- THÊM 2 DÒNG NÀY ĐỂ SOI DATA THỰC TẾ ---
            print("\n🔍 RAW DATA TỪ BACKEND TRẢ VỀ:")
            print(data)
            # ------------------------------------------
            
            details = data.get("details") or {}
            
            # Dùng 'or {}' liên tục để né lỗi NoneType
            citizen_info = details.get("citizen") or details.get("owner_info") or {}
            raw_name = data.get("name") or details.get("name") or citizen_info.get("name") or "Khách lạ"
            clean_name = strip_accents(raw_name)

            vehicle_info = details.get("vehicle") or details.get("vehicle_info") or {}
            v_color = data.get("color") or details.get("color") or vehicle_info.get("color") or ""

            # Nháy dữ liệu lên Frontend
            status = 'success' if action == 'OPEN' else 'fail'
            if sio.connected:
                sio.emit('scan_result', {
                    'status': status,
                    'plate': plate_text,
                    'captured_image': img_base64,
                    'owner_name': raw_name,
                    'vehicle_color': str(v_color)
                })

            # Bắn lệnh xuống Mạch Arduino
            if action == "OPEN":
                print(f"🔓 BÁO WEBSOCKET MỞ CỔNG | Chủ: {raw_name} | Màu: {v_color}")
                if ser: ser.write(f"ENTRY_GO:{clean_name}\n".encode())
            else:
                print(f"⛔ BÁO TỪ CHỐI | Lỗi: {data.get('message', 'Không có quyền')}")
                if ser: ser.write(f"DENY_PLATE:{plate_text}\n".encode())
        else:
            print("❌ Lỗi Backend hoặc Khách lạ.")
            if ser: ser.write(f"DENY_PLATE:{plate_text}\n".encode())
    
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    return found_plate

def main():
    connect_websocket() 

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Không tìm thấy Camera.")
        return

    print("\n[INFO] HỆ THỐNG ĐANG CHẠY (AUTO-SCAN + KẾT NỐI ARDUINO)")

    last_scan_time = 0
    last_detected_plate = ""
    cooldown_end_time = 0

    while True:
        ret, frame = cap.read()
        if not ret: break
        
        current_time = time.time()

        # 1. Truyền Live Stream liên tục lên Frontend
        if sio.connected:
            stream_frame = cv2.resize(frame, (640, 480))
            _, buffer = cv2.imencode('.jpg', stream_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            sio.emit('video_stream', {'image': f"data:image/jpeg;base64,{frame_base64}"})

        # Hiện thông số trên màn hình Camera OpenCV
        cv2.putText(frame, "LIVE STREAM: ON", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        if current_time < cooldown_end_time:
            time_left = round(cooldown_end_time - current_time, 1)
            cv2.putText(frame, f"Wait: {time_left}s", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        cv2.imshow("Smart Toll Gate - AI Engine", frame)
        
        # 2. Nghe tín hiệu từ phần cứng Arduino (Mức ưu tiên tuyệt đối)
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8').strip()
                if line == "CAR_ARRIVED":
                    print("\n[SENSOR] Arduino phát hiện có xe trờ tới!")
                    plate = process_and_authorize(frame)
                    if plate: 
                        last_detected_plate = plate
                        cooldown_end_time = current_time + PLATE_COOLDOWN
            except:
                pass
            
        # 3. Tự động Auto-Scan y như file camera_app.py
        if current_time - last_scan_time >= SCAN_INTERVAL:
            last_scan_time = current_time
            if current_time >= cooldown_end_time:
                plate = process_and_authorize(frame, last_detected_plate)
                if plate and plate != last_detected_plate: 
                    last_detected_plate = plate
                    cooldown_end_time = current_time + PLATE_COOLDOWN 
                elif not plate:
                    # Reset biển số lưu trữ nếu không thấy xe
                    last_detected_plate = ""

        # Lắng nghe bàn phím
        if cv2.waitKey(1) & 0xFF in [ord('q'), ord('Q')]:
            break

    cap.release()
    cv2.destroyAllWindows()
    if ser: ser.close()
    if sio.connected: sio.disconnect()

if __name__ == "__main__":
    main()