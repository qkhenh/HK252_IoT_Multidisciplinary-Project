import cv2
import time
import base64
import requests
import os
from ai_engine import extract_license_plates

# ==========================================
# CONFIGURATION
# ==========================================
# Node.js backend URL
NODEJS_BACKEND_URL = "http://localhost:3000/api/v1/gates/check-in"
# Gate identifier
GATE_ID = 1 

def send_to_backend(plate_text, processing_time_ms, image_path):
    """
    Encodes the image to Base64 and sends the payload to Node.js backend.
    """
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
    except requests.exceptions.ConnectionError:
        print("[ERROR] Connection to Node.js backend failed.")
        return None
    except Exception as e:
        print(f"[ERROR] Failed to send data: {e}")
        return None

def main():
    # Initialize webcam (0 is usually the built-in laptop camera)
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("[ERROR] Cannot access the camera.")
        return

    print("[INFO] System Ready.")
    print("[INFO] Press 'C' to capture and process a frame.")
    print("[INFO] Press 'Q' to quit the application.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to grab frame.")
            break

        # Display the live camera feed
        cv2.imshow("Smart Toll Gate - Live Feed", frame)

        # Wait for key press (1ms delay)
        key = cv2.waitKey(1) & 0xFF

        # If 'C' is pressed, trigger the AI capture process
        if key == ord('c') or key == ord('C'):
            print("\n[INFO] Capture triggered. Processing...")
            start_time = time.time()
            
            # Save the current frame temporarily
            temp_path = f"temp_frame_{int(time.time())}.jpg"
            cv2.imwrite(temp_path, frame)
            
            # Run AI extraction
            ai_result = extract_license_plates(temp_path, debug=False)
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Process result
            if ai_result.get("status") == "success" and ai_result.get("plates"):
                plate_text = ai_result["plates"][0]
                print(f"[INFO] Detected Plate: {plate_text} ({processing_time_ms}ms)")
                
                # Send to Backend
                backend_response = send_to_backend(plate_text, processing_time_ms, temp_path)
                if backend_response:
                    print(f"[INFO] Backend Response: {backend_response}")
            else:
                print("[WARN] No license plate detected in this frame.")
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
        # If 'Q' is pressed, exit the loop
        elif key == ord('q') or key == ord('Q'):
            print("[INFO] Shutting down...")
            break

    # Release hardware resources
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()