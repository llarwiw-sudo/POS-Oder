// ===== Restaurant POS System - Main JavaScript =====

const API_URL = 'http://localhost:3000/api';

// ===== Global State =====
let currentOrder = [];
let selectedTable = null;
let allTables = [];
let allMenuItems = [];
let allCategories = [];
let mergeSelectedTables = []; // สำหรับรวมโต๊ะ

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initClock();
  loadDashboard();
  loadTables();
  loadMenu();
  loadCategories();
  loadStaff();
  loadInventory();
  loadReservations();
  loadKitchenOrders();
  loadPaymentOrders();
  setDefaultDates();
});

// ===== Navigation =====
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  
  // Update title
  const titles = {
    'dashboard': 'Dashboard',
    'tables': 'จัดการโต๊ะ',
    'orders': 'รับออเดอร์',
    'menu': 'จัดการเมนู',
    'kitchen': 'หน้าจอครัว',
    'payments': 'ชำระเงิน',
    'reservations': 'จองโต๊ะ',
    'staff': 'พนักงาน',
    'inventory': 'สต็อก',
    'reports': 'รายงาน'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  
  // Refresh data
  if (page === 'dashboard') loadDashboard();
  if (page === 'tables') loadTables();
  if (page === 'orders') loadOrderTables();
  if (page === 'kitchen') loadKitchenOrders();
  if (page === 'payments') loadPaymentOrders();
  if (page === 'reservations') loadReservations();
  if (page === 'staff') loadStaff();
  if (page === 'inventory') loadInventory();
  if (page === 'reports') loadReports();
}

// ===== Clock =====
function initClock() {
  function updateClock() {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString('th-TH');
    document.getElementById('current-date').textContent = now.toLocaleDateString('th-TH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// ===== Default Dates =====
function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const resDate = document.getElementById('res-date');
  if (resDate) resDate.value = today;
  
  const reportStart = document.getElementById('report-start');
  const reportEnd = document.getElementById('report-end');
  if (reportStart) reportStart.value = today;
  if (reportEnd) reportEnd.value = today;
}

// ===== API Helper =====
async function api(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    return null;
  }
}

// ===== Dashboard =====
async function loadDashboard() {
  const stats = await api('/dashboard');
  if (!stats) return;
  
  document.getElementById('stat-available').textContent = stats.available_tables || 0;
  document.getElementById('stat-occupied').textContent = stats.occupied_tables || 0;
  document.getElementById('stat-active-orders').textContent = stats.active_orders || 0;
  document.getElementById('stat-today-sales').textContent = `฿${(stats.today_sales || 0).toLocaleString()}`;
  document.getElementById('stat-today-orders').textContent = stats.today_orders || 0;
  document.getElementById('stat-low-stock').textContent = stats.low_stock || 0;
  
  // Recent orders
  const orders = await api('/orders');
  const tbody = document.getElementById('recent-orders');
  if (orders && tbody) {
    tbody.innerHTML = orders.slice(0, 5).map(o => `
      <tr>
        <td>${o.order_number}</td>
        <td>${o.table_number || '-'}</td>
        <td><span class="badge badge-${o.status}">${getStatusText(o.status)}</span></td>
        <td>฿${(o.total_amount || 0).toLocaleString()}</td>
      </tr>
    `).join('');
  }
  
  // Popular menu
  const today = new Date().toISOString().split('T')[0];
  const popular = await api(`/reports/popular?start_date=${today}&end_date=${today}`);
  const popTbody = document.getElementById('popular-menu');
  if (popular && popTbody) {
    popTbody.innerHTML = popular.slice(0, 5).map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.total_sold}</td>
        <td>฿${(p.total_revenue || 0).toLocaleString()}</td>
      </tr>
    `).join('');
  }
}

function getStatusText(status) {
  const statusMap = {
    'pending': 'รอทำ',
    'preparing': 'กำลังทำ',
    'serving': 'กำลังเสิร์ฟ',
    'completed': 'เสร็จแล้ว',
    'paid': 'ชำระแล้ว',
    'merged': 'รวมแล้ว'
  };
  return statusMap[status] || status;
}

// ===== Tables =====
async function loadTables() {
  allTables = await api('/tables');
  renderTables(allTables);
}

function renderTables(tables) {
  const grid = document.getElementById('tables-grid');
  if (!grid) return;
  
  // กรองโต๊ะที่รวมแล้ว (merged) ออกจากการแสดงผลปกติ
  const visibleTables = tables.filter(t => t.status !== 'merged');
  
  grid.innerHTML = visibleTables.map(t => `
    <div class="table-card ${t.status}" onclick="toggleTableStatus(${t.id}, '${t.status}')">
      <div class="table-number">${t.table_number}</div>
      <div class="table-capacity">${t.capacity} ที่นั่ง</div>
      <div class="table-status">${getStatusText(t.status)}</div>
    </div>
  `).join('');
}

async function toggleTableStatus(id, currentStatus) {
  if (currentStatus === 'available') {
    // Check-in: เปิดโต๊ะ
    const guests = prompt('จำนวนลูกค้า:', '2');
    if (guests === null) return;
    await api(`/tables/${id}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ guests: parseInt(guests) || 1 })
    });
  } else if (currentStatus === 'occupied') {
    // Check-out: ปิดโต๊ะ - API จะตรวจสอบว่ามีออเดอร์ที่ยังไม่ได้ชำระหรือไม่
    if (!confirm('ต้องการปิดโต๊ะนี้?\n(ต้องชำระเงินทุกออเดอร์เสร็จแล้ว)')) return;
    const result = await api(`/tables/${id}/checkout`, {
      method: 'POST'
    });
    if (result && result.error) {
      alert(`⚠️ ไม่สามารถปิดโต๊ะได้\n${result.error}\n\nกรุณาตรวจสอบว่าทุกออเดอร์ชำระเงินแล้ว`);
      return;
    }
  }
  loadTables();
}

