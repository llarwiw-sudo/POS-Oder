const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Database
const db = new sqlite3.Database('./data/restaurant.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize Database Tables
function initializeDatabase() {
  db.serialize(() => {
    // Tables creation
    db.run(`CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT UNIQUE NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT DEFAULT 'available',
      zone TEXT DEFAULT 'main'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category_id INTEGER,
      image TEXT,
      is_available INTEGER DEFAULT 1,
      is_popular INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
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
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      special_note TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      min_quantity REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reservations (
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
    )`);

    // Insert default data
    db.run(`INSERT OR IGNORE INTO categories (name, description, display_order) VALUES 
      ('อาหารจานหลัก', 'เมนูอาหารจานหลัก', 1),
      ('อาหารทานเล่น', 'เมนูทานเล่น', 2),
      ('ของหวาน', 'เมนูของหวาน', 3),
      ('เครื่องดื่ม', 'เมนูเครื่องดื่ม', 4)
    `);

    db.run(`INSERT OR IGNORE INTO tables (table_number, capacity, status, zone) VALUES 
      ('T01', 2, 'available', 'A'),
      ('T02', 2, 'available', 'A'),
      ('T03', 4, 'available', 'A'),
      ('T04', 4, 'available', 'A'),
      ('T05', 6, 'available', 'B'),
      ('T06', 6, 'available', 'B'),
      ('T07', 8, 'available', 'B'),
      ('T08', 2, 'available', 'C'),
      ('T09', 4, 'available', 'C'),
      ('T10', 10, 'available', 'C')
    `);

    db.run(`INSERT OR IGNORE INTO staff (name, role, phone) VALUES 
      ('สมชาย', 'manager', '081-111-1111'),
      ('สมหญิง', 'cashier', '082-222-2222'),
      ('วิชัย', 'waiter', '083-333-3333'),
      ('พิมพ์', 'waiter', '084-444-4444'),
      ('ประเสริฐ', 'chef', '085-555-5555')
    `);

    db.run(`INSERT OR IGNORE INTO inventory (name, unit, quantity, min_quantity, cost_per_unit) VALUES 
      ('ข้าวสาร', 'kg', 50, 10, 25),
      ('น้ำมันพืช', 'liter', 20, 5, 45),
      ('ซอสถั่วเหลือง', 'liter', 10, 3, 60),
      ('เนื้อไก่', 'kg', 15, 5, 85),
      ('เนื้อหมู', 'kg', 15, 5, 120),
      ('กุ้ง', 'kg', 10, 3, 180),
      ('ผักสด', 'kg', 20, 5, 30),
      ('น้ำตาล', 'kg', 10, 3, 22)
    `);
  });
}

// ==================== API ROUTES ====================

// Tables
app.get('/api/tables', (req, res) => {
  db.all('SELECT * FROM tables ORDER BY table_number', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/tables/:id', (req, res) => {
  const { status } = req.body;
  db.run('UPDATE tables SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// Check-in table (เปิดโต๊ะ - ต้องมีลูกค้านั่งก่อนถึงสั่งได้)
app.post('/api/tables/:id/checkin', (req, res) => {
  const { guests } = req.body;
  db.run('UPDATE tables SET status = "occupied" WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'เปิดโต๊ะสำเร็จ' });
  });
});

// Merge tables (รวมโต๊ะ) - รวมโต๊ะเล็กเป็นโต๊ะใหญ่
app.post('/api/tables/merge', (req, res) => {
  const { table_ids, new_table_number, new_capacity } = req.body;
  
  if (!table_ids || table_ids.length < 2) {
    return res.status(400).json({ error: 'ต้องเลือกอย่างน้อย 2 โต๊ะเพื่อรวม' });
  }
  
  // Check all tables exist and are available
  const placeholders = table_ids.map(() => '?').join(',');
  db.all(`SELECT * FROM tables WHERE id IN (${placeholders})`, table_ids, (err, tables) => {
    if (err) return res.status(500).json({ error: err.message });
    if (tables.length !== table_ids.length) {
      return res.status(400).json({ error: 'ไม่พบโต๊ะบางโต๊ะในระบบ' });
    }
    
    // Check all tables are available
    const occupiedTables = tables.filter(t => t.status !== 'available');
    if (occupiedTables.length > 0) {
      return res.status(400).json({ 
        error: `ไม่สามารถรวมโต๊ะได้ เพราะโต๊ะ ${occupiedTables.map(t => t.table_number).join(', ')} ยังไม่ว่าง`,
        occupied_tables: occupiedTables.map(t => t.table_number)
      });
    }
    
    // Calculate total capacity if not provided
    const totalCapacity = new_capacity || tables.reduce((sum, t) => sum + t.capacity, 0);
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Create new merged table
      db.run('INSERT INTO tables (table_number, capacity, status, zone) VALUES (?, ?, "available", ?)',
        [new_table_number || `M${Date.now().toString().slice(-4)}`, totalCapacity, tables[0].zone],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          
          const newTableId = this.lastID;
          
          // Mark old tables as merged (set status to 'merged')
          const updateStmt = db.prepare('UPDATE tables SET status = "merged" WHERE id = ?');
          table_ids.forEach(id => updateStmt.run(id));
          updateStmt.finalize();
          
          db.run('COMMIT');
          res.json({ 
            success: true, 
            new_table_id: newTableId,
            new_table_number: new_table_number || `M${Date.now().toString().slice(-4)}`,
            merged_tables: tables.map(t => t.table_number),
            total_capacity: totalCapacity,
            message: `รวมโต๊ะ ${tables.map(t => t.table_number).join(' + ')} เป็นโต๊ะ ${new_table_number || `M${Date.now().toString().slice(-4)}`} (${totalCapacity} ที่นั่ง) สำเร็จ`
          });
        });
    });
  });
});

// Unmerge table (แยกโต๊ะ) - แยกโต๊ะที่รวมแล้วกลับเป็นโต๊ะเดิม
app.post('/api/tables/:id/unmerge', (req, res) => {
  // Get the merged table info
  db.get('SELECT * FROM tables WHERE id = ?', [req.params.id], (err, mergedTable) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!mergedTable) return res.status(404).json({ error: 'ไม่พบโต๊ะนี้' });
    if (mergedTable.status !== 'merged' && !mergedTable.table_number.startsWith('M')) {
      return res.status(400).json({ error: 'โต๊ะนี้ไม่ใช่โต๊ะที่รวมไว้' });
    }
    
    // Check if table is occupied
    if (mergedTable.status === 'occupied') {
      return res.status(400).json({ error: 'ไม่สามารถแยกโต๊ะที่มีลูกค้าอยู่ได้' });
    }
    
    // Delete the merged table
    db.run('DELETE FROM tables WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Restore original tables (set status back to 'available')
      // This is a simplified version - in production, you'd track which tables were merged
      res.json({ 
        success: true, 
        message: `แยกโต๊ะ ${mergedTable.table_number} สำเร็จ`
      });
    });
  });
});

