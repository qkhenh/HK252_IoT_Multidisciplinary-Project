import os
import logging
import warnings
import cv2
import glob
import numpy as np
import re
from typing import Dict, Any
from ultralytics import YOLO
import easyocr

# ==========================================
# CONFIGURATION & WARNING SUPPRESSION
# ==========================================
warnings.filterwarnings("ignore", category=UserWarning)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
logging.getLogger('easyocr').setLevel(logging.ERROR)

# Initialize models globally to avoid reloading
YOLO_MODEL = YOLO('model_training.pt')
OCR_READER = easyocr.Reader(['en'], gpu=False, verbose=False)

def preprocess_image_for_ocr(img: np.ndarray) -> np.ndarray:
    """
    Preprocesses the cropped plate image using Grayscale and CLAHE 
    to maximize text contrast without losing shadow details.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    
    # Upscale image to improve OCR accuracy on small text
    height, width = gray.shape
    if width < 200:
        scale = max(2.0, 200.0 / width)
        gray = cv2.resize(gray, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_CUBIC)
    
    # Apply CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Convert back to RGB for EasyOCR compatibility
    return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)

def group_and_sort_ocr_results(ocr_result):
    """
    Clusters bounding boxes into lines based on Y-coordinates, 
    then sorts characters left-to-right within each line.
    """
    if not ocr_result: 
        return ""
    
    # Calculate Y-center for each bounding box
    boxes = []
    for bbox, text, conf in ocr_result:
        if conf > 0.2:
            y_center = (bbox[0][1] + bbox[2][1]) / 2
            boxes.append({'bbox': bbox, 'text': text, 'y_center': y_center, 'x_left': bbox[0][0]})
            
    if not boxes: 
        return ""

    # Sort vertically (top to bottom)
    boxes.sort(key=lambda b: b['y_center'])
    
    lines = []
    current_line = [boxes[0]]
    
    for i in range(1, len(boxes)):
        # Group boxes into the same line if their Y-distance is small relative to box height
        box_height = boxes[i]['bbox'][3][1] - boxes[i]['bbox'][0][1]
        if abs(boxes[i]['y_center'] - current_line[-1]['y_center']) < box_height * 0.6:
            current_line.append(boxes[i])
        else:
            lines.append(current_line)
            current_line = [boxes[i]]
    lines.append(current_line)

    # Sort horizontally within each line and concatenate text
    full_text = ""
    for line in lines:
        line.sort(key=lambda b: b['x_left'])
        for b in line:
            full_text += b['text']
            
    return full_text

def extract_license_plates(image_path: str, debug: bool = False) -> Dict[str, Any]:
    """
    Core function to detect license plates using YOLO and extract text via EasyOCR.
    Returns a dictionary containing the status and a list of detected plates.
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"status": "error", "message": "Failed to read image file."}

    detected_plates: list[str] = []
    results = YOLO_MODEL.predict(source=img, conf=0.6, verbose=False)
    
    if debug:
        print(f"[DEBUG] YOLO detected {len(results[0].boxes)} license plate(s)")

    for idx, box in enumerate(results[0].boxes):
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        w, h = x2 - x1, y2 - y1
        
        # Apply dynamic padding (5%) to prevent cropping edge characters
        pad_x, pad_y = int(w * 0.05), int(h * 0.05)
        x1, y1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
        x2, y2 = min(img.shape[1], x2 + pad_x), min(img.shape[0], y2 + pad_y)
        
        cropped_img = img[y1:y2, x1:x2]

        if cropped_img.size == 0: 
            continue

        preprocessed_img = preprocess_image_for_ocr(cropped_img)
        
        try:
            # mag_ratio=2.0 forces EasyOCR to inspect smaller details closely
            ocr_result = OCR_READER.readtext(preprocessed_img, mag_ratio=2.0)
            plate_text = group_and_sort_ocr_results(ocr_result)
        except Exception as e:
            if debug: 
                print(f"[ERROR] OCR processing failed for Box {idx+1}: {e}")
            plate_text = ""
                
        # =========================================
        # POST-PROCESSING: VIETNAMESE LICENSE PLATE RULES
        # =========================================
        clean_plate = re.sub(r'[^A-Z0-9]', '', plate_text.upper())
        
        def correct_vietnamese_plate(text):
            if len(text) < 4: 
                return text
            chars = list(text)
            
            # Character correction dictionaries for common OCR mistakes
            to_num = {'A': '4', 'L': '4', 'B': '8', 'D': '0', 'O': '0', 'S': '5', 'Z': '7', 'G': '6', 'I': '1', 'T': '1'}
            to_char = {'4': 'A', '8': 'B', '0': 'D', '5': 'S', '2': 'Z', '1': 'A', '7': 'T'}
            
            # Rule 1: First 2 characters MUST be numbers (Province code)
            for i in range(min(2, len(chars))):
                if chars[i] in to_num: 
                    chars[i] = to_num[chars[i]]
                    
            # Rule 2: 3rd character MUST be a letter (Series)
            if chars[2] in to_char: 
                chars[2] = to_char[chars[2]]
                
            # Rule 3: Last 4-5 characters MUST be numbers
            for i in range(3, len(chars)):
                if len(chars) - i <= 5: 
                    if chars[i] in to_num: 
                        chars[i] = to_num[chars[i]]
                
            return "".join(chars)

        clean_plate = correct_vietnamese_plate(clean_plate)
        
        # Validate final length
        if 4 <= len(clean_plate) <= 15:
            if debug:
                print(f"[DEBUG] Box {idx+1} Final cleaned plate: '{clean_plate}'")
            detected_plates.append(clean_plate)

    return {"status": "success", "plates": detected_plates}

# ==========================================
# STANDALONE TESTING MODULE
# ==========================================
if __name__ == "__main__":
    test_folder = "test_image"
    if not os.path.exists(test_folder):
        print(f"[ERROR] Folder '{test_folder}' not found.")
    else:
        image_files = glob.glob(os.path.join(test_folder, "*.[jp][pn]*g"))
        print(f"[INFO] Found {len(image_files)} images. Starting extraction...\n" + "-"*50)
        
        for img_path in image_files:
            filename = os.path.basename(img_path)
            print(f"[INFO] Processing: {filename}")
            
            result = extract_license_plates(img_path, debug=True)
            
            if result.get("status") == "success" and result.get("plates"):
                print(f"[INFO] Result: {result['plates']}")
            else:
                print("[WARN] Result: No plate found.")
            print("-" * 50)