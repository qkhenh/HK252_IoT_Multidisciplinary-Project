# import cv2
# import time
# import base64
# import requests
# import os
# import sys
# import serial  
# import unicodedata
# import socketio
# import threading 

# sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# from ai_service.ai_engine import extract_license_plates

# NODEJS_BACKEND_URL = "http://localhost:5000/api/v1/gates/check-in"
# WEBSOCKET_URL = "http://localhost:5000"

# ARDUINO_PORT = 'COM3' 
# BAUD_RATE = 9600

# # CẤU HÌNH AUTO-SCAN
# SCAN_INTERVAL = 1.0       # Tốc độ quét định kỳ (1 giây 1 lần)
# PLATE_COOLDOWN = 5.0      # Thời gian "đóng băng" không quét lại biển số cũ (5 giây)

# # ==========================================
# # 1. CLASS CAMERA ĐA LUỒNG
# # ==========================================
# class CameraStream:
#     def __init__(self, src=0, name="Camera"):
#         self.cap = cv2.VideoCapture(src)
#         self.frame = None
#         self.running = True
#         self.name = name
        
#         if not self.cap.isOpened():
#             print(f"[LỖI] Không thể mở {self.name} (Index {src})")
#         else:
#             print(f"[OK] Đã mở {self.name} (Index {src})")
            
#         self.thread = threading.Thread(target=self.update, args=())
#         self.thread.daemon = True
#         self.thread.start()

#     def update(self):
#         while self.running:
#             if self.cap.isOpened():
#                 ret, frame = self.cap.read()
#                 if ret:
#                     self.frame = frame
#             time.sleep(0.01)

#     def read(self):
#         return self.frame

#     def stop(self):
#         self.running = False
#         if self.thread.is_alive():
#             self.thread.join()
#         self.cap.release()

# # ==========================================
# # 2. KHỞI TẠO HỆ THỐNG
# # ==========================================
# try:
#     ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
#     time.sleep(2) 
#     print(f"[OK] Đã kết nối Arduino tại {ARDUINO_PORT}")
# except Exception as e:
#     ser = None
#     print(f"[CẢNH BÁO] Không tìm thấy Arduino tại {ARDUINO_PORT}")

# sio = socketio.Client()

# @sio.on('manual_command')
# def on_manual_command(data):
#     action = data.get('action') 
#     lane_id = data.get('lane_id', 'MAIN-IN')
#     operator = data.get('operator_name', 'Guard')
#     clean_op = strip_accents(operator)
    
#     if action == 'OPEN' and ser:
#         if "OUT" in lane_id:
#             ser.write(f"MANUAL_OPEN_OUT:{clean_op}\n".encode())
#             print(f"🚨 [MANUAL] MỞ CỔNG RA bởi: {clean_op}")
#         else:
#             ser.write(f"MANUAL_OPEN_IN:{clean_op}\n".encode())
#             print(f"🚨 [MANUAL] MỞ CỔNG VÀO bởi: {clean_op}")
            
#     elif action == 'CLOSE' and ser:
#         ser.write(b"FORCE_CLOSE\n")
#         print(f"🔒 [MANUAL] ĐÓNG CỔNG bởi: {clean_op}")

# def connect_websocket():
#     try:
#         sio.connect(WEBSOCKET_URL)
#         print("[OK] Đã kết nối Web Dashboard!")
#     except: pass

# def strip_accents(text):
#     return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

# def send_to_backend(plate_text, processing_time_ms, image_path, lane_id):
#     try:
#         with open(image_path, "rb") as img_file:
#             full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
#         payload = {
#             "lane_id": lane_id,
#             "plate_text": plate_text,
#             "image_base64": f"data:image/jpeg;base64,{full_image_base64}"
#         }
#         response = requests.post(NODEJS_BACKEND_URL, json=payload)
#         return response.json(), f"data:image/jpeg;base64,{full_image_base64}"
#     except: return None, None

# # Đã nâng cấp: Nhận thêm current_plate và trả về found_plate để xử lý Cooldown
# def process_and_authorize(frame, lane_id, current_plate=""):
#     start_time = time.time()
#     temp_path = f"temp_{lane_id}_{int(time.time())}.jpg"
#     cv2.imwrite(temp_path, frame)
    
#     ai_result = extract_license_plates(temp_path, debug=False)
#     proc_ms = int((time.time() - start_time) * 1000)
#     found_plate = ""
    