// Zone filter
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('zone-btn')) {
    document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    const zone = e.target.dataset.zone;
    const filtered = zone === 'all' ? allTables : allTables.filter(t => t.zone === zone);
    renderTables(filtered);
  }
});

// ===== Merge Tables Feature =====
// เปิด Modal รวมโต๊ะ
document.getElementById('merge-tables-btn')?.addEventListener('click', openMergeModal);

function openMergeModal() {
  mergeSelectedTables = [];
  const modal = document.getElementById('merge-modal');
  const selectContainer = document.getElementById('merge-tables-select');
  
  // แสดงเฉพาะโต๊ะที่ว่าง (available) เท่านั้น
  const availableTables = allTables.filter(t => t.status === 'available');
  
  selectContainer.innerHTML = availableTables.map(t => `
    <div class="merge-table-card" data-id="${t.id}" onclick="toggleMergeTable(${t.id}, '${t.table_number}', ${t.capacity})">
      <div class="table-num">${t.table_number}</div>
      <div class="table-cap">${t.capacity} ที่นั่ง</div>
    </div>
  `).join('');
  
  // Reset form
  document.getElementById('merge-table-name').value = '';
  document.getElementById('merge-summary').style.display = 'none';
  document.getElementById('confirm-merge').disabled = true;
  
  modal.classList.add('active');
}

// เลือก/ยกเลิกเลือกโต๊ะเพื่อรวม
function toggleMergeTable(id, tableNumber, capacity) {
  const card = document.querySelector(`.merge-table-card[data-id="${id}"]`);
  const index = mergeSelectedTables.findIndex(t => t.id === id);
  
  if (index > -1) {
    // ยกเลิกเลือก
    mergeSelectedTables.splice(index, 1);
    card.classList.remove('selected');
  } else {
    // เลือก
    mergeSelectedTables.push({ id, table_number: tableNumber, capacity });
    card.classList.add('selected');
  }
  
  updateMergeSummary();
}

