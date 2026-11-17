const API = '/menus';
let adminLoggedIn = false;
let allMenus = [];
let activeCategory = 'All';
const grid = document.getElementById('menuGrid');
const searchInput = document.getElementById('searchInput');
const tabs = document.getElementById('categoryTabs');
const toast = document.getElementById('toast');
const menuForm = document.getElementById('menuForm');

function rupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
async function apiRequest(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'same-origin',
    headers: { ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Request failed (${response.status})`);
  return result;
}
function setAdminView(isLoggedIn) {
  adminLoggedIn = isLoggedIn;
  document.getElementById('adminLoginCard').hidden = isLoggedIn;
  document.getElementById('adminDashboard').hidden = !isLoggedIn;
}
async function loadMenus() {
  const result = await apiRequest(API);
  allMenus = result.data;
  renderAdminTable();
  renderReport();
}
function renderAdminTable() {
  const body = document.getElementById('adminTableBody');
  if (!allMenus.length) {
    body.innerHTML = '<tr><td colspan="5">No menu products yet. Add your first product.</td></tr>';
    return;
  }
  body.innerHTML = allMenus.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.category)}</td><td>${rupiah(item.price)}</td><td>${item.stock}</td><td><div class="row-actions"><button type="button" data-edit="${item.id}">Edit</button><button type="button" class="delete-row" data-delete="${item.id}">Delete</button></div></td></tr>`).join('');
}
function renderReport() {
  const count = allMenus.length;
  const totalStock = allMenus.reduce((sum, item) => sum + Number(item.stock), 0);
  const inventoryValue = allMenus.reduce((sum, item) => sum + Number(item.price) * Number(item.stock), 0);
  const lowStock = allMenus.filter(item => Number(item.stock) < 5).length;
  document.getElementById('statProducts').textContent = count;
  document.getElementById('statStock').textContent = totalStock;
  document.getElementById('statValue').textContent = rupiah(inventoryValue);
  document.getElementById('statLow').textContent = lowStock;
  document.getElementById('reportUpdated').textContent = `Generated: ${new Date().toLocaleString('id-ID')}`;
  const categories = ['Coffee', 'Non-Coffee', 'Tea', 'Snacks'];
  document.getElementById('categoryReport').innerHTML = categories.map(category => {
    const items = allMenus.filter(item => item.category.toLowerCase() === category.toLowerCase());
    const quantity = items.reduce((sum, item) => sum + Number(item.stock), 0);
    const percentage = count ? Math.round(items.length / count * 100) : 0;
    return `<div class="category-line"><div class="category-line-top"><strong>${category}</strong><span>${items.length} products · ${quantity} units</span></div><div class="category-track"><div class="category-fill" style="width:${percentage}%"></div></div></div>`;
  }).join('');
  document.getElementById('stockReportBody').innerHTML = allMenus.map(item => {
    const low = Number(item.stock) < 5;
    return `<tr><td>${escapeHtml(item.name)}</td><td>${item.stock}</td><td><span class="status-pill ${low ? 'low' : ''}">${low ? 'Low stock' : 'In stock'}</span></td><td>${rupiah(item.price * item.stock)}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No products available.</td></tr>';
}
function resetForm() {
  menuForm.reset();
  document.getElementById('menuId').value = '';
  document.getElementById('itemImage').value = '/images/cafe-hero.jpg';
  document.getElementById('itemImageFile').value = '';
  document.getElementById('itemImagePreview').src = '/images/cafe-hero.jpg';
  document.getElementById('imageUploadStatus').textContent = 'Choose an image to preview';
  document.getElementById('formTitle').textContent = 'Add a menu item';
  document.getElementById('saveButton').innerHTML = 'Add product <span>＋</span>';
  document.getElementById('cancelEdit').hidden = true;
}
function startEdit(id) {
  const item = allMenus.find(menu => menu.id === Number(id));
  if (!item) return;
  document.getElementById('menuId').value = item.id;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemPrice').value = item.price;
  document.getElementById('itemStock').value = item.stock;
  document.getElementById('itemDescription').value = item.description;
  document.getElementById('itemImage').value = item.image;
  document.getElementById('itemImageFile').value = '';
  document.getElementById('itemImagePreview').src = item.image;
  document.getElementById('imageUploadStatus').textContent = 'Current image — choose a new file to replace it';
  document.getElementById('formTitle').textContent = `Edit: ${item.name}`;
  document.getElementById('saveButton').innerHTML = 'Save changes <span>✓</span>';
  document.getElementById('cancelEdit').hidden = false;
  document.getElementById('management').scrollIntoView({ behavior: 'smooth' });
}
document.getElementById('adminLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;
  try {
    await apiRequest('/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
    setAdminView(true);
    await loadMenus();
    showToast('Welcome to the admin dashboard.');
  } catch (error) {
    document.getElementById('loginError').textContent = error.message;
  }
});
document.getElementById('adminLogout').addEventListener('click', async () => {
  try { await apiRequest('/admin/logout', { method: 'POST' }); } catch (_) {}
  setAdminView(false);
  document.getElementById('adminLoginForm').reset();
  showToast('You have signed out.');
});
document.querySelectorAll('[data-admin-tab]').forEach(button => {
  button.addEventListener('click', () => {
    const target = button.dataset.adminTab;
    document.querySelectorAll('[data-admin-tab]').forEach(tab => tab.classList.toggle('active', tab === button));
    document.querySelectorAll('.dashboard-panel').forEach(panel => panel.classList.toggle('active', panel.id === (target === 'management' ? 'managementPanel' : 'reportsPanel')));
    if (target === 'reports') renderReport();
  });
});
document.getElementById('cancelEdit').addEventListener('click', resetForm);
document.getElementById('refreshButton').addEventListener('click', () => loadMenus().catch(error => showToast(error.message)));
document.getElementById('itemImageFile').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
    showToast('Choose JPG, PNG, WEBP or GIF under 5 MB.');
    event.target.value = '';
    return;
  }
  document.getElementById('itemImagePreview').src = URL.createObjectURL(file);
  document.getElementById('imageUploadStatus').textContent = `Ready to upload: ${file.name}`;
});
async function uploadProductImageIfSelected() {
  const file = document.getElementById('itemImageFile').files[0];
  if (!file) return document.getElementById('itemImage').value || '/images/cafe-hero.jpg';
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${API}/upload-image`, { method: 'POST', credentials: 'same-origin', body: formData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Image upload failed (${response.status})`);
  document.getElementById('itemImage').value = result.image;
  document.getElementById('imageUploadStatus').textContent = `Uploaded: ${file.name}`;
  return result.image;
}
menuForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const id = document.getElementById('menuId').value;
    const imagePath = await uploadProductImageIfSelected();
    const payload = {
      name: document.getElementById('itemName').value.trim(),
      category: document.getElementById('itemCategory').value,
      price: Number(document.getElementById('itemPrice').value),
      stock: Number(document.getElementById('itemStock').value),
      description: document.getElementById('itemDescription').value.trim(),
      image: imagePath
    };
    if (id) {
      await apiRequest(`${API}/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      showToast('Menu item updated successfully.');
    } else {
      await apiRequest(API, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      showToast('New menu item added successfully.');
    }
    resetForm();
    await loadMenus();
  } catch (error) { showToast(error.message); }
});
document.getElementById('adminTableBody').addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');
  if (editButton) startEdit(editButton.dataset.edit);
  if (deleteButton) {
    const item = allMenus.find(menu => menu.id === Number(deleteButton.dataset.delete));
    if (!item || !window.confirm(`Delete "${item.name}" from the menu?`)) return;
    try {
      await apiRequest(`${API}/${item.id}`, { method: 'DELETE' });
      showToast(`${item.name} deleted.`);
      await loadMenus();
    } catch (error) { showToast(error.message); }
  }
});
document.getElementById('exportCsv').addEventListener('click', () => {
  const rows = [['ID','Name','Category','Price_IDR','Stock','Estimated_Stock_Value_IDR']];
  allMenus.forEach(item => rows.push([item.id,item.name,item.category,item.price,item.stock,item.price*item.stock]));
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  const link = document.createElement('a'); link.href = url;
  link.download = `coffee-shop-report-${new Date().toISOString().slice(0,10)}.csv`;
  link.click(); URL.revokeObjectURL(url);
});
document.getElementById('printReport').addEventListener('click', () => window.print());

// On every visit or reload, ask the server whether the session is still valid.
// If not, the user sees only the login form. No dashboard content is rendered.
setAdminView(false);
apiRequest('/admin/session').then(result => {
  if (!result.authenticated) return;
  setAdminView(true);
  return loadMenus();
}).catch(() => setAdminView(false));
