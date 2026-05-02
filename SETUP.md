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

**Hoặc bằng command (Từ thư mục gốc dự án):**
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

> **Lưu ý:** Lệnh `npm start` sẽ chạy server và treo terminal. Vui lòng **mở một cửa sổ Terminal mới** để thực hiện các bước tiếp theo.

---

## 4. Chạy Frontend

**Mở Terminal mới (Từ thư mục gốc dự án):**
```powershell
cd frontend
npm install
npm run dev
```

> **Lưu ý:** Lệnh này cũng sẽ treo terminal. Trang web sẽ chạy tại địa chỉ `http://localhost:5173`. Để chạy script Test bên dưới, bạn cần **mở thêm một cửa sổ Terminal mới**.

---

## 5. Test

**Mở Terminal mới (Từ thư mục gốc dự án):**
```powershell
cd backend

# Health check
Invoke-RestMethod http://localhost:5000/api/v1/health

# Full test
.\test-backend.ps1 -RunNumber 1
```

**Test accounts:** `manager_thinh`, `guard_nam`, `citizen_hoa` / password: `password123`

---

## Reset Database

**(Chạy ở thư mục gốc của dự án)**
```powershell
# Chuyển về thư mục gốc nếu bạn đang ở backend
# cd .. 

docker-compose down -v
docker-compose up -d
Start-Sleep 5
docker cp database/db.sql iot_project_db_252:/tmp/db.sql
docker exec -it iot_project_db_252 psql -U admin -d iot_main_db_252 -f /tmp/db.sql
cd backend
node src/scripts/seed.js
```