// อัพเดตสรุปการรวมโต๊ะ
function updateMergeSummary() {
  const summary = document.getElementById('merge-summary');
  const tablesSpan = document.getElementById('merge-selected-tables');
  const capacitySpan = document.getElementById('merge-total-capacity');
  const confirmBtn = document.getElementById('confirm-merge');
  
  if (mergeSelectedTables.length >= 2) {
    summary.style.display = 'block';
    tablesSpan.textContent = mergeSelectedTables.map(t => t.table_number).join(' + ');
    const totalCapacity = mergeSelectedTables.reduce((sum, t) => sum + t.capacity, 0);
    capacitySpan.textContent = `${totalCapacity} ที่นั่ง`;
    confirmBtn.disabled = false;
  } else {
    summary.style.display = 'none';
    confirmBtn.disabled = true;
  }
}

// ปิด Modal รวมโต๊ะ
document.getElementById('close-merge-modal')?.addEventListener('click', () => {
  document.getElementById('merge-modal').classList.remove('active');
  mergeSelectedTables = [];
});

// ยืนยันการรวมโต๊ะ
document.getElementById('confirm-merge')?.addEventListener('click', async () => {
  if (mergeSelectedTables.length < 2) {
    alert('กรุณาเลือกอย่างน้อย 2 โต๊ะ');
    return;
  }
  
  const newTableName = document.getElementById('merge-table-name').value.trim();
  const totalCapacity = mergeSelectedTables.reduce((sum, t) => sum + t.capacity, 0);
  
  const result = await api('/tables/merge', {
    method: 'POST',
    body: JSON.stringify({
      table_ids: mergeSelectedTables.map(t => t.id),
      new_table_number: newTableName || undefined,
      new_capacity: totalCapacity
    })
  });
  
  if (result && result.success) {
    alert(`✅ ${result.message}`);
    document.getElementById('merge-modal').classList.remove('active');
    mergeSelectedTables = [];
    loadTables();
  } else if (result && result.error) {
    alert(`❌ ${result.error}`);
  }
});

// ===== Order Tables =====
async function loadOrderTables() {
  const tables = await api('/tables');
  const grid = document.getElementById('order-table-select');
  if (!grid) return;
  
  grid.innerHTML = tables.map(t => `
    <div class="table-select-card ${t.status === 'occupied' ? 'occupied' : ''}" 
         onclick="${t.status !== 'occupied' ? `selectTableForOrder(${t.id}, '${t.table_number}')` : ''}">
      <div class="table-number">${t.table_number}</div>
      <div class="table-capacity">${t.capacity} ที่นั่ง</div>
      <div class="table-status">${t.status === 'occupied' ? 'มีลูกค้า' : 'ว่าง'}</div>
    </div>
  `).join('');
}

function selectTableForOrder(id, tableNumber) {
  selectedTable = { id, tableNumber };
  document.getElementById('selected-table').textContent = tableNumber;
  document.getElementById('order-form').style.display = 'block';
  currentOrder = [];
  renderOrderItems();
  loadOrderMenu();
}

async function loadOrderMenu() {
  allMenuItems = await api('/menu');
  allCategories = await api('/categories');
  renderOrderCategories();
  renderOrderMenuItems();
}

function renderOrderCategories() {
  const container = document.getElementById('order-categories');
  if (!container) return;
  
  container.innerHTML = `
    <button class="category-btn active" data-category="all">ทั้งหมด</button>
    ${allCategories.map(c => `
      <button class="category-btn" data-category="${c.id}">${c.name}</button>
    `).join('')}
  `;
  
  container.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOrderMenuItems(btn.dataset.category);
    });
  });
}

function renderOrderMenuItems(categoryId = 'all') {
  const container = document.getElementById('order-menu-items');
  if (!container) return;
  
  const filtered = categoryId === 'all' ? allMenuItems : allMenuItems.filter(m => m.category_id == categoryId);
  
  container.innerHTML = filtered.filter(m => m.is_available).map(m => `
    <div class="menu-item-card" onclick="addToOrder(${m.id}, '${m.name}', ${m.price})">
      <div class="item-name">${m.name}</div>
      <div class="item-price">฿${m.price}</div>
    </div>
  `).join('');
}