#     if ai_result.get("status") == "success" and ai_result.get("plates"):
#         plate_text = ai_result["plates"][0]
#         found_plate = plate_text
        
#         # Ngăn chặn AI gửi kết quả trùng lặp lên Database trong thời gian Cooldown
#         if plate_text == current_plate:
#             if os.path.exists(temp_path): os.remove(temp_path)
#             return found_plate

#         print(f"\n[AI] {lane_id} - BIỂN SỐ: {plate_text} ({proc_ms}ms)")
        
#         backend_response, img_base64 = send_to_backend(plate_text, proc_ms, temp_path, lane_id)
        
#         if backend_response and backend_response.get("success"):
#             data = backend_response.get("data", {})
#             action = data.get("action")
            
#             owner_info = data.get("owner_info") or {}
#             raw_name = owner_info.get("name", "Khách lạ")
#             clean_name = strip_accents(raw_name)
#             v_type = owner_info.get("vehicle_type", "")
#             access_type = data.get("access_type", "unknown")

#             status = 'success' if action == 'OPEN' else 'fail'
            
#             if sio.connected:
#                 sio.emit('scan_result', {
#                     'lane_id': lane_id,
#                     'status': status,
#                     'plate': plate_text,
#                     'captured_image': img_base64,
#                     'owner_name': raw_name,
#                     'vehicle_type': v_type,
#                     'access_type': access_type,
#                 })
                
#             if action == "OPEN":
#                 if lane_id == "MAIN-IN" and ser:
#                     ser.write(f"ENTRY_GO:{clean_name}\n".encode())
#                 elif lane_id == "MAIN-OUT" and ser:
#                     ser.write(f"EXIT_GO:{clean_name}\n".encode())
#             elif action == "ALARM" or access_type == "anti_passback":
#                 if ser: ser.write(f"ALARM_FAKE:{plate_text}\n".encode())
#             else:
#                 if ser: ser.write(f"DENY_PLATE:{plate_text}\n".encode())
#         else:
#             if ser: ser.write(f"DENY_PLATE:{plate_text}\n".encode())
    
#     if os.path.exists(temp_path):
#         os.remove(temp_path)
        
#     return found_plate

# # ==========================================
# # 3. LUỒNG PHÁT VIDEO LÊN WEB 
# # ==========================================
# def stream_video_to_web(cam_in, cam_out):
#     while True:
#         if sio.connected:
#             frame_in = cam_in.read()
#             if frame_in is not None:
#                 stream_in = cv2.resize(frame_in, (640, 480))
#                 _, buffer = cv2.imencode('.jpg', stream_in, [int(cv2.IMWRITE_JPEG_QUALITY), 40])
#                 sio.emit('video_stream', {
#                     'lane_id': 'MAIN-IN', 
#                     'image': f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
#                 })
            
#             frame_out = cam_out.read()
#             if frame_out is not None:
#                 stream_out = cv2.resize(frame_out, (640, 480))
#                 _, buffer = cv2.imencode('.jpg', stream_out, [int(cv2.IMWRITE_JPEG_QUALITY), 40])
#                 sio.emit('video_stream', {
#                     'lane_id': 'MAIN-OUT', 
#                     'image': f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
#                 })
                
#         time.sleep(0.05)

# # ==========================================
# # 4. CHƯƠNG TRÌNH CHÍNH (Kết hợp Auto-scan & Hardware Trigger)
# # ==========================================
# def main():
#     connect_websocket() 
    
#     cam_in = CameraStream(src=0, name="Camera Làn Vào (IN)")
#     cam_out = CameraStream(src=1, name="Camera Làn Ra (OUT)")
    
#     threading.Thread(target=stream_video_to_web, args=(cam_in, cam_out), daemon=True).start()

#     print("\n[INFO] HỆ THỐNG ĐÃ SẴN SÀNG - CHẠY AUTO-SCAN KẾT HỢP ARDUINO TRIGGER...")

#     # Các biến lưu trữ trạng thái Auto-Scan cho Làn VÀO
#     last_scan_time_in = 0
#     last_detected_plate_in = ""
#     cooldown_end_time_in = 0

#     # Các biến lưu trữ trạng thái Auto-Scan cho Làn RA
#     last_scan_time_out = 0
#     last_detected_plate_out = ""
#     cooldown_end_time_out = 0

