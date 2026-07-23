-- Warp Orders Database Schema for Cloudflare D1

-- Tables
CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number TEXT UNIQUE NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT DEFAULT 'available',
  zone TEXT DEFAULT 'main'
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  category_id INTEGER,
  image TEXT,
  is_available INTEGER DEFAULT 1,
  is_popular INTEGER DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  total_amount REAL DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (table_id) REFERENCES tables(id),
  FOREIGN KEY (created_by) REFERENCES staff(id)
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  special_note TEXT,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  min_quantity REAL DEFAULT 0,
  cost_per_unit REAL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  table_id INTEGER,
  reservation_date DATE NOT NULL,
  reservation_time TEXT NOT NULL,
  guests INTEGER,
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  FOREIGN KEY (table_id) REFERENCES tables(id)
);

-- Insert default data
INSERT OR IGNORE INTO categories (name, description, display_order) VALUES 
  ('อาหารจานหลัก', 'เมนูอาหารจานหลัก', 1),
  ('อาหารทานเล่น', 'เมนูทานเล่น', 2),
  ('ของหวาน', 'เมนูของหวาน', 3),
  ('เครื่องดื่ม', 'เมนูเครื่องดื่ม', 4);

INSERT OR IGNORE INTO tables (table_number, capacity, status, zone) VALUES 
  ('T01', 2, 'available', 'A'),
  ('T02', 2, 'available', 'A'),
  ('T03', 4, 'available', 'A'),
  ('T04', 4, 'available', 'A'),
  ('T05', 6, 'available', 'B'),
  ('T06', 6, 'available', 'B'),
  ('T07', 8, 'available', 'B'),
  ('T08', 2, 'available', 'C'),
  ('T09', 4, 'available', 'C'),
  ('T10', 10, 'available', 'C');

INSERT OR IGNORE INTO staff (name, role, phone) VALUES 
  ('สมชาย', 'manager', '081-111-1111'),
  ('สมหญิง', 'cashier', '082-222-2222'),
  ('วิชัย', 'waiter', '083-333-3333'),
  ('พิมพ์', 'waiter', '084-444-4444'),
  ('ประเสริฐ', 'chef', '085-555-5555');

INSERT OR IGNORE INTO inventory (name, unit, quantity, min_quantity, cost_per_unit) VALUES 
  ('ข้าวสาร', 'kg', 50, 10, 25),
  ('น้ำมันพืช', 'liter', 20, 5, 45),
  ('ซอสถั่วเหลือง', 'liter', 10, 3, 60),
  ('เนื้อไก่', 'kg', 15, 5, 85),
  ('เนื้อหมู', 'kg', 15, 5, 120),
  ('กุ้ง', 'kg', 10, 3, 180),
  ('ผักสด', 'kg', 20, 5, 30),
  ('น้ำตาล', 'kg', 10, 3, 22);
