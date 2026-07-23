// Warp Orders API - Cloudflare Workers with D1

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// JSON response helper
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Error response helper
function error(message, status = 500) {
  return json({ error: message }, status);
}

// Router
export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ==================== TABLES ====================
      if (path === '/api/tables' && method === 'GET') {
        const results = await env.DB.prepare('SELECT * FROM tables ORDER BY table_number').all();
        return json(results.results);
      }

      if (path.match(/^\/api\/tables\/\d+$/) && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        await env.DB.prepare('UPDATE tables SET status = ? WHERE id = ?')
          .bind(body.status, id).run();
        return json({ success: true });
      }

      if (path.match(/^\/api\/tables\/\d+\/checkin$/) && method === 'POST') {
        const id = path.split('/')[3];
        await env.DB.prepare('UPDATE tables SET status = "occupied" WHERE id = ?')
          .bind(id).run();
        return json({ success: true, message: 'เปิดโต๊ะสำเร็จ' });
      }

      if (path.match(/^\/api\/tables\/\d+\/checkout$/) && method === 'POST') {
        const id = path.split('/')[3];
        const unpaid = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status != "paid"'
        ).bind(id).first();
        
        if (unpaid.count > 0) {
          return error(`ยังมีออเดอร์ที่ยังไม่ได้ชำระ ${unpaid.count} รายการ`, 400);
        }
        
        await env.DB.prepare('UPDATE tables SET status = "available" WHERE id = ?')
          .bind(id).run();
        return json({ success: true, message: 'ปิดโต๊ะสำเร็จ' });
      }

      if (path.match(/^\/api\/tables\/\d+\/status$/) && method === 'GET') {
        const id = path.split('/')[3];
        const table = await env.DB.prepare('SELECT * FROM tables WHERE id = ?').bind(id).first();
        if (!table) return error('ไม่พบโต๊ะนี้', 404);
        return json({
          id: table.id,
          table_number: table.table_number,
          status: table.status,
          capacity: table.capacity,
          can_order: table.status === 'occupied'
        });
      }

      if (path === '/api/tables/merge' && method === 'POST') {
        const body = await request.json();
        const { table_ids, new_table_number, new_capacity } = body;
        
        if (!table_ids || table_ids.length < 2) {
          return error('ต้องเลือกอย่างน้อย 2 โต๊ะเพื่อรวม', 400);
        }
        
        const placeholders = table_ids.map(() => '?').join(',');
        const tables = await env.DB.prepare(
          `SELECT * FROM tables WHERE id IN (${placeholders})`
        ).bind(...table_ids).all();
        
        if (tables.results.length !== table_ids.length) {
          return error('ไม่พบโต๊ะบางโต๊ะในระบบ', 400);
        }
        
        const occupiedTables = tables.results.filter(t => t.status !== 'available');
        if (occupiedTables.length > 0) {
          return error(`ไม่สามารถรวมโต๊ะได้ เพราะโต๊ะ ${occupiedTables.map(t => t.table_number).join(', ')} ยังไม่ว่าง`, 400);
        }
        
        const totalCapacity = new_capacity || tables.results.reduce((sum, t) => sum + t.capacity, 0);
        const newTableNum = new_table_number || `M${Date.now().toString().slice(-4)}`;
        
        const result = await env.DB.prepare(
          'INSERT INTO tables (table_number, capacity, status, zone) VALUES (?, ?, "available", ?)'
        ).bind(newTableNum, totalCapacity, tables.results[0].zone).run();
        
        for (const id of table_ids) {
          await env.DB.prepare('UPDATE tables SET status = "merged" WHERE id = ?').bind(id).run();
        }
        
        return json({
          success: true,
          new_table_id: result.meta.last_row_id,
          new_table_number: newTableNum,
          merged_tables: tables.results.map(t => t.table_number),
          total_capacity: totalCapacity,
          message: `รวมโต๊ะ ${tables.results.map(t => t.table_number).join(' + ')} เป็นโต๊ะ ${newTableNum} (${totalCapacity} ที่นั่ง) สำเร็จ`
        });
      }

      // ==================== CATEGORIES ====================
      if (path === '/api/categories' && method === 'GET') {
        const results = await env.DB.prepare('SELECT * FROM categories ORDER BY display_order').all();
        return json(results.results);
      }

      // ==================== MENU ====================
      if (path === '/api/menu' && method === 'GET') {
        const results = await env.DB.prepare(`
          SELECT m.*, c.name as category_name 
          FROM menu_items m 
          LEFT JOIN categories c ON m.category_id = c.id 
          ORDER BY c.display_order, m.name
        `).all();
        return json(results.results);
      }

      if (path === '/api/menu' && method === 'POST') {
        const body = await request.json();
        const result = await env.DB.prepare(
          'INSERT INTO menu_items (name, description, price, category_id, image) VALUES (?, ?, ?, ?, ?)'
        ).bind(body.name, body.description, body.price, body.category_id, body.image).run();
        return json({ success: true, id: result.meta.last_row_id });
      }

      if (path.match(/^\/api\/menu\/\d+$/) && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        await env.DB.prepare(
          'UPDATE menu_items SET name = ?, description = ?, price = ?, category_id = ?, is_available = ?, is_popular = ? WHERE id = ?'
        ).bind(body.name, body.description, body.price, body.category_id, body.is_available, body.is_popular, id).run();
        return json({ success: true });
      }

      if (path.match(/^\/api\/menu\/\d+$/) && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // ==================== ORDERS ====================
      if (path === '/api/orders' && method === 'GET') {
        const results = await env.DB.prepare(`
          SELECT o.*, t.table_number 
          FROM orders o 
          LEFT JOIN tables t ON o.table_id = t.id 
          ORDER BY o.created_at DESC
        `).all();
        return json(results.results);
      }

      if (path === '/api/orders/active' && method === 'GET') {
        const results = await env.DB.prepare(`
          SELECT o.*, t.table_number 
          FROM orders o 
          LEFT JOIN tables t ON o.table_id = t.id 
          WHERE o.status IN ('pending', 'preparing', 'serving')
          ORDER BY o.created_at ASC
        `).all();
        return json(results.results);
      }

      if (path === '/api/orders' && method === 'POST') {
        const body = await request.json();
        const { table_id, order_number, items, created_by } = body;
        
        const table = await env.DB.prepare('SELECT status FROM tables WHERE id = ?').bind(table_id).first();
        if (!table) return error('ไม่พบโต๊ะนี้', 404);
        if (table.status !== 'occupied') {
          return error('โต๊ะนี้ยังไม่ได้เปิดใช้งาน หรือปิดโต๊ะแล้ว', 403);
        }
        
        const result = await env.DB.prepare(
          'INSERT INTO orders (table_id, order_number, created_by) VALUES (?, ?, ?)'
        ).bind(table_id, order_number, created_by).run();
        
        const orderId = result.meta.last_row_id;
        
        for (const item of items) {
          await env.DB.prepare(
            'INSERT INTO order_items (order_id, menu_item_id, quantity, special_note) VALUES (?, ?, ?, ?)'
          ).bind(orderId, item.menu_item_id, item.quantity, item.special_note || null).run();
        }
        
        return json({ success: true, order_id: orderId });
      }

      if (path.match(/^\/api\/orders\/\d+\/status$/) && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        const completedAt = body.status === 'completed' ? new Date().toISOString() : null;
        await env.DB.prepare('UPDATE orders SET status = ?, completed_at = ? WHERE id = ?')
          .bind(body.status, completedAt, id).run();
        return json({ success: true });
      }

      if (path.match(/^\/api\/orders\/\d+\/items$/) && method === 'GET') {
        const id = path.split('/')[3];
        const results = await env.DB.prepare(`
          SELECT oi.*, m.name, m.price 
          FROM order_items oi 
          JOIN menu_items m ON oi.menu_item_id = m.id 
          WHERE oi.order_id = ?
        `).bind(id).all();
        return json(results.results);
      }

      if (path.match(/^\/api\/orders\/\d+\/receipt$/) && method === 'GET') {
        const id = path.split('/')[3];
        const order = await env.DB.prepare(`
          SELECT o.*, t.table_number 
          FROM orders o 
          LEFT JOIN tables t ON o.table_id = t.id 
          WHERE o.id = ?
        `).bind(id).first();
        
        if (!order) return error('ไม่พบออเดอร์', 404);
        
        const items = await env.DB.prepare(`
          SELECT oi.*, m.name, m.price 
          FROM order_items oi 
          JOIN menu_items m ON oi.menu_item_id = m.id 
          WHERE oi.order_id = ?
        `).bind(id).all();
        
        const payments = await env.DB.prepare('SELECT * FROM payments WHERE order_id = ?').bind(id).all();
        
        return json({ order, items: items.results, payments: payments.results });
      }

      if (path.match(/^\/api\/orders\/items\/\d+\/status$/) && method === 'PUT') {
        const id = path.split('/')[4];
        const body = await request.json();
        await env.DB.prepare('UPDATE order_items SET status = ? WHERE id = ?')
          .bind(body.status, id).run();
        return json({ success: true });
      }

      // ==================== PAYMENTS ====================
      if (path === '/api/payments' && method === 'POST') {
        const body = await request.json();
        const { order_id, amount, payment_method } = body;
        
        const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(order_id).first();
        if (!order) return error('ไม่พบออเดอร์', 404);
        if (order.status === 'paid') return error('ออเดอร์นี้ชำระเงินแล้ว', 400);
        
        const items = await env.DB.prepare(`
          SELECT oi.quantity, m.price 
          FROM order_items oi 
          JOIN menu_items m ON oi.menu_item_id = m.id 
          WHERE oi.order_id = ?
        `).bind(order_id).all();
        
        const calculatedTotal = items.results.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        if (Math.abs(amount - calculatedTotal) > 0.01) {
          return error('จำนวนเงินไม่ตรงกับยอดออเดอร์', 400);
        }
        
        await env.DB.prepare('UPDATE orders SET total_amount = ?, status = "paid" WHERE id = ?')
          .bind(calculatedTotal, order_id).run();
        
        const result = await env.DB.prepare(
          'INSERT INTO payments (order_id, amount, payment_method) VALUES (?, ?, ?)'
        ).bind(order_id, amount, payment_method).run();
        
        return json({ success: true, payment_id: result.meta.last_row_id, total: calculatedTotal });
      }

      // ==================== STAFF ====================
      if (path === '/api/staff' && method === 'GET') {
        const results = await env.DB.prepare('SELECT * FROM staff ORDER BY name').all();
        return json(results.results);
      }

      if (path === '/api/staff' && method === 'POST') {
        const body = await request.json();
        const result = await env.DB.prepare(
          'INSERT INTO staff (name, role, phone, email) VALUES (?, ?, ?, ?)'
        ).bind(body.name, body.role, body.phone, body.email).run();
        return json({ success: true, id: result.meta.last_row_id });
      }

      // ==================== INVENTORY ====================
      if (path === '/api/inventory' && method === 'GET') {
        const results = await env.DB.prepare('SELECT * FROM inventory ORDER BY name').all();
        return json(results.results);
      }

      if (path.match(/^\/api\/inventory\/\d+$/) && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        await env.DB.prepare(
          'UPDATE inventory SET quantity = ?, min_quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(body.quantity, body.min_quantity, id).run();
        return json({ success: true });
      }

      // ==================== RESERVATIONS ====================
      if (path === '/api/reservations' && method === 'GET') {
        const results = await env.DB.prepare(`
          SELECT r.*, t.table_number 
          FROM reservations r 
          LEFT JOIN tables t ON r.table_id = t.id 
          ORDER BY r.reservation_date, r.reservation_time
        `).all();
        return json(results.results);
      }

      if (path === '/api/reservations' && method === 'POST') {
        const body = await request.json();
        const result = await env.DB.prepare(
          'INSERT INTO reservations (customer_name, customer_phone, table_id, reservation_date, reservation_time, guests, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(body.customer_name, body.customer_phone, body.table_id, body.reservation_date, body.reservation_time, body.guests, body.notes).run();
        return json({ success: true, id: result.meta.last_row_id });
      }

      // ==================== REPORTS ====================
      if (path === '/api/reports/sales' && method === 'GET') {
        const start_date = url.searchParams.get('start_date');
        const end_date = url.searchParams.get('end_date');
        const results = await env.DB.prepare(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as order_count,
            SUM(total_amount) as total_sales
          FROM orders 
          WHERE status = 'paid' 
            AND created_at BETWEEN ? AND ?
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `).bind(start_date, end_date).all();
        return json(results.results);
      }

      if (path === '/api/reports/popular' && method === 'GET') {
        const start_date = url.searchParams.get('start_date');
        const end_date = url.searchParams.get('end_date');
        const results = await env.DB.prepare(`
          SELECT m.name, SUM(oi.quantity) as total_sold, SUM(oi.quantity * m.price) as total_revenue
          FROM order_items oi
          JOIN menu_items m ON oi.menu_item_id = m.id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status = 'paid' AND o.created_at BETWEEN ? AND ?
          GROUP BY m.id
          ORDER BY total_sold DESC
          LIMIT 10
        `).bind(start_date, end_date).all();
        return json(results.results);
      }

      // ==================== DASHBOARD ====================
      if (path === '/api/dashboard' && method === 'GET') {
        const available = await env.DB.prepare("SELECT COUNT(*) as count FROM tables WHERE status = 'available'").first();
        const occupied = await env.DB.prepare("SELECT COUNT(*) as count FROM tables WHERE status = 'occupied'").first();
        const activeOrders = await env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'preparing', 'serving')").first();
        const todaySales = await env.DB.prepare("SELECT SUM(total_amount) as total FROM orders WHERE DATE(created_at) = DATE('now') AND status = 'paid'").first();
        const todayOrders = await env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = DATE('now') AND status = 'paid'").first();
        const lowStock = await env.DB.prepare("SELECT COUNT(*) as count FROM inventory WHERE quantity <= min_quantity").first();
        
        return json({
          available_tables: available.count,
          occupied_tables: occupied.count,
          active_orders: activeOrders.count,
          today_sales: todaySales.total || 0,
          today_orders: todayOrders.count,
          low_stock: lowStock.count
        });
      }

      // 404 Not Found
      return error('Not Found', 404);

    } catch (err) {
      console.error(err);
      return error(err.message || 'Internal Server Error', 500);
    }
  },
};