#     try:
#         while True:
#             current_time = time.time()
#             frame_in = cam_in.read()
#             frame_out = cam_out.read()
            
#             # --- HIỂN THỊ CỬA SỔ DEBUG ---
#             if frame_in is not None:
#                 cv2.putText(frame_in, "AUTO SCAN: ON", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
#                 cv2.imshow("Lane IN", cv2.resize(frame_in, (400, 300)))
#             if frame_out is not None:
#                 cv2.putText(frame_out, "AUTO SCAN: ON", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
#                 cv2.imshow("Lane OUT", cv2.resize(frame_out, (400, 300)))
            
#             if cv2.waitKey(1) & 0xFF in [ord('q'), ord('Q')]:
#                 break
                
#             # --- 1. ĐỌC LỆNH TỪ ARDUINO (HARDWARE TRIGGER) ---
#             if ser and ser.in_waiting > 0:
#                 try:
#                     line = ser.readline().decode('utf-8').strip()
                    
#                     if line == "CAR_ARRIVED":
#                         print(">> ARDUINO BÁO: Có xe VÀO, tiến hành quét biển...")
#                         if frame_in is not None:
#                             plate = process_and_authorize(frame_in, lane_id="MAIN-IN", current_plate=last_detected_plate_in)
#                             if plate:
#                                 last_detected_plate_in = plate
#                                 cooldown_end_time_in = current_time + PLATE_COOLDOWN
                                
#                     elif line == "CAR_EXITING":
#                         print(">> ARDUINO BÁO: Có xe RA, tiến hành quét biển...")
#                         if frame_out is not None:
#                             plate = process_and_authorize(frame_out, lane_id="MAIN-OUT", current_plate=last_detected_plate_out)
#                             if plate:
#                                 last_detected_plate_out = plate
#                                 cooldown_end_time_out = current_time + PLATE_COOLDOWN
#                 except Exception as e:
#                     pass

#             # --- 2. LOGIC TỰ ĐỘNG QUÉT ĐỊNH KỲ (AUTO-SCAN) ---
            
#             # Quét tự động Làn VÀO
#             if current_time - last_scan_time_in >= SCAN_INTERVAL:
#                 last_scan_time_in = current_time
#                 if current_time >= cooldown_end_time_in:
#                     if frame_in is not None:
#                         plate = process_and_authorize(frame_in, lane_id="MAIN-IN", current_plate=last_detected_plate_in)
#                         if plate and plate != last_detected_plate_in:
#                             last_detected_plate_in = plate
#                             cooldown_end_time_in = current_time + PLATE_COOLDOWN
#                         elif not plate:
#                             last_detected_plate_in = ""

#             # Quét tự động Làn RA
#             if current_time - last_scan_time_out >= SCAN_INTERVAL:
#                 last_scan_time_out = current_time
#                 if current_time >= cooldown_end_time_out:
#                     if frame_out is not None:
#                         plate = process_and_authorize(frame_out, lane_id="MAIN-OUT", current_plate=last_detected_plate_out)
#                         if plate and plate != last_detected_plate_out:
#                             last_detected_plate_out = plate
#                             cooldown_end_time_out = current_time + PLATE_COOLDOWN
#                         elif not plate:
#                             last_detected_plate_out = ""

#     finally:
#         print("[INFO] Đang dọn dẹp hệ thống...")
#         cam_in.stop()
#         cam_out.stop()
#         cv2.destroyAllWindows()
#         if ser: ser.close()
#         if sio.connected: sio.disconnect()

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
import threading 
import re # IMPORT THÊM THƯ VIỆN REGEX ĐỂ XỬ LÝ CHUỖI OTP

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_service.ai_engine import extract_license_plates

# KHAI BÁO THÊM API ENDPOINT CHO OTP
NODEJS_BACKEND_URL = "http://localhost:5000/api/v1/gates/check-in"
OTP_BACKEND_URL = "http://localhost:5000/api/v1/gates/verify-camera-otp"
WEBSOCKET_URL = "http://localhost:5000"

ARDUINO_PORT = 'COM3' 
BAUD_RATE = 9600

# CẤU HÌNH AUTO-SCAN
SCAN_INTERVAL = 1.0       
PLATE_COOLDOWN = 5.0      