// Check-out table (ปิดโต๊ะ) - ตรวจสอบว่าไม่มีออเดอร์ที่ยังไม่ได้ชำระ
app.post('/api/tables/:id/checkout', (req, res) => {
  // Check for unpaid orders
  db.all(`SELECT COUNT(*) as count FROM orders 
          WHERE table_id = ? AND status != 'paid'`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row[0].count > 0) {
      return res.status(400).json({ 
        error: `ยังมีออเดอร์ที่ยังไม่ได้ชำระ ${row[0].count} รายการ`,
        unpaid_count: row[0].count
      });
    }
    
    db.run('UPDATE tables SET status = "available" WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'ปิดโต๊ะสำเร็จ' });
    });
  });
});

// Get order for receipt (พิมพ์ใบเสร็จ)
app.get('/api/orders/:id/receipt', (req, res) => {
  db.get(`SELECT o.*, t.table_number 
          FROM orders o 
          LEFT JOIN tables t ON o.table_id = t.id 
          WHERE o.id = ?`, [req.params.id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    
    db.all(`SELECT oi.*, m.name, m.price 
            FROM order_items oi 
            JOIN menu_items m ON oi.menu_item_id = m.id 
            WHERE oi.order_id = ?`, [req.params.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all(`SELECT * FROM payments WHERE order_id = ?`, [req.params.id], (err, payments) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({
          order,
          items,
          payments
        });
      });
    });
  });
});

