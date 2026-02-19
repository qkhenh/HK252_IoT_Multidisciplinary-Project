# SETUP - SMART TOLL GATE BACKEND

## 1. Chạy Database (Docker)

```powershell
# Từ thư mục gốc dự án
docker-compose up -d

# Kiểm tra container
docker ps
```

**Thông tin kết nối:**
| Key | Value |
|-----|-------|
| Host | `localhost` |
| Port | `5433` |
| Database | `iot_main_db_252` |
| User | `admin` |
| Password | `12345678` |

---

## 2. Tạo Schema (DBeaver)

1. Mở DBeaver → **New Connection** → PostgreSQL
2. Điền thông tin kết nối ở trên → **Test Connection** → **Finish**
3. Mở SQL Editor (F3) → Paste nội dung file `database/db.sql` → Execute (Ctrl+Enter)

**Hoặc bằng command:**
```powershell
docker cp database/db.sql iot_project_db_252:/tmp/db.sql
docker exec -it iot_project_db_252 psql -U admin -d iot_main_db_252 -f /tmp/db.sql
```

---

## 3. Chạy Backend

```powershell
cd backend
npm install
```

**Tạo file `.env`:**
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

**Seed data + Start:**
```powershell
node src/scripts/seed.js
npm start
```

---

## 4. Test

```powershell
# Health check
Invoke-RestMethod http://localhost:5000/api/v1/health

# Full test
.\test-backend.ps1 -RunNumber 1
```

**Test accounts:** `manager_thinh`, `guard_nam`, `citizen_hoa` / password: `password123`

---

## Reset Database

```powershell
docker-compose down -v
docker-compose up -d
Start-Sleep 5
docker cp database/db.sql iot_project_db_252:/tmp/db.sql
docker exec -it iot_project_db_252 psql -U admin -d iot_main_db_252 -f /tmp/db.sql
cd backend; node src/scripts/seed.js
```