# ==========================================
# 1. CLASS CAMERA ĐA LUỒNG
# ==========================================
class CameraStream:
    def __init__(self, src=0, name="Camera"):
        self.cap = cv2.VideoCapture(src)
        self.frame = None
        self.running = True
        self.name = name
        
        if not self.cap.isOpened():
            print(f"[LỖI] Không thể mở {self.name} (Index {src})")
        else:
            print(f"[OK] Đã mở {self.name} (Index {src})")
            
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        self.thread.start()

    def update(self):
        while self.running:
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    self.frame = frame
            time.sleep(0.01)

    def read(self):
        return self.frame

    def stop(self):
        self.running = False
        if self.thread.is_alive():
            self.thread.join()
        self.cap.release()

# ==========================================
# 2. KHỞI TẠO HỆ THỐNG & API CALLS
# ==========================================
try:
    ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
    time.sleep(2) 
    print(f"[OK] Đã kết nối Arduino tại {ARDUINO_PORT}")
except Exception as e:
    ser = None
    print(f"[CẢNH BÁO] Không tìm thấy Arduino tại {ARDUINO_PORT}")

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
            print(f"🚨 [MANUAL] MỞ CỔNG RA bởi: {clean_op}")
        else:
            ser.write(f"MANUAL_OPEN_IN:{clean_op}\n".encode())
            print(f"🚨 [MANUAL] MỞ CỔNG VÀO bởi: {clean_op}")
            
    elif action == 'CLOSE' and ser:
        ser.write(b"FORCE_CLOSE\n")
        print(f"🔒 [MANUAL] ĐÓNG CỔNG bởi: {clean_op}")

def connect_websocket():
    try:
        sio.connect(WEBSOCKET_URL)
        print("[OK] Đã kết nối Web Dashboard!")
    except: pass

def strip_accents(text):
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def send_to_backend(plate_text, processing_time_ms, image_path, lane_id):
    try:
        with open(image_path, "rb") as img_file:
            full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        payload = {
            "lane_id": lane_id,
            "plate_text": plate_text,
            "image_base64": f"data:image/jpeg;base64,{full_image_base64}"
        }
        response = requests.post(NODEJS_BACKEND_URL, json=payload)
        return response.json(), f"data:image/jpeg;base64,{full_image_base64}"
    except: return None, None

# HÀM MỚI: GỬI MÃ OTP LÊN BACKEND THAY VÌ BIỂN SỐ
def send_otp_to_backend(otp_code, processing_time_ms, image_path, lane_id):
    try:
        with open(image_path, "rb") as img_file:
            full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
        payload = {
            "lane_id": lane_id,
            "token_data": otp_code,
            "code_type": "otp_6digit",
            "image_base64": f"data:image/jpeg;base64,{full_image_base64}"
        }
        response = requests.post(OTP_BACKEND_URL, json=payload)
        return response.json(), f"data:image/jpeg;base64,{full_image_base64}"
    except: return None, None

