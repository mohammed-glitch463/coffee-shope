const API = '/menus';
let allMenus = [];
let activeCategory = 'All';
const grid = document.getElementById('menuGrid');
const searchInput = document.getElementById('searchInput');
const tabs = document.getElementById('categoryTabs');
const toast = document.getElementById('toast');

function rupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
async function loadMenus() {
  try {
    const response = await fetch(API);
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || 'Could not load menu.');
    allMenus = result.data;
    renderMenus();
  } catch (error) {
    grid.innerHTML = '<div class="empty-state">Menu unavailable. Please make sure the server is running.</div>';
  }
}
function renderMenus() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allMenus.filter(item => {
    const categoryMatch = activeCategory === 'All' || item.category.toLowerCase() === activeCategory.toLowerCase();
    return categoryMatch && (item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
  });
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">No menu items found.</div>';
    return;
  }
  grid.innerHTML = filtered.map(item => `
    <article class="menu-card">
      <div class="product-image"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy"><span class="product-category">${escapeHtml(item.category)}</span></div>
      <div class="product-info"><div class="product-top"><h3>${escapeHtml(item.name)}</h3><span class="price">${rupiah(item.price)}</span></div>
      <p>${escapeHtml(item.description)}</p><div class="product-bottom"><span class="stock ${item.stock < 5 ? 'low' : ''}">${item.stock > 0 ? `${item.stock} available` : 'Sold out'}</span><button class="add-button" data-add="${item.id}" ${item.stock < 1 ? 'disabled' : ''}>Add to order +</button></div></div>
    </article>`).join('');
}
tabs.addEventListener('click', event => {
  const button = event.target.closest('button[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  tabs.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
  renderMenus();
});
searchInput.addEventListener('input', renderMenus);
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const item = allMenus.find(menu => menu.id === Number(button.dataset.add));
  if (item) showToast(`${item.name} added to your order — enjoy!`);
});
loadMenus();
