# Restaurant POS API - Cloudflare Workers + D1

## 📋 ขั้นตอนการ Deploy

### 1. ติดตั้ง Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Login เข้า Cloudflare
```bash
wrangler login
```

### 3. เข้าไปที่โฟลเดอร์ workers-api
```bash
cd workers-api
npm install
```

### 4. สร้าง D1 Database
```bash
npm run db:create
```

หลังจากรันคำสั่งนี้ จะได้ **database_id** กลับมา เช่น:
```
✅ Successfully created DB 'restaurant-pos-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 5. อัพเดท wrangler.toml
เปิดไฟล์ `wrangler.toml` และแทนที่ `YOUR_DATABASE_ID_HERE` ด้วย database_id ที่ได้:
```toml
[[d1_databases]]
binding = "DB"
database_name = "restaurant-pos-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ใส่ ID ที่ได้ตรงนี้
```

### 6. สร้างตารางและข้อมูลเริ่มต้น
```bash
npm run db:init
```

### 7. Deploy Workers
```bash
npm run deploy
```

หลังจาก deploy สำเร็จ จะได้ URL เช่น:
```
https://restaurant-pos-api.YOUR_SUBDOMAIN.workers.dev
```

### 8. อัพเดท Frontend
เปิดไฟล์ `js/app.js` และเปลี่ยน API_URL:
```javascript
// เปลี่ยนจาก
const API_URL = 'http://localhost:3000/api';

// เป็น
const API_URL = 'https://restaurant-pos-api.YOUR_SUBDOMAIN.workers.dev/api';
```

### 9. Push ไป GitHub
```bash
git add .
git commit -m "Update API URL for production"
git push
```

Cloudflare Pages จะ auto-deploy ให้

---

## 🧪 ทดสอบ Local

### รัน Workers แบบ Local
```bash
npm run dev
```

### สร้าง Database Local
```bash
npm run db:init:local
```

---

## 📁 โครงสร้างไฟล์

```
workers-api/
├── src/
│   └── index.js      # API Routes
├── schema.sql        # Database Schema
├── wrangler.toml     # Cloudflare Config
├── package.json
└── README.md
```

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | สถิติ Dashboard |
| GET | /api/tables | รายการโต๊ะทั้งหมด |
| PUT | /api/tables/:id | อัพเดทสถานะโต๊ะ |
| POST | /api/tables/:id/checkin | เปิดโต๊ะ |
| POST | /api/tables/:id/checkout | ปิดโต๊ะ |
| POST | /api/tables/merge | รวมโต๊ะ |
| GET | /api/categories | หมวดหมู่เมนู |
| GET | /api/menu | รายการเมนูทั้งหมด |
| POST | /api/menu | เพิ่มเมนู |
| PUT | /api/menu/:id | แก้ไขเมนู |
| DELETE | /api/menu/:id | ลบเมนู |
| GET | /api/orders | รายการออเดอร์ |
| GET | /api/orders/active | ออเดอร์ที่กำลังทำ |
| POST | /api/orders | สร้างออเดอร์ |
| PUT | /api/orders/:id/status | อัพเดทสถานะออเดอร์ |
| GET | /api/orders/:id/items | รายการอาหารในออเดอร์ |
| GET | /api/orders/:id/receipt | ข้อมูลใบเสร็จ |
| POST | /api/payments | ชำระเงิน |
| GET | /api/staff | รายการพนักงาน |
| POST | /api/staff | เพิ่มพนักงาน |
| GET | /api/inventory | รายการวัตถุดิบ |
| PUT | /api/inventory/:id | อัพเดทวัตถุดิบ |
| GET | /api/reservations | รายการจอง |
| POST | /api/reservations | เพิ่มการจอง |
| GET | /api/reports/sales | รายงานยอดขาย |
| GET | /api/reports/popular | เมนูยอดนิยม |

---

## ⚠️ หมายเหตุ

- Cloudflare Workers Free Plan: 100,000 requests/day
- D1 Free Plan: 5GB storage, 5M rows read/day
- เหมาะสำหรับร้านอาหารขนาดเล็ก-กลาง