def process_and_authorize(frame, lane_id, current_plate=""):
    start_time = time.time()
    temp_path = f"temp_{lane_id}_{int(time.time())}.jpg"
    cv2.imwrite(temp_path, frame)
    proc_ms = 0
    found_plate = ""

    # ==========================================
    # 1. KIỂM TRA MÃ QR (DÀNH CHO CƯ DÂN)
    # ==========================================
    qr_detector = cv2.QRCodeDetector()
    qr_data, bbox, _ = qr_detector.detectAndDecode(frame)

    if qr_data and len(qr_data) > 10: 
        proc_ms = int((time.time() - start_time) * 1000)
        found_plate = qr_data
        
        if found_plate == current_plate:
            if os.path.exists(temp_path): os.remove(temp_path)
            return found_plate

        print(f"\n[AI] {lane_id} - PHÁT HIỆN MÃ QR: {qr_data} ({proc_ms}ms)")
        
        try:
            with open(temp_path, "rb") as img_file:
                full_image_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            payload = {
                "lane_id": lane_id,
                "token_data": qr_data,
                "code_type": "qr_uuid",
                "image_base64": f"data:image/jpeg;base64,{full_image_base64}"
            }
            response = requests.post(OTP_BACKEND_URL, json=payload)
            backend_response = response.json()
            img_base64 = f"data:image/jpeg;base64,{full_image_base64}"
        except Exception as e:
            backend_response = None

        if backend_response:
            data = backend_response.get("data", backend_response) 
            action = data.get("action", "KEEP_CLOSED")
            issued_by = data.get("issued_by", "Cư dân nội khu") # Đây là tên Cư dân
            clean_name = strip_accents(issued_by)
            message = data.get("message", "").lower()

            if action != "OPEN" and ("trong" in message or "đã vào" in message or "anti" in message or "passback" in message):
                status = 'fail'
                access_type = "anti_passback"
                action = "ALARM"
                issued_by = f"ANTI-PASSBACK: {issued_by}"
            elif action != "OPEN":
                status = 'fail'
                access_type = "anti_passback"
                action = "ALARM"
                issued_by = "MÃ QR ĐÃ HẾT HẠN HOẶC KHÔNG HỢP LỆ"
            else:
                status = 'success'
                access_type = "resident"

            if sio.connected:
                sio.emit('scan_result', {
                    'lane_id': lane_id,
                    'status': status,
                    'plate': "QR CÁ NHÂN",
                    'captured_image': img_base64,
                    'owner_name': issued_by,        # Tên cư dân
                    'vehicle_type': "QR Code",      # LUỒNG 3: Type = QR Code
                    'access_type': access_type,
                })
                
            if action == "OPEN":
                if lane_id == "MAIN-IN" and ser: ser.write(f"ENTRY_GO:{clean_name}\n".encode())
                elif lane_id == "MAIN-OUT" and ser: ser.write(f"EXIT_GO:{clean_name}\n".encode())
            elif action == "ALARM":
                if ser: ser.write(f"ALARM_FAKE:QR_USED\n".encode()) 
            else:
                if ser: ser.write(f"DENY_PLATE:QR_FAIL\n".encode())
        
        if os.path.exists(temp_path): os.remove(temp_path)
        return found_plate

    # ==========================================
    # 2. KHÔNG CÓ QR -> AI NHẬN DIỆN BIỂN SỐ VÀ OTP
    # ==========================================
    ai_result = extract_license_plates(temp_path, debug=False)
    proc_ms = int((time.time() - start_time) * 1000)
    found_plate = ""
    
    if ai_result.get("status") == "success" and ai_result.get("plates"):
        raw_text = ai_result["plates"][0]
        clean_alphanum = re.sub(r'[^a-zA-Z0-9]', '', raw_text).upper()
        
        # BÓC TÁCH OTP 6 SỐ
        is_otp = False
        if len(clean_alphanum) == 6:
            ocr_corrections = {
                'T': '7', 'O': '0', 'Q': '0', 'D': '0',
                'I': '1', 'L': '1', 'Z': '2', 'B': '8',
                'S': '5', 'A': '4', 'G': '6'
            }
            corrected_str = "".join([ocr_corrections.get(c, c) for c in clean_alphanum])
            if corrected_str.isdigit():
                is_otp = True
                clean_alphanum = corrected_str 
        
        found_plate = clean_alphanum if is_otp else raw_text

        if found_plate == current_plate:
            if os.path.exists(temp_path): os.remove(temp_path)
            return found_plate

        # ==========================================
        # LUỒNG OTP (EMERGENCY GUEST)
        # ==========================================
        if is_otp:
            print(f"\n[AI] {lane_id} - PHÁT HIỆN MÃ OTP: {clean_alphanum} ({proc_ms}ms)")
            backend_response, img_base64 = send_otp_to_backend(clean_alphanum, proc_ms, temp_path, lane_id)
            
            if backend_response:
                data = backend_response.get("data", backend_response) 
                action = data.get("action", "KEEP_CLOSED")
                issued_by = data.get("issued_by", "Cư dân") 
                clean_name = strip_accents(issued_by)

                # Format theo luồng 2: Owner = "Emergency Guest của [Cư Dân]"
                owner_display = f"Emergency Guest của {issued_by}"

                if action != "OPEN":
                    status = 'fail'
                    access_type = "anti_passback"
                    action = "ALARM"
                    owner_display = data.get("message", "MÃ KHÔNG HỢP LỆ")
                else:
                    status = 'success'
                    access_type = "otp"
                
                if sio.connected:
                    sio.emit('scan_result', {
                        'lane_id': lane_id,
                        'status': status,
                        'plate': f"OTP: {clean_alphanum}",
                        'captured_image': img_base64,
                        'owner_name': owner_display,       # Emergency Guest của...
                        'vehicle_type': "Emergency Guest", # LUỒNG 2: Type = Emergency Guest
                        'access_type': access_type,
                    })
                    
                if action == "OPEN":
                    if lane_id == "MAIN-IN" and ser: ser.write(f"ENTRY_GO:{clean_name}\n".encode())
                    elif lane_id == "MAIN-OUT" and ser: ser.write(f"EXIT_GO:{clean_name}\n".encode())
                elif action == "ALARM":
                    if ser: ser.write(f"ALARM_FAKE:OTP_USED\n".encode())
                else:
                    if ser: ser.write(f"DENY_PLATE:OTP_FAIL\n".encode())
            
        # ==========================================
        # LUỒNG BIỂN SỐ XE (CITIZEN HOẶC SCHEDULED GUEST)
        # ==========================================
        else:
            print(f"\n[AI] {lane_id} - BIỂN SỐ XE: {raw_text} ({proc_ms}ms)")
            backend_response, img_base64 = send_to_backend(raw_text, proc_ms, temp_path, lane_id)
            
            if backend_response and backend_response.get("success"):
                data = backend_response.get("data", {})
                action = data.get("action", "KEEP_CLOSED")
                message = data.get("message", "").lower()
                
                owner_info = data.get("owner_info") or {}
                access_type = data.get("access_type", "unknown").lower()
                v_type = data.get("vehicle_type") or owner_info.get("vehicle_type", "N/A")

                # --- PHÂN LOẠI CHÍNH XÁC DỰA VÀO ACCESS_TYPE ---
                if access_type == "resident":
                    # LUỒNG 1.1 (Citizen): Hiện tên Citizen, loại xe giữ nguyên
                    raw_name = owner_info.get("name", "Cư dân")
                
                elif access_type == "guest":
                    # LUỒNG 1.2 (Scheduled Guest): Hiện tên Khách của Cư dân, loại xe là Scheduled Guest
                    guest_name = data.get("guest_name") or owner_info.get("name") or owner_info.get("guest_name") or "Khách lạ"
                    raw_name = f"Khách của Cư dân ({guest_name})"
                    v_type = "Scheduled Guest"
                else:
                    raw_name = "Khách chưa đăng ký"
                    v_type = "N/A"

                clean_name = strip_accents(raw_name)

                # --- BẮT LỖI ANTI-PASSBACK ---
                is_anti_passback = False
                if action != "OPEN":
                    passback_keywords = ["đang ở trong", "đã vào", "đã check", "check-in", "check in", "anti", "passback", "đã quét"]
                    if any(kw in message for kw in passback_keywords):
                        is_anti_passback = True
                    elif "trong" in message and "không" not in message:
                        is_anti_passback = True

                if is_anti_passback:
                    access_type = "anti_passback"
                    action = "ALARM"
                    if raw_name not in ["Khách chưa đăng ký", "Khách lạ"]:
                        raw_name = f"ANTI-PASSBACK: {raw_name}"
                    else:
                        raw_name = "CẢNH BÁO ANTI-PASSBACK"

                status = 'success' if action == 'OPEN' else 'fail'
                
                if sio.connected:
                    sio.emit('scan_result', {
                        'lane_id': lane_id,
                        'status': status,
                        'plate': raw_text,
                        'captured_image': img_base64,
                        'owner_name': raw_name,
                        'vehicle_type': v_type,
                        'access_type': access_type,
                    })
                    
                if action == "OPEN":
                    if lane_id == "MAIN-IN" and ser: ser.write(f"ENTRY_GO:{clean_name}\n".encode())
                    elif lane_id == "MAIN-OUT" and ser: ser.write(f"EXIT_GO:{clean_name}\n".encode())
                elif action == "ALARM" or access_type == "anti_passback":
                    if ser: ser.write(f"ALARM_FAKE:PASSBACK_DETECTED\n".encode())
                else:
                    if ser: ser.write(f"DENY_PLATE:{raw_text}\n".encode())
            else:
                if ser: ser.write(f"DENY_PLATE:{raw_text}\n".encode())
    
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    return found_plate

