#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2); 
Servo sVao, sRa;

// --- ANGLE CONFIGURATION ---
const int CLOSED = 180;   
const int OPEN   = 70; 

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
  
  // Initial Positions
  sVao.write(CLOSED);
  sRa.write(OPEN);
  
  lcd.print("CC04 Group 8");
  lcd.setCursor(0, 1);
  lcd.print("System Ready");
  delay(2000);
  lcd.clear();
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

void loop() {
  // --- SCAN ALL SENSORS ---
  int dInA = getDist(trigInA, echoInA);
  int dOutA = getDist(trigOutA, echoOutA);
  int dInB = getDist(trigInB, echoInB);
  int dOutB = getDist(trigOutB, echoOutB);

  // --- ENTRY LOGIC (LANE A) ---
  if (dInA < threshold && !vaoOpen) {
    sVao.write(CLOSED);
    vaoOpen = true;
    updateLCD("Entry: OPEN", "Scanning License Plate");
    beep(1);
  }
  if (dOutA < threshold && vaoOpen) {
    delay(800); 
    sVao.write(OPEN);
    vaoOpen = false;
    updateLCD("Entry: CLOSED", "Welcome Mr.John");
    beep(2);
    delay(2000);
    resetLCD();
  }

  // --- EXIT LOGIC (LANE B) ---
  if (dInB < threshold && !raOpen) {
    sRa.write(CLOSED);
    raOpen = true;
    updateLCD("Exit: OPEN", "Safe Travels");
    beep(1);
  }
  if (dOutB < threshold && raOpen) {
    delay(800);
    sRa.write(OPEN);
    raOpen = false;
    beep(2);
    delay(2000);
    resetLCD();
  }
}

// Helper Functions
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