function addToOrder(id, name, price) {
  const existing = currentOrder.find(item => item.menu_item_id === id);
  if (existing) {
    existing.quantity++;
  } else {
    currentOrder.push({ menu_item_id: id, name, price, quantity: 1, special_note: '' });
  }
  renderOrderItems();
}

function renderOrderItems() {
  const container = document.getElementById('order-items-list');
  if (!container) return;
  
  if (currentOrder.length === 0) {
    container.innerHTML = '<p style="color: var(--secondary); text-align: center;">ยังไม่มีรายการ</p>';
    document.getElementById('order-total').textContent = '0';
    return;
  }
  
  container.innerHTML = currentOrder.map((item, index) => `
    <div class="order-item-row">
      <div>
        <div>${item.name}</div>
        <small>฿${item.price} x ${item.quantity}</small>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty(${index}, -1)">-</button>
        <span>${item.quantity}</span>
        <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
      </div>
      <div>฿${(item.price * item.quantity).toLocaleString()}</div>
    </div>
  `).join('');
  
  const total = currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('order-total').textContent = total.toLocaleString();
}

function changeQty(index, delta) {
  currentOrder[index].quantity += delta;
  if (currentOrder[index].quantity <= 0) {
    currentOrder.splice(index, 1);
  }
  renderOrderItems();
}

// Submit Order
document.getElementById('submit-order')?.addEventListener('click', async () => {
  if (!selectedTable || currentOrder.length === 0) {
    alert('กรุณาเลือกโต๊ะและเพิ่มรายการอาหาร');
    return;
  }
  
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
  const result = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      table_id: selectedTable.id,
      order_number: orderNumber,
      items: currentOrder.map(item => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        special_note: item.special_note
      })),
      created_by: 1
    })
  });
  
  if (result && result.success) {
    alert(`สร้างออเดอร์ ${orderNumber} สำเร็จ!`);
    currentOrder = [];
    selectedTable = null;
    document.getElementById('order-form').style.display = 'none';
    loadOrderTables();
  }
});

// ===== Menu Management =====
async function loadMenu() {
  allMenuItems = await api('/menu');
  renderMenuList();
}

function renderMenuList() {
  const tbody = document.getElementById('menu-list');
  if (!tbody) return;
  
  tbody.innerHTML = allMenuItems.map(m => `
    <tr>
      <td>${m.name}</td>
      <td>${m.category_name || '-'}</td>
      <td>฿${m.price}</td>
      <td><span class="badge ${m.is_available ? 'badge-available' : 'badge-unavailable'}">${m.is_available ? 'เปิดขาย' : 'ปิดขาย'}</span></td>
      <td>${m.is_popular ? '⭐' : '-'}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editMenu(${m.id})">แก้ไข</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMenu(${m.id})">ลบ</button>
      </td>
    </tr>
  `).join('');
}

