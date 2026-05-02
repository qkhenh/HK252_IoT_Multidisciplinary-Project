import cv2
import time
import base64
import requests
import os
import sys
import serial  
import unicodedata
import socketio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_service.ai_engine import extract_license_plates

NODEJS_BACKEND_URL = "http://localhost:5000/api/v1/gates/check-in"
WEBSOCKET_URL = "http://localhost:5000"
GATE_ID = 1 

ARDUINO_PORT = 'COM3' 
BAUD_RATE = 9600
SCAN_INTERVAL = 1.0       
PLATE_COOLDOWN = 5.0      

try:
    ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
    time.sleep(2) 
    print(f"[OK] Đã kết nối Phần cứng Arduino tại cổng {ARDUINO_PORT}")
except Exception as e:
    ser = None

sio = socketio.Client()

@sio.on('manual_command')
def on_manual_command(data):
    action = data.get('action') 
    lane_id = data.get('lane_id', 'MAIN-IN')
    operator = data.get('operator_name', 'Guard')
    clean_op = strip_accents(operator)
    
    if action == 'OPEN' and ser:
        if "OUT" in lane_id:
            ser.write(f"MANUAL_OPEN_OUT:{clean_op}\n".encode())
            print(f"🚨 [MANUAL] Yêu cầu MỞ CỔNG RA bởi: {clean_op}")
        else:
            ser.write(f"MANUAL_OPEN_IN:{clean_op}\n".encode())
            print(f"🚨 [MANUAL] Yêu cầu MỞ CỔNG VÀO bởi: {clean_op}")
            
    elif action == 'CLOSE' and ser:
        ser.write(b"FORCE_CLOSE\n")
        print(f"🔒 [MANUAL] Kết thúc sự cố - ĐÓNG CỔNG bởi: {clean_op}")

def connect_websocket():
    try:
        sio.connect(WEBSOCKET_URL)
        print("[OK] Đã kết nối luồng Video lên Web Dashboard!")
    except: pass

def strip_accents(text):
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def send_to_backend(plate_text, processing_time_ms, image_path):
    try:
        with open(image_path, "rb") as img_file:
            full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        payload = {
            "lane_id": "MAIN-IN",
            "plate_text": plate_text,
            "image_base64": f"data:image/jpeg;base64,{full_image_base64}"
        }
        response = requests.post(NODEJS_BACKEND_URL, json=payload)
        return response.json(), f"data:image/jpeg;base64,{full_image_base64}"
    except: return None, None

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
        
        if plate_text == current_plate:
            if os.path.exists(temp_path): os.remove(temp_path)
            return found_plate

        print(f"\n[AI] CHỤP ĐƯỢC BIỂN SỐ: {plate_text} ({proc_ms}ms)")
        backend_response, img_base64 = send_to_backend(plate_text, proc_ms, temp_path)
        
        if backend_response and backend_response.get("success"):
            data = backend_response.get("data", {})
            action = data.get("action")
            
            owner_info = data.get("owner_info") or {}
            raw_name = owner_info.get("name", "Khách lạ")
            clean_name = strip_accents(raw_name)
            v_type = owner_info.get("vehicle_type", "")
            access_type = data.get("access_type", "unknown")

            status = 'success' if action == 'OPEN' else 'fail'
            if sio.connected:
                sio.emit('scan_result', {
                    'status': status,
                    'plate': plate_text,
                    'captured_image': img_base64,
                    'owner_name': raw_name,
                    'vehicle_type': v_type,
                    'access_type': access_type,
                })
            if action == "OPEN":
                if ser: ser.write(f"ENTRY_GO:{clean_name}\n".encode())
            elif action == "ALARM" or access_type == "anti_passback":
                if ser: ser.write(f"ALARM_FAKE:{plate_text}\n".encode())
            else:
                if ser: ser.write(f"DENY_PLATE:{plate_text}\n".encode())
        else:
            if ser: ser.write(f"DENY_PLATE:{plate_text}\n".encode())
    
    if os.path.exists(temp_path):
        os.remove(temp_path)
    return found_plate

def main():
    connect_websocket() 
    cap = cv2.VideoCapture(0)
    if not cap.isOpened(): return

    print("\n[INFO] HỆ THỐNG ĐANG CHẠY (AUTO-SCAN + KẾT NỐI ARDUINO)")
    last_scan_time = 0
    last_detected_plate = ""
    cooldown_end_time = 0

    while True:
        ret, frame = cap.read()
        if not ret: break
        
        current_time = time.time()
        if sio.connected:
            stream_frame = cv2.resize(frame, (640, 480))
            _, buffer = cv2.imencode('.jpg', stream_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            sio.emit('video_stream', {'image': f"data:image/jpeg;base64,{frame_base64}"})

        cv2.putText(frame, "LIVE STREAM: ON", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow("Smart Toll Gate - AI Engine", frame)
        
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8').strip()
                if line == "CAR_ARRIVED":
                    plate = process_and_authorize(frame)
                    if plate: 
                        last_detected_plate = plate
                        cooldown_end_time = current_time + PLATE_COOLDOWN
            except: pass
            
        if current_time - last_scan_time >= SCAN_INTERVAL:
            last_scan_time = current_time
            if current_time >= cooldown_end_time:
                plate = process_and_authorize(frame, last_detected_plate)
                if plate and plate != last_detected_plate: 
                    last_detected_plate = plate
                    cooldown_end_time = current_time + PLATE_COOLDOWN 
                elif not plate:
                    last_detected_plate = ""

        if cv2.waitKey(1) & 0xFF in [ord('q'), ord('Q')]:
            break

    cap.release()
    cv2.destroyAllWindows()
    if ser: ser.close()
    if sio.connected: sio.disconnect()

if __name__ == "__main__":
    main()