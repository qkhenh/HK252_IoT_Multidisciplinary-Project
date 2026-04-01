import cv2
import time
import base64
import requests
import os
import serial  
import unicodedata 
from ai_engine import extract_license_plates

# ==========================================
# CONFIGURATION
# ==========================================
NODEJS_BACKEND_URL = "http://localhost:3000/api/v1/gates/check-in"
GATE_ID = 1 
ARDUINO_PORT = 'COM3' # Change this if your COM port is different
BAUD_RATE = 9600

# --- NEW: INITIALIZE SERIAL ---
try:
    ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
    time.sleep(2) 
    print(f"✅ Arduino Connected on {ARDUINO_PORT}")
except Exception as e:
    print(f"⚠️ Arduino connection failed: {e}")
    ser = None

def strip_accents(text):
    """Converts 'Lê Thị Cư Dân' to 'Le Thi Cu Dan' for the LCD."""
    return "".join(c for c in unicodedata.normalize('NFD', text)
                   if unicodedata.category(c) != 'Mn')

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
        return response.json()
    except Exception as e:
        print(f"[ERROR] Backend failed: {e}")
        return None

def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened(): return

    print("[INFO] System Ready. Press 'C' to capture.")

    while True:
        ret, frame = cap.read()
        if not ret: break
        cv2.imshow("Smart Toll Gate - Live Feed", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('c') or key == ord('C'):
            print("\n[INFO] Capture triggered...")
            start_time = time.time()
            temp_path = f"temp_frame_{int(time.time())}.jpg"
            cv2.imwrite(temp_path, frame)
            
            ai_result = extract_license_plates(temp_path, debug=False)
            proc_ms = int((time.time() - start_time) * 1000)
            
            if ai_result.get("status") == "success" and ai_result.get("plates"):
                plate_text = ai_result["plates"][0]
                backend_response = send_to_backend(plate_text, proc_ms, temp_path)
                
                # --- NEW: TRIGGER ARDUINO BASED ON BACKEND ---
                if backend_response and backend_response.get("success"):
                    data = backend_response.get("data", {})
                    # Path from your test image: data -> details -> owner_info -> name
                    raw_name = data.get("details", {}).get("owner_info", {}).get("name", "User")
                    clean_name = strip_accents(raw_name)

                    if data.get("action") == "OPEN" and ser:
                        print(f"🔓 Authorized: {raw_name}")
                        # Send command in format "ENTRY_GO:Name"
                        ser.write(f"ENTRY_GO:{clean_name}\n".encode()) 
                else:
                    print("[WARN] Access Denied or Backend Error.")
            
            if os.path.exists(temp_path): os.remove(temp_path)
        elif key == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()
    if ser: ser.close()

if __name__ == "__main__":
    main()