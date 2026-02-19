# HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY SMART TOLL GATE BACKEND

## Mục lục
1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt Docker và chạy Database](#2-cài-đặt-docker-và-chạy-database)
3. [Kết nối Database với DBeaver](#3-kết-nối-database-với-dbeaver)
4. [Chạy Backend Server](#4-chạy-backend-server)
5. [Test API](#5-test-api)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Yêu cầu hệ thống

### Phần mềm cần cài đặt:
- **Docker Desktop**: [Download](https://www.docker.com/products/docker-desktop/)
- **Node.js** (v18+): [Download](https://nodejs.org/)
- **DBeaver Community**: [Download](https://dbeaver.io/download/)
- **Git**: [Download](https://git-scm.com/)

### Kiểm tra phiên bản:
```powershell
docker --version    # Docker version 24.x+
node --version      # v18.x+
npm --version       # 9.x+
```

---

## 2. Cài đặt Docker và chạy Database

### Bước 1: Khởi động Docker Desktop
- Mở **Docker Desktop** và đợi cho đến khi icon chuyển sang màu xanh (running)
- Kiểm tra Docker đang chạy:
```powershell
docker ps
```

### Bước 2: Clone repository (nếu chưa có)
```powershell
git clone <repository-url>
cd HK252_IoT_Multidisciplinary-Project
```

### Bước 3: Khởi động PostgreSQL Container
```powershell
# Chạy từ thư mục gốc dự án (chứa docker-compose.yml)
docker-compose up -d
```

### Bước 4: Kiểm tra container đang chạy
```powershell
docker ps
```

**Output mong đợi:**
```
CONTAINER ID   IMAGE                   PORTS                    NAMES
xxxxx          pgvector/pgvector:pg17  0.0.0.0:5433->5432/tcp   iot_project_db_252
```

### Bước 5: Xem logs để đảm bảo database ready
```powershell
docker logs iot_project_db_252
```

**Thông tin kết nối Database:**
| Thuộc tính | Giá trị |
|------------|---------|
| Host | `localhost` |
| Port | `5433` |
| Database | `iot_main_db_252` |
| Username | `admin` |
| Password | `12345678` |

---

## 3. Kết nối Database với DBeaver

### Bước 1: Mở DBeaver và tạo kết nối mới
1. Mở **DBeaver**
2. Click **Database** → **New Database Connection** (hoặc Ctrl+Shift+N)
3. Chọn **PostgreSQL** → **Next**

### Bước 2: Điền thông tin kết nối
```
Host: localhost
Port: 5433
Database: iot_main_db_252
Username: admin
Password: 12345678
```

![DBeaver Settings](https://i.imgur.com/placeholder.png)

### Bước 3: Test Connection
- Click **Test Connection...**
- Nếu lần đầu, DBeaver sẽ yêu cầu download PostgreSQL JDBC driver → Click **Download**
- Chờ đến khi hiện thông báo **"Connected"** → **OK**

### Bước 4: Tạo Schema (Chạy SQL Script)
1. Trong DBeaver, mở **SQL Editor** (F3 hoặc Ctrl+Enter)
2. Copy toàn bộ nội dung file `database/db.sql`
3. Paste vào SQL Editor
4. Chọn toàn bộ (Ctrl+A) → Execute (Ctrl+Enter hoặc ▶️)

**Hoặc chạy bằng command line:**
```powershell
# Copy file SQL vào container và execute
docker cp database/db.sql iot_project_db_252:/tmp/db.sql
docker exec -it iot_project_db_252 psql -U admin -d iot_main_db_252 -f /tmp/db.sql
```

### Bước 5: Verify tables đã được tạo
Trong DBeaver:
1. Expand **iot_main_db_252** → **Schemas** → **public** → **Tables**
2. Kiểm tra các bảng đã được tạo:
   - `users`, `citizens`, `security_guards`, `managers`
   - `zones`, `houses`, `gates`, `vehicles`
   - `access_logs`, `ai_predictions`, v.v.

---

## 4. Chạy Backend Server

### Bước 1: Di chuyển vào thư mục backend
```powershell
cd backend
```

### Bước 2: Cài đặt dependencies
```powershell
npm install
```

### Bước 3: Tạo file `.env`
Tạo file `.env` trong thư mục `backend/`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=iot_main_db_252
DB_USER=admin
DB_PASS=12345678

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=*
```

**PowerShell command để tạo file:**
```powershell
@"
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5433
DB_NAME=iot_main_db_252
DB_USER=admin
DB_PASS=12345678
JWT_SECRET=smart_toll_gate_secret_key_252
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
"@ | Out-File -FilePath .env -Encoding UTF8
```

### Bước 4: Seed dữ liệu test
```powershell
node src/scripts/seed.js
```

**Output mong đợi:**
```
🌱 Bắt đầu seed dữ liệu...
✅ Đã tạo 3 zones
✅ Đã tạo 4 houses
✅ Đã tạo 4 gates
...
🎉 Seed dữ liệu hoàn tất!

📋 Test accounts:
   - manager_thinh / password123 (Manager)
   - guard_nam / password123 (Guard)
   - citizen_hoa / password123 (Citizen)
```

### Bước 5: Chạy server
**Development mode (auto-reload):**
```powershell
npm run dev
```

**Production mode:**
```powershell
npm start
```

**Output mong đợi:**
```
✅ Đã kết nối PostgreSQL thành công!
🚀 Server đang chạy tại http://localhost:5000
📋 Health check: http://localhost:5000/api/v1/health
```

---

## 5. Test API

### Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/health"
```

### Login
```powershell
$body = '{"username":"citizen_hoa","password":"password123"}'
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body
```

### Chạy Full Test Suite
```powershell
.\test-backend.ps1 -RunNumber 1
```

### Test Accounts

| Username | Password | Role |
|----------|----------|------|
| `manager_thinh` | `password123` | Manager |
| `guard_nam` | `password123` | Guard |
| `citizen_hoa` | `password123` | Citizen |

---

## 6. Troubleshooting

### ❌ Lỗi: "Cannot connect to database"
```powershell
# Kiểm tra container đang chạy
docker ps

# Nếu không thấy container, start lại
docker-compose up -d

# Kiểm tra logs
docker logs iot_project_db_252
```

### ❌ Lỗi: "Port 5433 already in use"
```powershell
# Tìm process đang dùng port 5433
netstat -ano | findstr :5433

# Dừng process (thay PID)
taskkill /PID <PID> /F

# Hoặc đổi port trong docker-compose.yml
```

### ❌ Lỗi: "ECONNREFUSED 127.0.0.1:5433"
- Đảm bảo Docker Desktop đang chạy
- Kiểm tra Windows Firewall không chặn port 5433
- Thử restart Docker Desktop

### ❌ Lỗi: "relation does not exist"
Database schema chưa được tạo. Chạy lại:
```powershell
docker cp database/db.sql iot_project_db_252:/tmp/db.sql
docker exec -it iot_project_db_252 psql -U admin -d iot_main_db_252 -f /tmp/db.sql
```

### ❌ Lỗi: "Invalid username or password"
Chạy lại seed script:
```powershell
cd backend
node src/scripts/seed.js
```

### 🔄 Reset toàn bộ Database
```powershell
# Dừng và xóa container + volume
docker-compose down -v

# Khởi động lại
docker-compose up -d

# Đợi 5 giây rồi chạy schema
Start-Sleep -Seconds 5
docker cp database/db.sql iot_project_db_252:/tmp/db.sql
docker exec -it iot_project_db_252 psql -U admin -d iot_main_db_252 -f /tmp/db.sql

# Seed data
cd backend
node src/scripts/seed.js
```

---

## Quick Start (TL;DR)

```powershell
# 1. Start Docker container
docker-compose up -d

# 2. Wait for database ready
Start-Sleep -Seconds 5

# 3. Create schema
docker cp database/db.sql iot_project_db_252:/tmp/db.sql
docker exec -it iot_project_db_252 psql -U admin -d iot_main_db_252 -f /tmp/db.sql

# 4. Setup backend
cd backend
npm install

# 5. Create .env file (copy nội dung từ hướng dẫn ở trên)

# 6. Seed data
node src/scripts/seed.js

# 7. Start server
npm start

# 8. Test
.\test-backend.ps1 -RunNumber 1
```

---

**📝 Ghi chú:** File này được tạo tự động. Mọi thắc mắc liên hệ team phát triển.