async function loadCategories() {
  allCategories = await api('/categories');
  const select = document.getElementById('menu-category');
  const filter = document.getElementById('menu-category-filter');
  
  if (select) {
    select.innerHTML = allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  if (filter) {
    filter.innerHTML = '<option value="">ทั้งหมด</option>' + 
      allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

// Add Menu
document.getElementById('add-menu-btn')?.addEventListener('click', () => {
  document.getElementById('menu-modal-title').textContent = 'เพิ่มเมนูใหม่';
  document.getElementById('menu-name').value = '';
  document.getElementById('menu-desc').value = '';
  document.getElementById('menu-price').value = '';
  document.getElementById('menu-modal').classList.add('active');
});

document.getElementById('close-menu-modal')?.addEventListener('click', () => {
  document.getElementById('menu-modal').classList.remove('active');
});

document.getElementById('save-menu')?.addEventListener('click', async () => {
  const name = document.getElementById('menu-name').value;
  const description = document.getElementById('menu-desc').value;
  const price = parseFloat(document.getElementById('menu-price').value);
  const category_id = parseInt(document.getElementById('menu-category').value);
  
  if (!name || !price) {
    alert('กรุณากรอกชื่อเมนูและราคา');
    return;
  }
  
  const result = await api('/menu', {
    method: 'POST',
    body: JSON.stringify({ name, description, price, category_id })
  });
  
  if (result && result.success) {
    alert('เพิ่มเมนูสำเร็จ!');
    document.getElementById('menu-modal').classList.remove('active');
    loadMenu();
  }
});

async function editMenu(id) {
  const item = allMenuItems.find(m => m.id === id);
  if (!item) return;
  
  document.getElementById('menu-modal-title').textContent = 'แก้ไขเมนู';
  document.getElementById('menu-name').value = item.name;
  document.getElementById('menu-desc').value = item.description || '';
  document.getElementById('menu-price').value = item.price;
  document.getElementById('menu-category').value = item.category_id;
  document.getElementById('menu-modal').classList.add('active');
  
  document.getElementById('save-menu').onclick = async () => {
    await api(`/menu/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: document.getElementById('menu-name').value,
        description: document.getElementById('menu-desc').value,
        price: parseFloat(document.getElementById('menu-price').value),
        category_id: parseInt(document.getElementById('menu-category').value),
        is_available: item.is_available,
        is_popular: item.is_popular
      })
    });
    document.getElementById('menu-modal').classList.remove('active');
    loadMenu();
  };
}

async function deleteMenu(id) {
  if (!confirm('ต้องการลบเมนูนี้?')) return;
  await api(`/menu/${id}`, { method: 'DELETE' });
  loadMenu();
}

// ===== Kitchen Display =====
async function loadKitchenOrders() {
  const orders = await api('/orders/active');
  const grid = document.getElementById('kitchen-orders');
  if (!grid) return;
  
  if (!orders || orders.length === 0) {
    grid.innerHTML = '<p style="text-align:center; color: var(--secondary);">ไม่มีออเดอร์ที่ต้องทำ</p>';
    return;
  }
  
  // Load items for each order
  const ordersWithItems = await Promise.all(orders.map(async (order) => {
    const items = await api(`/orders/${order.id}/items`);
    return { ...order, items: items || [] };
  }));
  
  grid.innerHTML = ordersWithItems.map(order => `
    <div class="kitchen-card ${order.status}">
      <div class="kitchen-card-header">
        <h4>ออเดอร์ #${order.order_number}</h4>
        <span>โต๊ะ ${order.table_number}</span>
      </div>
      <div class="kitchen-card-body">
        ${order.items.map(item => `
          <div class="kitchen-item">
            <span>${item.name} x${item.quantity}</span>
            <span class="badge badge-${item.status}">${getStatusText(item.status)}</span>
          </div>
        `).join('')}
      </div>
      <div class="kitchen-card-footer">
        ${order.status === 'pending' ? `
          <button class="btn btn-info" onclick="updateOrderStatus(${order.id}, 'preparing')">เริ่มทำ</button>
        ` : ''}
        ${order.status === 'preparing' ? `
          <button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'serving')">เสร็จแล้ว</button>
        ` : ''}
        ${order.status === 'serving' ? `
          <button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'completed')">เสร็จสิ้น</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

document.getElementById('refresh-kitchen')?.addEventListener('click', loadKitchenOrders);

async function updateOrderStatus(id, status) {
  await api(`/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  loadKitchenOrders();
}

// ===== Payments =====
async function loadPaymentOrders() {
  const orders = await api('/orders');
  const container = document.getElementById('payment-orders-list');
  if (!container) return;
  
  const unpaidOrders = orders.filter(o => o.status !== 'paid');
  
  container.innerHTML = unpaidOrders.map(o => `
    <div class="payment-order-card" onclick="selectPaymentOrder(${o.id}, '${o.order_number}')">
      <h4>ออเดอร์ #${o.order_number}</h4>
      <p>โต๊ะ ${o.table_number || '-'}</p>
      <p>สถานะ: ${getStatusText(o.status)}</p>
    </div>
  `).join('');
}

async function selectPaymentOrder(id, orderNumber) {
  const items = await api(`/orders/${id}/items`);
  const order = (await api('/orders')).find(o => o.id === id);
  
  document.getElementById('payment-order-id').textContent = orderNumber;
  document.getElementById('payment-form').style.display = 'block';
  
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('payment-total').textContent = total.toLocaleString();
  
  document.getElementById('payment-items').innerHTML = items.map(item => `
    <div class="order-item-row">
      <span>${item.name} x${item.quantity}</span>
      <span>฿${(item.price * item.quantity).toLocaleString()}</span>
    </div>
  `).join('');
  
  // Setup payment buttons
  document.querySelectorAll('.payment-methods .btn').forEach(btn => {
    btn.onclick = async () => {
      const method = btn.dataset.method;
      const result = await api('/payments', {
        method: 'POST',
        body: JSON.stringify({
          order_id: id,
          amount: total,
          payment_method: method
        })
      });
      
      if (result && result.success) {
        alert('ชำระเงินสำเร็จ!');
        document.getElementById('payment-form').style.display = 'none';
        loadPaymentOrders();
        loadDashboard();
        // Open receipt page
        window.open(`receipt.html?order=${id}`, '_blank');
      }
    };
  });
}

// ===== Reservations =====
async function loadReservations() {
  const reservations = await api('/reservations');
  const tbody = document.getElementById('reservations-list');
  if (!tbody) return;
  
  tbody.innerHTML = reservations.map(r => `
    <tr>
      <td>${r.customer_name}</td>
      <td>${r.customer_phone || '-'}</td>
      <td>${r.reservation_date}</td>
      <td>${r.reservation_time}</td>
      <td>${r.table_number || '-'}</td>
      <td>${r.guests}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span></td>
    </tr>
  `).join('');
  
  // Load tables for select
  const tables = await api('/tables');
  const select = document.getElementById('res-table');
  if (select) {
    select.innerHTML = tables.map(t => `<option value="${t.id}">${t.table_number} (${t.capacity} ที่นั่ง)</option>`).join('');
  }
}

document.getElementById('submit-reservation')?.addEventListener('click', async () => {
  const data = {
    customer_name: document.getElementById('res-name').value,
    customer_phone: document.getElementById('res-phone').value,
    table_id: parseInt(document.getElementById('res-table').value),
    reservation_date: document.getElementById('res-date').value,
    reservation_time: document.getElementById('res-time').value,
    guests: parseInt(document.getElementById('res-guests').value),
    notes: document.getElementById('res-notes').value
  };
  
  if (!data.customer_name || !data.reservation_date || !data.reservation_time) {
    alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }
  
  const result = await api('/reservations', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result && result.success) {
    alert('บันทึกการจองสำเร็จ!');
    document.getElementById('res-name').value = '';
    document.getElementById('res-phone').value = '';
    document.getElementById('res-notes').value = '';
    loadReservations();
  }
});

// ===== Staff =====
async function loadStaff() {
  const staff = await api('/staff');
  const tbody = document.getElementById('staff-list');
  if (!tbody) return;
  
  const roleNames = { manager: 'ผู้จัดการ', cashier: 'แคชเชียร์', waiter: 'เด็กเสิร์ฟ', chef: 'เชฟ' };
  
  tbody.innerHTML = staff.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${roleNames[s.role] || s.role}</td>
      <td>${s.phone || '-'}</td>
      <td>${s.email || '-'}</td>
      <td><span class="badge ${s.is_active ? 'badge-available' : 'badge-unavailable'}">${s.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}</span></td>
    </tr>
  `).join('');
}

document.getElementById('add-staff-btn')?.addEventListener('click', () => {
  document.getElementById('staff-form-container').style.display = 'block';
});

document.getElementById('cancel-staff')?.addEventListener('click', () => {
  document.getElementById('staff-form-container').style.display = 'none';
});

document.getElementById('submit-staff')?.addEventListener('click', async () => {
  const data = {
    name: document.getElementById('staff-name').value,
    role: document.getElementById('staff-role').value,
    phone: document.getElementById('staff-phone').value,
    email: document.getElementById('staff-email').value
  };
  
  if (!data.name) {
    alert('กรุณากรอกชื่อพนักงาน');
    return;
  }
  
  const result = await api('/staff', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result && result.success) {
    alert('เพิ่มพนักงานสำเร็จ!');
    document.getElementById('staff-form-container').style.display = 'none';
    document.getElementById('staff-name').value = '';
    document.getElementById('staff-phone').value = '';
    document.getElementById('staff-email').value = '';
    loadStaff();
  }
});

// ===== Inventory =====
async function loadInventory() {
  const inventory = await api('/inventory');
  const tbody = document.getElementById('inventory-list');
  const alerts = document.getElementById('inventory-alerts');
  if (!tbody) return;
  
  const lowStock = inventory.filter(i => i.quantity <= i.min_quantity);
  
  if (alerts) {
    alerts.innerHTML = lowStock.length > 0 ? lowStock.map(i => `
      <div class="alert-item">
        <span class="alert-icon">⚠️</span>
        <span>${i.name} เหลือ ${i.quantity} ${i.unit} (ต่ำกว่าขั้นต่ำ ${i.min_quantity})</span>
      </div>
    `).join('') : '';
  }
  
  tbody.innerHTML = inventory.map(i => `
    <tr>
      <td>${i.name}</td>
      <td>${i.unit}</td>
      <td style="color: ${i.quantity <= i.min_quantity ? 'var(--danger)' : 'inherit'}; font-weight: ${i.quantity <= i.min_quantity ? 'bold' : 'normal'}">${i.quantity}</td>
      <td>${i.min_quantity}</td>
      <td>฿${i.cost_per_unit}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editInventory(${i.id}, '${i.name}', ${i.quantity}, ${i.min_quantity})">แก้ไข</button>
      </td>
    </tr>
  `).join('');
}

function editInventory(id, name, quantity, minQuantity) {
  document.getElementById('inv-id').value = id;
  document.getElementById('inv-name').value = name;
  document.getElementById('inv-quantity').value = quantity;
  document.getElementById('inv-min').value = minQuantity;
  document.getElementById('inventory-modal').classList.add('active');
}

document.getElementById('close-inventory-modal')?.addEventListener('click', () => {
  document.getElementById('inventory-modal').classList.remove('active');
});

document.getElementById('save-inventory')?.addEventListener('click', async () => {
  const id = document.getElementById('inv-id').value;
  const data = {
    quantity: parseFloat(document.getElementById('inv-quantity').value),
    min_quantity: parseFloat(document.getElementById('inv-min').value)
  };
  
  await api(`/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  
  document.getElementById('inventory-modal').classList.remove('active');
  loadInventory();
});

// ===== Reports =====
document.getElementById('generate-report')?.addEventListener('click', loadReports);

async function loadReports() {
  const startDate = document.getElementById('report-start')?.value || new Date().toISOString().split('T')[0];
  const endDate = document.getElementById('report-end')?.value || new Date().toISOString().split('T')[0];
  
  // Sales report
  const sales = await api(`/reports/sales?start_date=${startDate}&end_date=${endDate}`);
  const salesTbody = document.getElementById('sales-report');
  if (salesTbody) {
    salesTbody.innerHTML = sales.map(s => `
      <tr>
        <td>${s.date}</td>
        <td>${s.order_count}</td>
        <td>฿${(s.total_sales || 0).toLocaleString()}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center;">ไม่มีข้อมูล</td></tr>';
  }
  
  // Popular report
  const popular = await api(`/reports/popular?start_date=${startDate}&end_date=${endDate}`);
  const popularTbody = document.getElementById('popular-report');
  if (popularTbody) {
    popularTbody.innerHTML = popular.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.total_sold}</td>
        <td>฿${(p.total_revenue || 0).toLocaleString()}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center;">ไม่มีข้อมูล</td></tr>';
  }
}