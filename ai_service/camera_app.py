import cv2
import time
import base64
import requests
import os
import socketio
from ai_engine import extract_license_plates

# ==========================================
# CẤU HÌNH HỆ THỐNG
# ==========================================
NODEJS_API_URL = "http://localhost:5000/api/v1/gates/check-in"
WEBSOCKET_URL = "http://localhost:5000"
GATE_ID = 1 

SCAN_INTERVAL = 1.0       
PLATE_COOLDOWN = 5.0      

# Khởi tạo kết nối WebSocket
sio = socketio.Client()

def connect_websocket():
    try:
        sio.connect(WEBSOCKET_URL)
        print("[INFO] Đã kết nối WebSocket thành công tới Backend!")
    except Exception as e:
        print(f"[WARN] Không thể kết nối WebSocket. Chi tiết: {e}")

def send_to_backend_api(plate_text, processing_time_ms, image_path):
    """Gửi API Check-in như bình thường"""
    try:
        with open(image_path, "rb") as img_file:
            full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            
        payload = {
            "gate_id": GATE_ID,
            "plate_text": plate_text,
            "processing_time_ms": processing_time_ms,
            "full_image_base64": f"data:image/jpeg;base64,{full_image_base64}"
        }
        response = requests.post(NODEJS_API_URL, json=payload)
        return response.json(), f"data:image/jpeg;base64,{full_image_base64}"
    except Exception as e:
        print(f"[ERROR] API gửi thất bại: {e}")
        return None, None

def main():
    connect_websocket()
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Không tìm thấy Camera.")
        return

    print("[INFO] HỆ THỐNG SMART TOLL GATE ĐÃ KHỞI ĐỘNG (LIVE STREAM MODE)")
    print("[INFO] Giơ biển số vào để quét. Bấm 'Q' để thoát.")

    last_scan_time = 0
    last_detected_plate = ""
    cooldown_end_time = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        current_time = time.time()

        # ---------------------------------------------------------
        # 1. LIVE STREAM LÊN REACT UI MƯỢT MÀ (NÉN ẢNH ĐỂ KHÔNG LAG)
        # ---------------------------------------------------------
        if sio.connected:
            # Thu nhỏ ảnh còn 640x480 và nén chất lượng JPEG xuống 50% để truyền cho nhanh
            stream_frame = cv2.resize(frame, (640, 480))
            _, buffer = cv2.imencode('.jpg', stream_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            # Bắn ảnh lên WebSocket
            sio.emit('video_stream', {'image': f"data:image/jpeg;base64,{frame_base64}"})

        # ---------------------------------------------------------
        # 2. LOGIC AI TỰ ĐỘNG QUÉT BIỂN SỐ
        # ---------------------------------------------------------
        cv2.putText(frame, "LIVE STREAM: ON", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        if current_time < cooldown_end_time:
            time_left = round(cooldown_end_time - current_time, 1)
            cv2.putText(frame, f"Wait: {time_left}s", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        cv2.imshow("Smart Toll Gate - AI Engine", frame)

        if current_time - last_scan_time >= SCAN_INTERVAL:
            last_scan_time = current_time
            
            temp_path = "temp_frame_auto.jpg"
            cv2.imwrite(temp_path, frame)
            
            start_ai_time = time.time()
            ai_result = extract_license_plates(temp_path, debug=False)
            processing_time_ms = int((time.time() - start_ai_time) * 1000)
            
            if ai_result.get("status") == "success" and ai_result.get("plates"):
                plate_text = ai_result["plates"][0]
                
                if plate_text == last_detected_plate and current_time < cooldown_end_time:
                    pass 
                else:
                    print(f"\n[INFO] AI chộp được: {plate_text} ({processing_time_ms}ms)")
                    last_detected_plate = plate_text
                    cooldown_end_time = current_time + PLATE_COOLDOWN
                    
                    # Gọi API Backend check quyền
                    api_resp, img_base64 = send_to_backend_api(plate_text, processing_time_ms, temp_path)
                    
                    if api_resp and sio.connected:
                        print(f"[INFO] Backend trả về: {api_resp.get('data', {}).get('action')}")
                        
                        # Phân tích kết quả API và bắn tín hiệu sang React UI
                        status = 'success' if api_resp.get('data', {}).get('action') == 'OPEN' else 'fail'
                        
                        sio.emit('scan_result', {
                            'status': status,
                            'plate': plate_text,
                            'captured_image': img_base64
                        })
            
            if os.path.exists(temp_path):
                os.remove(temp_path)

        if cv2.waitKey(1) & 0xFF in [ord('q'), ord('Q')]:
            break

    cap.release()
    cv2.destroyAllWindows()
    sio.disconnect()

if __name__ == "__main__":
    main()