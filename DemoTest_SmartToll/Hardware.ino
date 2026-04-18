#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2); 
Servo sVao, sRa;

const int GATE_DOWN = 180;
const int GATE_UP   = 70;  
const int buzzer = 10;
const int threshold = 10; 

// Cảm biến
const int trigInA = 2;  const int echoInA = 3; 
const int trigOutA = 4; const int echoOutA = 5;

// Trạng thái hệ thống
bool vaoOpen = false;
bool raOpen = false;
bool manualOverride = false; // Cờ an toàn: Ngăn cảm biến tự đóng cửa

void setup() {
  Serial.begin(9600);
  lcd.init(); lcd.backlight();
  sVao.attach(6);
  sRa.attach(7);
  pinMode(buzzer, OUTPUT);
  sVao.write(GATE_DOWN);
  sRa.write(GATE_DOWN);
  updateLCD("BKEzPass Group 8", "System Ready");
  delay(2000);
  resetLCD();
}

void loop() {
  // --- 1. NHẬN LỆNH TỪ PYTHON ---
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    int separator = input.indexOf(':');
    String cmd = (separator != -1) ? input.substring(0, separator) : input;
    String payload = (separator != -1) ? input.substring(separator + 1) : "";

    // LUỒNG 1: QUÉT AI TỰ ĐỘNG (Phải đúng chữ ENTRY_GO)
    if (cmd == "ENTRY_GO") {
      sVao.write(GATE_UP);
      vaoOpen = true;
      manualOverride = false; // Hủy cờ thủ công nếu có
      updateLCD("WELCOME,", payload);
      beep(1);
    }
    // LUỒNG 2: MỞ THỦ CÔNG CỔNG VÀO (INBOUND)
    else if (cmd == "MANUAL_OPEN_IN") {
      sVao.write(GATE_UP);
      vaoOpen = true;
      manualOverride = true; // Kích hoạt cờ chặn cảm biến
      updateLCD("EMERGENCY OPENED", "INBOUND GATE");
      beep(1);
    }
    // LUỒNG 3: MỞ THỦ CÔNG CỔNG RA (OUTBOUND)
    else if (cmd == "MANUAL_OPEN_OUT") {
      sRa.write(GATE_UP);
      raOpen = true;
      manualOverride = true; // Kích hoạt cờ chặn cảm biến
      updateLCD("EMERGENCY OPENED", "OUTBOUND GATE");
      beep(1);
    }
    // LUỒNG 4: ĐÓNG CỔNG THỦ CÔNG
    else if (cmd == "FORCE_CLOSE") {
      sVao.write(GATE_DOWN);
      sRa.write(GATE_DOWN);
      vaoOpen = false;
      raOpen = false;
      manualOverride = false; // Mở khóa cho cảm biến siêu âm hoạt động lại
      updateLCD("EMERGENCY CLOSED", "By Operator");
      beep(3);
      delay(2000);
      resetLCD();
    }
    // LUỒNG 5: TỪ CHỐI XE (AI báo sai / Biển cấm)
    else if (cmd == "DENY_PLATE") {
      updateLCD("UNAUTHORIZED", payload);
      beep(1);
    }
    // LUỒNG 6: BÁO ĐỘNG ANTI-PASSBACK (QUAY VÒNG BIỂN SỐ)
    else if (cmd == "ALARM_FAKE") {
      // Đảm bảo cửa đóng chặt
      sVao.write(GATE_DOWN);
      sRa.write(GATE_DOWN);
      vaoOpen = false;
      raOpen = false;
      
      updateLCD("ANTI-PASSBACK!", "WARNING: " + payload);
      
      // Hú còi cảnh báo dồn dập trong đúng 10 giây (20 chu kỳ x 0.5s)
      // Trong 10 giây này hệ thống sẽ bị "đóng băng" để an ninh can thiệp
      for(int i = 0; i < 20; i++) { 
        digitalWrite(buzzer, HIGH); 
        delay(250);
        digitalWrite(buzzer, LOW);  
        delay(250);
      }
      resetLCD(); // Hú xong thì reset màn hình
    }
  }

  // --- 2. XỬ LÝ CẢM BIẾN SIÊU ÂM ---
  int dInA = getDist(trigInA, echoInA);
  int dOutA = getDist(trigOutA, echoOutA);

  // Phát hiện xe chờ ở cổng (Gửi cho Python)
  if (dInA < threshold && !vaoOpen) {
    updateLCD("ENTRY DETECTED", "Scanning Plate...");
    Serial.println("CAR_ARRIVED"); 
    delay(1500); 
  }

  // TỰ ĐỘNG ĐÓNG CỔNG - Chỉ chạy nếu KHÔNG BỊ KHÓA bởi Manual Mode
  if (!manualOverride) {
    if (dOutA < threshold && vaoOpen) {
      delay(1000); 
      sVao.write(GATE_DOWN);
      vaoOpen = false;
      updateLCD("GATE CLOSING", "Thank You");
      beep(2);
      delay(2000);
      resetLCD();
    }
  }
}

// --- Các hàm phụ trợ (Giữ nguyên của bạn) ---
int getDist(int t, int e) {
  pinMode(t, OUTPUT); pinMode(e, INPUT);
  digitalWrite(t, LOW); delayMicroseconds(2);
  digitalWrite(t, HIGH); delayMicroseconds(10);
  digitalWrite(t, LOW);
  long duration = pulseIn(e, HIGH, 25000); 
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}

void beep(int t) {
  for(int i=0; i<t; i++) {
    digitalWrite(buzzer, HIGH); delay(100);
    digitalWrite(buzzer, LOW);  delay(100);
  }
}

void updateLCD(String line1, String line2) {
  lcd.clear(); lcd.print(line1); lcd.setCursor(0, 1); lcd.print(line2);
}

void resetLCD() {
  lcd.clear(); lcd.print("Ready to Respond");
}