# ==========================================
# 3. LUỒNG PHÁT VIDEO LÊN WEB 
# ==========================================
def stream_video_to_web(cam_in, cam_out):
    while True:
        if sio.connected:
            frame_in = cam_in.read()
            if frame_in is not None:
                stream_in = cv2.resize(frame_in, (640, 480))
                _, buffer = cv2.imencode('.jpg', stream_in, [int(cv2.IMWRITE_JPEG_QUALITY), 40])
                sio.emit('video_stream', {
                    'lane_id': 'MAIN-IN', 
                    'image': f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                })
            
            frame_out = cam_out.read()
            if frame_out is not None:
                stream_out = cv2.resize(frame_out, (640, 480))
                _, buffer = cv2.imencode('.jpg', stream_out, [int(cv2.IMWRITE_JPEG_QUALITY), 40])
                sio.emit('video_stream', {
                    'lane_id': 'MAIN-OUT', 
                    'image': f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                })
                
        time.sleep(0.05)

# ==========================================
# 4. CHƯƠNG TRÌNH CHÍNH
# ==========================================
def main():
    connect_websocket() 
    
    cam_in = CameraStream(src=0, name="Camera Làn Vào (IN)")
    cam_out = CameraStream(src=1, name="Camera Làn Ra (OUT)")
    
    threading.Thread(target=stream_video_to_web, args=(cam_in, cam_out), daemon=True).start()

    print("\n[INFO] HỆ THỐNG ĐÃ SẴN SÀNG - CHẠY AUTO-SCAN KẾT HỢP ARDUINO TRIGGER...")

    last_scan_time_in = 0
    last_detected_plate_in = ""
    cooldown_end_time_in = 0

    last_scan_time_out = 0
    last_detected_plate_out = ""
    cooldown_end_time_out = 0

    try:
        while True:
            current_time = time.time()
            frame_in = cam_in.read()
            frame_out = cam_out.read()
            
            if frame_in is not None:
                cv2.putText(frame_in, "AUTO SCAN: ON", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.imshow("Lane IN", cv2.resize(frame_in, (400, 300)))
            if frame_out is not None:
                cv2.putText(frame_out, "AUTO SCAN: ON", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.imshow("Lane OUT", cv2.resize(frame_out, (400, 300)))
            
            if cv2.waitKey(1) & 0xFF in [ord('q'), ord('Q')]:
                break
                
            if ser and ser.in_waiting > 0:
                try:
                    line = ser.readline().decode('utf-8').strip()
                    
                    if line == "CAR_ARRIVED":
                        print(">> ARDUINO BÁO: Có xe VÀO, tiến hành quét biển/OTP...")
                        if frame_in is not None:
                            plate = process_and_authorize(frame_in, lane_id="MAIN-IN", current_plate=last_detected_plate_in)
                            if plate:
                                last_detected_plate_in = plate
                                cooldown_end_time_in = current_time + PLATE_COOLDOWN
                                
                    elif line == "CAR_EXITING":
                        print(">> ARDUINO BÁO: Có xe RA, tiến hành quét biển/OTP...")
                        if frame_out is not None:
                            plate = process_and_authorize(frame_out, lane_id="MAIN-OUT", current_plate=last_detected_plate_out)
                            if plate:
                                last_detected_plate_out = plate
                                cooldown_end_time_out = current_time + PLATE_COOLDOWN
                except Exception as e:
                    pass

            if current_time - last_scan_time_in >= SCAN_INTERVAL:
                last_scan_time_in = current_time
                if current_time >= cooldown_end_time_in:
                    if frame_in is not None:
                        plate = process_and_authorize(frame_in, lane_id="MAIN-IN", current_plate=last_detected_plate_in)
                        if plate and plate != last_detected_plate_in:
                            last_detected_plate_in = plate
                            cooldown_end_time_in = current_time + PLATE_COOLDOWN
                        elif not plate:
                            last_detected_plate_in = ""

            if current_time - last_scan_time_out >= SCAN_INTERVAL:
                last_scan_time_out = current_time
                if current_time >= cooldown_end_time_out:
                    if frame_out is not None:
                        plate = process_and_authorize(frame_out, lane_id="MAIN-OUT", current_plate=last_detected_plate_out)
                        if plate and plate != last_detected_plate_out:
                            last_detected_plate_out = plate
                            cooldown_end_time_out = current_time + PLATE_COOLDOWN
                        elif not plate:
                            last_detected_plate_out = ""

    finally:
        print("[INFO] Đang dọn dẹp hệ thống...")
        cam_in.stop()
        cam_out.stop()
        cv2.destroyAllWindows()
        if ser: ser.close()
        if sio.connected: sio.disconnect()

if __name__ == "__main__":
    main()