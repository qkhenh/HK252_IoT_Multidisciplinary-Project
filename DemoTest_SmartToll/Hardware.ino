#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2); 
Servo sVao, sRa;

const int GATE_DOWN = 160;
const int GATE_UP   = 60;  
const int buzzer = 10;
const int threshold = 10; 

// --- LANE A (ENTRY) ---
const int trigInA = 2;  const int echoInA = 3; 
const int trigOutA = 4; const int echoOutA = 5;

// --- LANE B (EXIT) - ADDED ---
const int trigInB = 12; const int echoInB = A0; 
const int trigOutB = 8;  const int echoOutB = 11;

// Trạng thái hệ thống
bool vaoOpen = false;
bool raOpen = false;
bool manualOverride = false; 

void setup() {
  Serial.begin(9600);
  lcd.init(); lcd.backlight();
  sVao.attach(6);
  sRa.attach(7); // Servo cổng ra
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
    if (input.length() == 0) return; // Bảo vệ lỗi chuỗi rỗng

    int separator = input.indexOf(':');
    String cmd = (separator != -1) ? input.substring(0, separator) : input;
    String payload = (separator != -1) ? input.substring(separator + 1) : "";

    // 🔥 BẢO VỆ LCD: Ép cắt chuỗi tối đa 16 ký tự để không bị tràn màn hình
    if (payload.length() > 16) {
        payload = payload.substring(0, 16);
    }

    // LUỒNG 1: QUÉT AI TỰ ĐỘNG (ENTRY)
    if (cmd == "ENTRY_GO") {
      sVao.write(GATE_UP);
      vaoOpen = true;
      manualOverride = false;
      updateLCD("WELCOME,", payload);
      beep(1);
    }
    // LUỒNG MỚI: QUÉT AI TỰ ĐỘNG (EXIT)
    else if (cmd == "EXIT_GO") {
      sRa.write(GATE_UP);
      raOpen = true;
      manualOverride = false;
      updateLCD("SAFE TRAVELS,", payload);
      beep(1);
    }
    // LUỒNG 2: MỞ THỦ CÔNG CỔNG VÀO
    else if (cmd == "MANUAL_OPEN_IN") {
      sVao.write(GATE_UP);
      vaoOpen = true;
      manualOverride = true; 
      updateLCD("EMERGENCY OPENED", "INBOUND GATE");
    }
    // LUỒNG 3: MỞ THỦ CÔNG CỔNG RA
    else if (cmd == "MANUAL_OPEN_OUT") {
      sRa.write(GATE_UP);
      raOpen = true;
      manualOverride = true; 
      updateLCD("EMERGENCY OPENED", "OUTBOUND GATE");
    }
    // LUỒNG 4: ĐÓNG CỔNG THỦ CÔNG
    else if (cmd == "FORCE_CLOSE") {
      sVao.write(GATE_DOWN);
      sRa.write(GATE_DOWN);
      vaoOpen = false;
      raOpen = false;
      manualOverride = false; 
      updateLCD("EMERGENCY CLOSED", "By Operator");
      delay(2000);
      resetLCD();
    }
    // LUỒNG 5: TỪ CHỐI XE
    else if (cmd == "DENY_PLATE") {
      updateLCD("UNAUTHORIZED", payload);
      beep(1);
    }
    // LUỒNG 6: BÁO ĐỘNG ANTI-PASSBACK
    else if (cmd == "ALARM_FAKE") {
      sVao.write(GATE_DOWN);
      sRa.write(GATE_DOWN);
      vaoOpen = false;
      raOpen = false;
      updateLCD("ANTI-PASSBACK!", "WARNING: " + payload);
      for(int i = 0; i < 5; i++) { 
        digitalWrite(buzzer, HIGH); 
        delay(250);
        digitalWrite(buzzer, LOW);  
        delay(250);
      }
      resetLCD();
    }
  }

  // --- 2. XỬ LÝ CẢM BIẾN SIÊU ÂM ---
  int dInA = getDist(trigInA, echoInA);
  int dOutA = getDist(trigOutA, echoOutA);
  int dInB = getDist(trigInB, echoInB);   // Cảm biến chờ cổng ra
  int dOutB = getDist(trigOutB, echoOutB); // Cảm biến sau cổng ra

  // PHÁT HIỆN XE CỔNG VÀO (LANE A)
  if (dInA < threshold && !vaoOpen) {
    updateLCD("ENTRY DETECTED", "Scanning Plate...");
    Serial.println("CAR_ARRIVED"); 
    delay(1500); 
  }

  // PHÁT HIỆN XE CỔNG RA (LANE B) - MỚI
  if (dInB < threshold && !raOpen) {
    updateLCD("EXIT DETECTED", "Checking Plate...");
    Serial.println("CAR_EXITING"); // Gửi tín hiệu để Python quét Unflag
    delay(1500);
  }

  // TỰ ĐỘNG ĐÓNG CỔNG - Chỉ chạy nếu KHÔNG BỊ KHÓA
  if (!manualOverride) {
    // Đóng cổng vào
    if (dOutA < threshold && vaoOpen) {
      delay(1000); 
      sVao.write(GATE_DOWN);
      vaoOpen = false;
      updateLCD("GATE CLOSING", "Thank You");
      beep(2);
      delay(2000);
      resetLCD();
    }
    // Đóng cổng ra - MỚI
    if (dOutB < threshold && raOpen) {
      delay(1000); 
      sRa.write(GATE_DOWN);
      raOpen = false;
      updateLCD("GATE CLOSING", "See You Again");
      beep(2);
      delay(2000);
      resetLCD();
    }
  }
}

// --- Các hàm phụ trợ ---
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