// Check table status for QR ordering
app.get('/api/tables/:id/status', (req, res) => {
  db.get('SELECT * FROM tables WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'ไม่พบโต๊ะนี้' });
    res.json({ 
      id: row.id, 
      table_number: row.table_number, 
      status: row.status,
      capacity: row.capacity,
      can_order: row.status === 'occupied'
    });
  });
});

// Categories
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY display_order', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Menu Items
app.get('/api/menu', (req, res) => {
  db.all(`SELECT m.*, c.name as category_name 
          FROM menu_items m 
          LEFT JOIN categories c ON m.category_id = c.id 
          ORDER BY c.display_order, m.name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/menu', (req, res) => {
  const { name, description, price, category_id, image } = req.body;
  db.run('INSERT INTO menu_items (name, description, price, category_id, image) VALUES (?, ?, ?, ?, ?)',
    [name, description, price, category_id, image], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/menu/:id', (req, res) => {
  const { name, description, price, category_id, is_available, is_popular } = req.body;
  db.run('UPDATE menu_items SET name = ?, description = ?, price = ?, category_id = ?, is_available = ?, is_popular = ? WHERE id = ?',
    [name, description, price, category_id, is_available, is_popular, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/menu/:id', (req, res) => {
  db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// Orders
app.get('/api/orders', (req, res) => {
  db.all(`SELECT o.*, t.table_number 
          FROM orders o 
          LEFT JOIN tables t ON o.table_id = t.id 
          ORDER BY o.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/orders/active', (req, res) => {
  db.all(`SELECT o.*, t.table_number 
          FROM orders o 
          LEFT JOIN tables t ON o.table_id = t.id 
          WHERE o.status IN ('pending', 'preparing', 'serving')
          ORDER BY o.created_at ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/orders', (req, res) => {
  const { table_id, order_number, items, created_by } = req.body;
  
  // Check if table is occupied before accepting order
  db.get('SELECT status FROM tables WHERE id = ?', [table_id], (err, table) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!table) return res.status(404).json({ error: 'ไม่พบโต๊ะนี้' });
    if (table.status !== 'occupied') {
      return res.status(403).json({ 
        error: 'โต๊ะนี้ยังไม่ได้เปิดใช้งาน หรือปิดโต๊ะแล้ว',
        table_status: table.status
      });
    }
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      db.run('INSERT INTO orders (table_id, order_number, created_by) VALUES (?, ?, ?)',
        [table_id, order_number, created_by], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          
          const orderId = this.lastID;
          const stmt = db.prepare('INSERT INTO order_items (order_id, menu_item_id, quantity, special_note) VALUES (?, ?, ?, ?)');
          
          items.forEach(item => {
            stmt.run(orderId, item.menu_item_id, item.quantity, item.special_note || null);
          });
          
          stmt.finalize();
          db.run('COMMIT');
          res.json({ success: true, order_id: orderId });
        });
    });
  });
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  db.run('UPDATE orders SET status = ?, completed_at = ? WHERE id = ?',
    [status, completedAt, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    });
});

// Order Items
app.get('/api/orders/:id/items', (req, res) => {
  db.all(`SELECT oi.*, m.name, m.price 
          FROM order_items oi 
          JOIN menu_items m ON oi.menu_item_id = m.id 
          WHERE oi.order_id = ?`, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/orders/items/:id/status', (req, res) => {
  const { status } = req.body;
  db.run('UPDATE order_items SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// Payments
app.post('/api/payments', (req, res) => {
  const { order_id, amount, payment_method } = req.body;
  
  // Verify order exists and is not already paid
  db.get('SELECT * FROM orders WHERE id = ?', [order_id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    if (order.status === 'paid') {
      return res.status(400).json({ error: 'ออเดอร์นี้ชำระเงินแล้ว' });
    }
    
    // Calculate total from order items
    db.all(`SELECT oi.quantity, m.price 
            FROM order_items oi 
            JOIN menu_items m ON oi.menu_item_id = m.id 
            WHERE oi.order_id = ?`, [order_id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Verify amount matches calculated total
      if (Math.abs(amount - calculatedTotal) > 0.01) {
        return res.status(400).json({ 
          error: 'จำนวนเงินไม่ตรงกับยอดออเดอร์',
          calculated_total: calculatedTotal,
          provided_amount: amount
        });
      }
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Update order with total and status
        db.run('UPDATE orders SET total_amount = ?, status = "paid" WHERE id = ?',
          [calculatedTotal, order_id], function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            // Record payment
            db.run('INSERT INTO payments (order_id, amount, payment_method) VALUES (?, ?, ?)',
              [order_id, amount, payment_method], function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                
                db.run('COMMIT');
                res.json({ 
                  success: true, 
                  payment_id: this.lastID,
                  total: calculatedTotal
                });
              });
          });
      });
    });
  });
});

// Staff
app.get('/api/staff', (req, res) => {
  db.all('SELECT * FROM staff ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/staff', (req, res) => {
  const { name, role, phone, email } = req.body;
  db.run('INSERT INTO staff (name, role, phone, email) VALUES (?, ?, ?, ?)',
    [name, role, phone, email], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

// Inventory
app.get('/api/inventory', (req, res) => {
  db.all('SELECT * FROM inventory ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/inventory/:id', (req, res) => {
  const { quantity, min_quantity } = req.body;
  db.run('UPDATE inventory SET quantity = ?, min_quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
    [quantity, min_quantity, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    });
});

// Reservations
app.get('/api/reservations', (req, res) => {
  db.all(`SELECT r.*, t.table_number 
          FROM reservations r 
          LEFT JOIN tables t ON r.table_id = t.id 
          ORDER BY r.reservation_date, r.reservation_time`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/reservations', (req, res) => {
  const { customer_name, customer_phone, table_id, reservation_date, reservation_time, guests, notes } = req.body;
  db.run('INSERT INTO reservations (customer_name, customer_phone, table_id, reservation_date, reservation_time, guests, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [customer_name, customer_phone, table_id, reservation_date, reservation_time, guests, notes], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

// Reports
app.get('/api/reports/sales', (req, res) => {
  const { start_date, end_date } = req.query;
  db.all(`SELECT 
            DATE(created_at) as date,
            COUNT(*) as order_count,
            SUM(total_amount) as total_sales
          FROM orders 
          WHERE status = 'paid' 
            AND created_at BETWEEN ? AND ?
          GROUP BY DATE(created_at)
          ORDER BY date DESC`, [start_date, end_date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/reports/popular', (req, res) => {
  const { start_date, end_date } = req.query;
  db.all(`SELECT m.name, SUM(oi.quantity) as total_sold, SUM(oi.quantity * m.price) as total_revenue
          FROM order_items oi
          JOIN menu_items m ON oi.menu_item_id = m.id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status = 'paid' AND o.created_at BETWEEN ? AND ?
          GROUP BY m.id
          ORDER BY total_sold DESC
          LIMIT 10`, [start_date, end_date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Dashboard Stats
app.get('/api/dashboard', (req, res) => {
  const stats = {};
  
  db.get("SELECT COUNT(*) as count FROM tables WHERE status = 'available'", [], (err, row) => {
    stats.available_tables = row.count;
  });
  
  db.get("SELECT COUNT(*) as count FROM tables WHERE status = 'occupied'", [], (err, row) => {
    stats.occupied_tables = row.count;
  });
  
  db.get("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'preparing', 'serving')", [], (err, row) => {
    stats.active_orders = row.count;
  });
  
  db.get("SELECT SUM(total_amount) as total FROM orders WHERE DATE(created_at) = DATE('now') AND status = 'paid'", [], (err, row) => {
    stats.today_sales = row.total || 0;
  });
  
  db.get("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = DATE('now') AND status = 'paid'", [], (err, row) => {
    stats.today_orders = row.count;
  });
  
  db.get("SELECT COUNT(*) as count FROM inventory WHERE quantity <= min_quantity", [], (err, row) => {
    stats.low_stock = row.count;
  });
  
  setTimeout(() => res.json(stats), 100);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;