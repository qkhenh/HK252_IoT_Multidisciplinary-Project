#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2); 
Servo sVao, sRa;

// --- ANGLE CONFIGURATION ---
const int GATE_DOWN = 180; // Closed position
const int GATE_UP   = 70;  // Open position

// Hardware Pins
const int buzzer = 10;
const int threshold = 10; 

// Entry Lane (A)
const int trigInA = 2;  const int echoInA = 3; 
const int trigOutA = 4; const int echoOutA = 5;

// Exit Lane (B)
const int trigInB = 12; const int echoInB = A0; 
const int trigOutB = 8;  const int echoOutB = 11;

// State Variables
bool vaoOpen = false;
bool raOpen = false;

void setup() {
  Serial.begin(9600); 
  lcd.init(); lcd.backlight();
  
  sVao.attach(6);
  sRa.attach(7);
  pinMode(buzzer, OUTPUT);
  
  sVao.write(GATE_DOWN);
  sRa.write(GATE_DOWN);
  
  lcd.print("CC04 Group 8");
  lcd.setCursor(0, 1);
  lcd.print("System Ready");
  delay(2000);
  resetLCD();
}

void loop() {
  // --- NEW: LISTEN FOR COMMANDS FROM PYTHON ---
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    // Check for "ENTRY_GO:Name"
    int separator = input.indexOf(':');
    if (separator != -1 && input.substring(0, separator) == "ENTRY_GO") {
      String residentName = input.substring(separator + 1);
      
      sVao.write(GATE_UP); // Open the gate (Angle 70)
      vaoOpen = true;
      updateLCD("WELCOME,", residentName); // Display name from Backend
      beep(1);
    }
  }

  // --- 2. SCAN SENSORS ---
  int dInA = getDist(trigInA, echoInA);
  int dOutA = getDist(trigOutA, echoOutA);

  // --- 3. ENTRY LOGIC (HYBRID) ---
  // If car is at the gate but NOT yet authorized by AI
  if (dInA < threshold && !vaoOpen) {
    updateLCD("ENTRY DETECTED", "Scanning Plate...");
  }

  // If gate is open and car has passed the EXIT sensor (OutA)
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

// Stable Distance Function
int getDist(int t, int e) {
  pinMode(t, OUTPUT);
  pinMode(e, INPUT);
  digitalWrite(t, LOW);  delayMicroseconds(2);
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
  lcd.clear();
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void resetLCD() {
  lcd.clear();
  lcd.print("Ready to Respond");
}
