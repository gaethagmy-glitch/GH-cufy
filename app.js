/* 
   Noor.t.Turkish — Official Javascript Logic
   Handles: State, Supabase Client SDK, Cart, Checkout, WhatsApp, Dark Mode, and Admin Dashboard
*/

// ── SUPABASE INITIALIZATION ──
const SUPA_URL = 'https://kvnivxwjmbtniaculpyh.supabase.co';
const SUPA_KEY = 'sb_publishable_X3-7SbTUjsWNAcmQJvhuxg_shSncfLT';

// Supabase client instance (loaded from CDN)
let supabase;
try {
  supabase = window.supabase.createClient(SUPA_URL, SUPA_KEY);
} catch (e) {
  console.error("Supabase SDK failed to load:", e);
}

// ── CONFIG & STATIC CONFIGS ──
const WA_PHONE = '963981112670';
const DEFAULT_PLACEHOLDER = 'https://placehold.co/400x500/F5EAE7/C9908A?text=نور';

// ── APPLICATION STATE ──
let products = [];
let cart = [];
let curProd = null;
let curImg = 0;
let newProdSizes = [];
let newProdImgs = [];
let selShipCo = 'qadmus';
let currentTheme = localStorage.getItem('theme') || 'light';
let orderSubmitting = false;

// Shopper search & category filter state
let shopperCategoryFilter = 'all';
let shopperSearchQuery = '';

// Admin panel state variables
let adminSession = null;
let currentAdminTab = 'add'; // 'add', 'prods', 'orders', 'ratings'
let ordersList = [];
let ratingsList = [];

// Initialize Page Elements
document.addEventListener('DOMContentLoaded', () => {
  // Theme check
  setTheme(currentTheme);

  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Check auth session
  checkAuthSession();

  // Load products
  showLoading(true);
  loadProducts();

  // Initialize Local Cart
  loadLocalCart();
});

// ── UTILITIES ──
function goto(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function openWa() {
  window.open(`https://wa.me/${WA_PHONE}`, '_blank');
}

function toast(msg, ms = 3200) {
  const el = document.getElementById('toast-el');
  const txt = document.getElementById('toast-txt');
  if (!el || !txt) return;

  txt.textContent = msg;
  el.classList.add('show');
  
  // Re-create icons inside toast if any
  if (window.lucide) {
    window.lucide.createIcons({ attrs: { class: 'toast-icon' } });
  }

  setTimeout(() => el.classList.remove('show'), ms);
}

function pNum(s) {
  if (!s) return 0;
  // Convert Arabic numerals to English
  const normalized = s.toString()
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  return parseInt(normalized.replace(/[^0-9]/g, '')) || 0;
}

function fmt(n) {
  return Number(n).toLocaleString('en-US') + ' ل.س';
}

function lock() {
  document.body.style.overflow = 'hidden';
}

function unlock() {
  document.body.style.overflow = '';
}

function calcDiscounted(orig, pct) {
  return Math.round(orig * (1 - pct / 100));
}

// ── THEME (DARK / LIGHT MODE) ──
function toggleTheme() {
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(nextTheme);
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  const icon = document.querySelector('.theme-toggle-btn i');
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
    if (window.lucide) window.lucide.createIcons();
  }
}

// ── LOCAL STORAGE CART ──
function saveLocalCart() {
  localStorage.setItem('noor_cart', JSON.stringify(cart));
}

function loadLocalCart() {
  const data = localStorage.getItem('noor_cart');
  if (data) {
    try {
      cart = JSON.parse(data);
      updCount();
    } catch (e) {
      cart = [];
    }
  }
}

// ── LOAD PRODUCTS FROM SUPABASE ──
async function loadProducts() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data) {
      products = data.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        origPrice: p.orig_price,
        discount: p.discount || 0,
        desc: p.description || '',
        imgs: p.images || [],
        sizes: p.sizes || [],
        tag: p.tag || '',
        outOfStock: p.out_of_stock || false
      }));
    }
    renderProds();
  } catch (err) {
    console.error("Error loading products:", err);
    toast("❌ فشل في تحميل المنتجات، يرجى المحاولة لاحقاً");
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  const g = document.getElementById('products-grid');
  if (!g) return;
  if (show) {
    g.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 0; color: var(--muted);">
        <i data-lucide="loader" class="animate-spin" style="width: 32px; height: 32px; margin: 0 auto 1rem; stroke-width: 1.5;"></i>
        <p>جاري تحميل تشكيلة الربيع الفاخرة...</p>
      </div>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

// ── RENDER PRODUCTS ──
function renderProds() {
  const g = document.getElementById('products-grid');
  if (!g) return;

  if (!products.length) {
    g.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 5rem 0; color: var(--muted);">
        <i data-lucide="sparkles" style="width: 36px; height: 36px; margin: 0 auto 1.2rem; color: var(--rose);"></i>
        <p style="font-size: 1.1rem;">ترقبي التشكيلة الجديدة قريباً 🌸</p>
      </div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Filter products based on search & category
  let filtered = [...products];
  if (shopperCategoryFilter !== 'all') {
    filtered = filtered.filter(p => p.tag === shopperCategoryFilter);
  }
  if (shopperSearchQuery) {
    const q = shopperSearchQuery.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }

  if (!filtered.length) {
    g.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 5rem 0; color: var(--muted);">
        <i data-lucide="search" style="width: 36px; height: 36px; margin: 0 auto 1.2rem; color: var(--rose);"></i>
        <p style="font-size: 1.1rem;">لم نجد قطعاً تطابق بحثكِ 🌸</p>
      </div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  g.innerHTML = filtered.map(p => {
    const disp = p.discount ? fmt(calcDiscounted(p.origPrice, p.discount)) : p.price;
    const old = p.discount ? `<del>${p.price}</del>` : '';
    const isFavProduct = isFav(p.id);

    return `
    <div class="product-card ${p.outOfStock ? 'prod-card-disabled' : ''}" onclick="${p.outOfStock ? '' : `openProd(${p.id})`}">
      <div class="prod-img-wrap">
        <img src="${p.imgs[0] || DEFAULT_PLACEHOLDER}" alt="${p.name}" loading="lazy" onerror="this.src='${DEFAULT_PLACEHOLDER}'">
        ${p.tag ? `<span class="prod-tag">${p.tag}</span>` : ''}
        ${p.discount ? `<span class="prod-tag" style="top:auto; bottom:1.2rem; background:var(--gold); border-radius:var(--radius-sm)">خصم -${p.discount}%</span>` : ''}
        ${p.outOfStock ? `<div class="out-of-stock-badge"><span>نفذت الكمية</span></div>` : `
        <div class="prod-actions">
          <button class="btn-det" onclick="event.stopPropagation(); openProd(${p.id})">
            <i data-lucide="eye"></i> التفاصيل
          </button>
          <button onclick="event.stopPropagation(); quickAdd(${p.id})">
            <i data-lucide="shopping-bag"></i> أضيفي للسلة
          </button>
        </div>`}
        <button class="fav-btn ${isFavProduct ? 'active' : ''}" onclick="event.stopPropagation(); toggleFav(${p.id})" title="إضافة للمفضلة">
          <i data-lucide="heart"></i>
        </button>
      </div>
      <div class="prod-info">
        <h3 class="prod-name">${p.name}</h3>
        <p class="prod-price">${old} ${disp}</p>
        ${p.imgs.length > 1 ? `
          <div class="img-dots">
            ${p.imgs.map((_, i) => `<div class="img-dot ${i === 0 ? 'on' : ''}"></div>`).join('')}
          </div>` : ''}
      </div>
    </div>`;
  }).join('');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ── PRODUCT QUICK VIEW MODAL ──
function openProd(id) {
  curProd = products.find(p => p.id === id);
  if (!curProd) return;
  
  curImg = 0;
  setModImg();
  
  document.getElementById('mod-name').textContent = curProd.name;
  
  const priceDisp = curProd.discount
    ? `<del>${curProd.price}</del> ${fmt(calcDiscounted(curProd.origPrice, curProd.discount))} <span class="discount-badge">خصم -${curProd.discount}%</span>`
    : curProd.price;
    
  document.getElementById('mod-price').innerHTML = priceDisp;
  document.getElementById('mod-desc').textContent = curProd.desc;
  
  const sw = document.getElementById('mod-sizes');
  if (curProd.sizes && curProd.sizes.length) {
    document.getElementById('mod-sizes-wrap').style.display = 'block';
    sw.innerHTML = curProd.sizes.map((s, i) => `<button class="sz ${i === 0 ? 'on' : ''}" onclick="selSz(this)">${s}</button>`).join('');
  } else {
    document.getElementById('mod-sizes-wrap').style.display = 'none';
    sw.innerHTML = '';
  }
  
  document.getElementById('gal-dots').innerHTML = curProd.imgs.map((_, i) => `<div class="gal-dot ${i === 0 ? 'on' : ''}" onclick="goImg(${i})"></div>`).join('');
  
  document.getElementById('prod-overlay').classList.add('open');
  lock();
}

function selSz(btn) {
  document.querySelectorAll('#mod-sizes .sz').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function setModImg() {
  if (!curProd) return;
  document.getElementById('mod-img').src = curProd.imgs[curImg] || DEFAULT_PLACEHOLDER;
  document.querySelectorAll('.gal-dot').forEach((d, i) => d.classList.toggle('on', i === curImg));
}

function goImg(i) {
  curImg = i;
  setModImg();
}

function galNav(d) {
  if (!curProd || !curProd.imgs.length) return;
  curImg = (curImg + d + curProd.imgs.length) % curProd.imgs.length;
  setModImg();
}

function closeProdModal(e) {
  if (!e || e.target === document.getElementById('prod-overlay') || e.target.classList.contains('modal-close-btn')) {
    document.getElementById('prod-overlay').classList.remove('open');
    unlock();
  }
}

function addFromModal() {
  if (!curProd) return;
  let sz = '';
  if (curProd.sizes && curProd.sizes.length) {
    const active = document.querySelector('#mod-sizes .sz.on');
    if (!active) {
      toast('⚠️ اختاري المقاس أولاً');
      return;
    }
    sz = active.textContent;
  }
  addToCart(curProd, sz);
  closeProdModal();
}

function quickAdd(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const sz = p.sizes && p.sizes.length ? p.sizes[0] : '';
  addToCart(p, sz);
}

// ── SHOPPING CART LOGIC ──
function addToCart(prod, size) {
  const finalPrice = prod.discount ? fmt(calcDiscounted(prod.origPrice, prod.discount)) : prod.price;
  const ex = cart.find(i => i.id === prod.id && i.size === size);
  if (ex) {
    ex.qty++;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      price: finalPrice,
      origPrice: prod.origPrice,
      discount: prod.discount,
      img: prod.imgs[0] || DEFAULT_PLACEHOLDER,
      size,
      qty: 1
    });
  }
  updCount();
  saveLocalCart();
  renderCart();
  toast(`✅ أُضيفت "${prod.name}" ${size ? `(${size})` : ''} للسلة`);
}

function updCount() {
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-count').textContent = totalItems;
}

function renderCart() {
  const b = document.getElementById('cart-body');
  if (!b) return;

  if (!cart.length) {
    b.innerHTML = `
      <div class="cart-empty-msg">
        <i data-lucide="shopping-bag" style="width: 44px; height: 44px; margin: 0 auto 1.2rem; color: var(--rose); opacity: 0.7;"></i>
        <p>سلتك فارغة حالياً 🌸<br>ابدئي بالتسوق لإضافات المنتجات</p>
      </div>`;
    if (window.lucide) window.lucide.createIcons();
    calcCartTotals();
    return;
  }

  b.innerHTML = cart.map((it, i) => `
    <div class="c-item">
      <img src="${it.img}" alt="${it.name}" onerror="this.src='${DEFAULT_PLACEHOLDER}'">
      <div class="c-item-info">
        <div class="c-item-name">${it.name}</div>
        ${it.size ? `<div class="c-item-sz">المقاس: ${it.size}</div>` : ''}
        <div class="c-item-price">${it.price}</div>
        <div class="c-qty">
          <button class="qty-btn" onclick="chQty(${i}, -1)">−</button>
          <span class="qty-n">${it.qty}</span>
          <button class="qty-btn" onclick="chQty(${i}, 1)">+</button>
        </div>
      </div>
      <button class="c-rm" onclick="rmItem(${i})"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
    </div>`).join('');

  if (window.lucide) window.lucide.createIcons();
  calcCartTotals();
}

function chQty(i, d) {
  cart[i].qty += d;
  if (cart[i].qty <= 0) {
    cart.splice(i, 1);
  }
  updCount();
  saveLocalCart();
  renderCart();
}

function rmItem(i) {
  cart.splice(i, 1);
  updCount();
  saveLocalCart();
  renderCart();
}

function calcCartTotals() {
  const sub = cart.reduce((s, i) => s + pNum(i.price) * i.qty, 0);
  const rows = document.getElementById('cart-rows');
  if (!rows) return;
  
  rows.innerHTML = cart.length ? `
    <div class="cart-row"><span>المجموع الفرعي</span><span>${fmt(sub)}</span></div>
    <div class="cart-row total"><span>الإجمالي (بدون توصيل)</span><span>${fmt(sub)}</span></div>` : '';
}

function openCart() {
  document.getElementById('cart-panel').classList.add('open');
  renderCart();
}

function closeCart() {
  document.getElementById('cart-panel').classList.remove('open');
}

// ── CHECKOUT FLOW ──
function openCheckout() {
  if (!cart.length) {
    toast('سلتك فارغة! أضيفي منتجات أولاً 🛍️');
    return;
  }
  document.getElementById('co-zone').value = '';
  document.getElementById('co-del-note').style.display = 'none';
  document.getElementById('ship-choice').style.display = 'none';
  selShipCo = 'qadmus';
  document.getElementById('ship-qadmus').classList.add('on');
  document.getElementById('ship-haram').classList.remove('on');
  updCoSum();
  document.getElementById('co-overlay').classList.add('open');
  lock();
  closeCart();
}

function closeCheckout(e) {
  if (!e || e.target === document.getElementById('co-overlay') || e.target.classList.contains('modal-close-btn')) {
    document.getElementById('co-overlay').classList.remove('open');
    unlock();
  }
}

function selShip(co) {
  selShipCo = co;
  document.getElementById('ship-qadmus').classList.toggle('on', co === 'qadmus');
  document.getElementById('ship-haram').classList.toggle('on', co === 'haram');
  updCoSum();
}

function getDeliveryFee(zone) {
  if (zone === 'damascus') return 25000;
  if (zone === 'rural') return 45000;
  return 0; // govs is handled textually
}

function getZoneLabel(zone) {
  if (zone === 'damascus') return 'دمشق';
  if (zone === 'rural') return 'ريف دمشق';
  if (zone === 'govs') return 'شحن محافظات';
  return '';
}

function zoneChanged() {
  const z = document.getElementById('co-zone').value;
  const note = document.getElementById('co-del-note');
  const shipDiv = document.getElementById('ship-choice');
  if (z) {
    const fee = getDeliveryFee(z);
    note.style.display = 'block';
    if (z === 'govs') {
      note.innerHTML = `منطقة: <strong>${getZoneLabel(z)}</strong> — أجور الشحن: <strong>حسب شركة الشحن</strong>`;
    } else {
      note.innerHTML = `منطقة: <strong>${getZoneLabel(z)}</strong> — أجور الشحن: <strong>${fmt(fee)}</strong>`;
    }
    shipDiv.style.display = z === 'govs' ? 'block' : 'none';
  } else {
    note.style.display = 'none';
    shipDiv.style.display = 'none';
  }
  updCoSum();
}

function updCoSum() {
  const z = document.getElementById('co-zone').value;
  const del = z ? getDeliveryFee(z) : 0;
  const sub = cart.reduce((s, i) => s + pNum(i.price) * i.qty, 0);
  const shipLabel = z === 'govs' ? ` (${selShipCo === 'qadmus' ? 'قدموس' : 'هرم / مسارات'})` : '';
  
  let deliveryDisp = '—';
  if (z) {
    deliveryDisp = z === 'govs' ? 'حسب شركة الشحن' : fmt(del);
  }
  
  let totalDisp = '—';
  if (z) {
    totalDisp = z === 'govs' ? fmt(sub) + ' + شحن' : fmt(sub + del);
  }

  document.getElementById('co-sum').innerHTML = `
    <h4>ملخص الطلب</h4>
    ${cart.map(i => `<div class="sum-row"><span>${i.name} ${i.size ? `(${i.size})` : ''} × ${i.qty}</span><span>${fmt(pNum(i.price) * i.qty)}</span></div>`).join('')}
    <div class="sum-row"><span>التوصيل${shipLabel}</span><span>${deliveryDisp}</span></div>
    <div class="sum-row tot"><span>الإجمالي</span><span>${totalDisp}</span></div>`;
}

// ── CONFIRM ORDER TO SUPABASE ──
async function confirmOrder() {
  if (orderSubmitting) return;
  
  const name = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const zone = document.getElementById('co-zone').value;
  const addr = document.getElementById('co-addr').value.trim();
  
  if (!name) { toast('⚠️ الرجاء إدخال الاسم الكامل'); return; }
  if (!phone || phone.length < 9) { toast('⚠️ الرجاء إدخال رقم هاتف فعال'); return; }
  if (!zone) { toast('⚠️ الرجاء اختيار منطقة التوصيل'); return; }
  if (!addr || addr.length < 8) { toast('⚠️ الرجاء إدخال العنوان بالتفصيل الكامل'); return; }
  
  orderSubmitting = true;
  toast('⏳ جاري تأكيد الطلب...');
  
  const del = getDeliveryFee(zone);
  const sub = cart.reduce((s, i) => s + pNum(i.price) * i.qty, 0);
  const oid = 'NR-' + Date.now().toString().slice(-6);
  const shipCo = zone === 'govs' ? (selShipCo === 'qadmus' ? 'قدموس' : 'هرم / مسارات') : null;
  
  const orderData = {
    id: oid,
    customer_name: name,
    phone,
    zone: getZoneLabel(zone),
    address: addr,
    ship_company: shipCo,
    notes: document.getElementById('co-notes').value.trim(),
    items: cart,
    subtotal: sub,
    delivery: del,
    total: sub + del,
    status: 'new' // status defaults to new
  };

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert([orderData]);

    if (error) throw error;

    // Success
    cart = [];
    updCount();
    saveLocalCart();
    renderCart();
    closeCheckout();
    
    document.getElementById('success-num').textContent = 'رقم طلبك: ' + oid;
    document.getElementById('success-overlay').classList.add('open');
    lock();
  } catch (err) {
    console.error("Order submission failed:", err);
    toast('❌ فشل تأكيد الطلب، يرجى التحقق من اتصال الإنترنت');
  } finally {
    orderSubmitting = false;
  }
}

function closeSuccess() {
  document.getElementById('success-overlay').classList.remove('open');
  unlock();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── CUSTOMER ORDER CANCEL FLOW ──
function openCancelOrder() {
  document.getElementById('cancel-overlay').classList.add('open');
  lock();
}

function closeCancelOrder(e) {
  if (!e || e.target === document.getElementById('cancel-overlay') || e.target.classList.contains('modal-close-btn')) {
    document.getElementById('cancel-overlay').classList.remove('open');
    unlock();
  }
}

async function submitCancelOrder() {
  const oid = document.getElementById('cancel-oid').value.trim();
  const phone = document.getElementById('cancel-phone').value.trim();
  
  if (!oid || !phone) {
    toast('⚠️ أدخلي رقم الطلب والهاتف');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', oid)
      .eq('phone', phone);

    if (error) throw error;

    if (!data || !data.length) {
      toast('❌ الطلب غير موجود أو رقم الهاتف غير مطابق');
      return;
    }

    const order = data[0];
    const created = new Date(order.created_at);
    const now = new Date();
    const diffHrs = (now - created) / 1000 / 3600;

    if (diffHrs > 2) {
      toast('❌ نعتذر! انتهت مدة الإلغاء المتاحة (ساعتان من الطلب)');
      return;
    }

    // Update status to cancelled
    const { error: updErr } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', oid);

    if (updErr) throw updErr;

    closeCancelOrder();
    toast('✅ تم إلغاء طلبك بنجاح');
  } catch (err) {
    console.error("Cancel failed:", err);
    toast('❌ فشل إلغاء الطلب، يرجى المحاولة لاحقاً');
  }
}

// ── CLIENT RATINGS FLOW ──
let siteRating = 0;

function openRating() {
  siteRating = 0;
  document.querySelectorAll('.star-btn').forEach(s => s.style.color = '#ccc');
  document.getElementById('rating-overlay').classList.add('open');
  lock();
}

function closeRating(e) {
  if (!e || e.target === document.getElementById('rating-overlay') || e.target.classList.contains('modal-close-btn')) {
    document.getElementById('rating-overlay').classList.remove('open');
    unlock();
  }
}

function setRating(n) {
  siteRating = n;
  document.querySelectorAll('.star-btn').forEach((s, i) => {
    s.style.color = i < n ? '#B8955A' : '#ccc';
  });
}

async function submitRating() {
  if (!siteRating) {
    toast('⚠️ اختاري تقييمك أولاً');
    return;
  }
  
  const comment = document.getElementById('rating-comment').value.trim();
  
  try {
    const { error } = await supabase
      .from('ratings')
      .insert([{ stars: siteRating, comment }]);

    if (error) throw error;

    closeRating();
    toast('🌸 شكراً جزيلاً لتقييمك ومشاركتك!');
  } catch (err) {
    console.error(err);
    toast('❌ حدث خطأ، يرجى المحاولة لاحقاً');
  }
}

// ── PRODUCT RATING FLOW ──
let prodRating = 0;
let ratingProdId = null;

function openProdRating(id) {
  ratingProdId = id;
  prodRating = 0;
  document.querySelectorAll('.prod-star-btn').forEach(s => s.style.color = '#ccc');
  document.getElementById('prod-rating-comment').value = '';
  document.getElementById('prod-rating-name').value = '';
  document.getElementById('prod-rating-overlay').classList.add('open');
  lock();
}

function closeProdRating(e) {
  if (!e || e.target === document.getElementById('prod-rating-overlay') || e.target.classList.contains('modal-close-btn')) {
    document.getElementById('prod-rating-overlay').classList.remove('open');
    unlock();
  }
}

function setProdRating(n) {
  prodRating = n;
  document.querySelectorAll('.prod-star-btn').forEach((s, i) => {
    s.style.color = i < n ? '#B8955A' : '#ccc';
  });
}

async function submitProdRating() {
  if (!prodRating) {
    toast('⚠️ اختاري تقييمك أولاً');
    return;
  }
  
  const comment = document.getElementById('prod-rating-comment').value.trim();
  const name = document.getElementById('prod-rating-name').value.trim() || 'زبونة';
  
  try {
    const { error } = await supabase
      .from('product_ratings')
      .insert([{ product_id: ratingProdId, stars: prodRating, comment, reviewer: name }]);

    if (error) throw error;

    closeProdRating();
    toast('🌸 تم إرسال تقييم المنتج بنجاح، شكراً لكِ!');
  } catch (err) {
    console.error(err);
    toast('❌ حدث خطأ، يرجى المحاولة لاحقاً');
  }
}

// ── SHARE PRODUCT ──
function shareProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const url = window.location.href.split('?')[0] + '?product=' + id;
  
  if (navigator.share) {
    navigator.share({
      title: p.name,
      text: `${p.name} — ${p.price}`,
      url
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(url)
      .then(() => toast('✅ تم نسخ رابط المنتج لمشاركته'))
      .catch(() => toast('❌ فشل نسخ الرابط'));
  }
}

// ── FAVORITES SYSTEM ──
function toggleFav(id) {
  let favs = getFavs();
  if (favs.includes(id)) {
    favs = favs.filter(x => x !== id);
    toast('💔 تمت إزالتها من المفضلة');
  } else {
    favs.push(id);
    toast('❤️ أُضيفت إلى المفضلة');
  }
  localStorage.setItem('noor_favs', JSON.stringify(favs));
  renderProds();
}

function isFav(id) {
  return getFavs().includes(id);
}

function getFavs() {
  try {
    return JSON.parse(localStorage.getItem('noor_favs') || '[]');
  } catch (e) {
    return [];
  }
}

// ── SHOPPER SEARCH & CATEGORIES ──
function filterShopCategory(cat, btn) {
  shopperCategoryFilter = cat;
  document.querySelectorAll('.category-tabs .cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProds();
}

function filterShopSearch() {
  const inp = document.getElementById('shop-search-input');
  shopperSearchQuery = inp ? inp.value.trim() : '';
  renderProds();
}

// ── ADMIN PANEL DASHBOARD LOGIC (SECURED BY SUPABASE AUTH) ──
async function checkAuthSession() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  adminSession = session;
  
  // Update admin panel UI state depending on auth status
  if (adminSession) {
    document.getElementById('admin-login-area').style.display = 'none';
    document.getElementById('admin-panel-area').style.display = 'block';
  }
}

function openAdmin() {
  const emailEl = document.getElementById('a-email');
  const passEl = document.getElementById('a-pass');
  const errEl = document.getElementById('login-err');
  
  if (emailEl) emailEl.value = '';
  if (passEl) passEl.value = '';
  if (errEl) errEl.style.display = 'none';
  
  if (adminSession) {
    showDashboard();
  } else {
    const loginArea = document.getElementById('admin-login-area');
    const panelArea = document.getElementById('admin-panel-area');
    if (loginArea) loginArea.style.display = 'block';
    if (panelArea) panelArea.style.display = 'none';
  }
  
  const overlay = document.getElementById('admin-overlay');
  if (overlay) overlay.classList.add('open');
  lock();
}

function closeAdmin() {
  document.getElementById('admin-overlay').classList.remove('open');
  unlock();
}

function closeAdminOv(e) {
  if (e.target === document.getElementById('admin-overlay')) {
    closeAdmin();
  }
}

// Login verification
async function checkLogin() {
  const email = document.getElementById('a-email').value.trim();
  const password = document.getElementById('a-pass').value.trim();
  const errEl = document.getElementById('login-err');
  
  if (!email || !password) {
    errEl.textContent = '❌ الرجاء إدخال البريد الإلكتروني وكلمة السر';
    errEl.style.display = 'block';
    return;
  }
  
  toast('⏳ جاري تسجيل الدخول الآمن...');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    adminSession = data.session;
    showDashboard();
    toast('🔓 تم تسجيل الدخول بنجاح');
  } catch (err) {
    console.error("Login failed:", err);
    errEl.textContent = '❌ فشل الدخول: يرجى التحقق من صحة البيانات';
    errEl.style.display = 'block';
  }
}

async function handleLogout() {
  if (!supabase) return;
  await supabase.auth.signOut();
  adminSession = null;
  document.getElementById('admin-login-area').style.display = 'block';
  document.getElementById('admin-panel-area').style.display = 'none';
  toast('🔒 تم تسجيل الخروج بنجاح');
}

// Show Dashboard UI after successful login
async function showDashboard() {
  document.getElementById('admin-login-area').style.display = 'none';
  document.getElementById('admin-panel-area').style.display = 'block';
  
  // Trigger loaders
  calcStats();
  aTab(currentAdminTab, document.querySelector(`.a-tab[onclick*="${currentAdminTab}"]`));
}

// Switch tabs inside admin panel
function aTab(tabId, el) {
  if (!el) return;
  currentAdminTab = tabId;
  document.querySelectorAll('.a-tab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  
  document.querySelectorAll('.a-sec').forEach(s => s.classList.remove('on'));
  document.getElementById('a-' + tabId).classList.add('on');
  
  if (tabId === 'prods') renderAProds();
  if (tabId === 'orders') renderAOrders();
  if (tabId === 'ratings') renderARatings();
}

// Calculate Dashboard Stats Cards
async function calcStats() {
  if (!supabase) return;
  
  // Total Products Count
  const productsCount = products.length;
  
  // Fetch orders directly from Supabase
  const { data: ordersData, error: ordersErr } = await supabase
    .from('orders')
    .select('total, status');
    
  if (ordersErr) {
    console.error(ordersErr);
    return;
  }

  // Fetch site ratings to show average review score
  const { data: ratingsData } = await supabase
    .from('ratings')
    .select('stars');
  
  const totalOrders = ordersData ? ordersData.length : 0;
  
  // Sum up sales for non-cancelled orders
  const validOrders = ordersData ? ordersData.filter(o => o.status !== 'cancelled') : [];
  const totalSales = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  
  // Calculate Avg Stars
  const avgStars = ratingsData && ratingsData.length 
    ? (ratingsData.reduce((sum, r) => sum + r.stars, 0) / ratingsData.length).toFixed(1)
    : '5.0';

  // Render stats cards in admin panel
  document.getElementById('stat-sales').textContent = fmt(totalSales);
  document.getElementById('stat-orders').textContent = totalOrders;
  document.getElementById('stat-products').textContent = productsCount;
  document.getElementById('stat-rating').textContent = `${avgStars} ★`;
}

// ── ADMIN: PRODUCT MANAGEMENT ──
function addNewSize() {
  const inp = document.getElementById('new-sz-input');
  if (!inp) return;
  const v = inp.value.trim();
  if (!v) return;
  
  if (newProdSizes.includes(v)) {
    toast('⚠️ هذا المقاس مضاف مسبقاً');
    return;
  }
  newProdSizes.push(v);
  inp.value = '';
  renderNewSizes();
}

function removeNewSize(i) {
  newProdSizes.splice(i, 1);
  renderNewSizes();
}

function renderNewSizes() {
  const w = document.getElementById('new-sizes-wrap');
  if (!w) return;
  w.innerHTML = newProdSizes.map((s, i) => `
    <div class="sz-tag">${s}<button onclick="removeNewSize(${i})">×</button></div>`).join('');
}

// Supabase Storage Image Upload
async function uploadImageToStorage(file) {
  if (!supabase) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  
  try {
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });
      
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
      
    return publicUrl;
  } catch (err) {
    console.error("Storage upload failed:", err);
    return null;
  }
}

async function handleImgs(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  
  toast('⏳ جاري رفع الصور إلى السحابة...');
  
  let successCount = 0;
  for (const f of files) {
    const url = await uploadImageToStorage(f);
    if (url) {
      newProdImgs.push(url);
      successCount++;
    } else {
      toast('❌ فشل رفع إحدى الصور');
    }
  }
  
  if (successCount > 0) {
    renderImgPreview();
    toast(`✅ تم رفع ${successCount} صورة بنجاح`);
  }
  input.value = '';
}

function removeImg(i) {
  newProdImgs.splice(i, 1);
  renderImgPreview();
}

function renderImgPreview() {
  const p = document.getElementById('a-img-preview');
  if (!p) return;
  p.innerHTML = newProdImgs.map((src, i) => `
    <div class="img-preview-item">
      <img src="${src}" alt="">
      <button onclick="removeImg(${i})">×</button>
    </div>`).join('');
}

// Add Product to database
async function addProd() {
  const name = document.getElementById('a-name').value.trim();
  const priceRaw = document.getElementById('a-price').value.trim();
  const disc = parseInt(document.getElementById('a-discount').value) || 0;
  const desc = document.getElementById('a-desc').value.trim();
  const tag = document.getElementById('a-tag').value;
  
  if (!name || !priceRaw) {
    toast('⚠️ الاسم والسعر مطلوبان لإضافة منتج');
    return;
  }
  
  const origPrice = pNum(priceRaw) || 0;
  
  const prodData = {
    name,
    price: fmt(origPrice),
    orig_price: origPrice,
    discount: disc,
    description: desc,
    images: newProdImgs.length ? [...newProdImgs] : null,
    sizes: [...newProdSizes],
    tag,
    out_of_stock: false
  };

  toast('⏳ جاري إضافة المنتج لقاعدة البيانات...');
  
  try {
    const { data, error } = await supabase
      .from('products')
      .insert([prodData]);
      
    if (error) throw error;
    
    // Clear inputs
    ['a-name', 'a-price', 'a-discount', 'a-desc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('a-tag').value = '';
    newProdSizes = [];
    newProdImgs = [];
    renderNewSizes();
    renderImgPreview();
    
    await loadProducts();
    calcStats();
    aTab('prods', document.querySelector('.a-tab[onclick*="prods"]'));
    toast(`✅ تمت إضافة المنتج "${name}" بنجاح`);
  } catch (err) {
    console.error(err);
    toast('❌ فشل إضافة المنتج');
  }
}

// Edit Product logic
let editId = null;
function toggleEdit(id) {
  editId = editId === id ? null : id;
  renderAProds();
}

async function saveEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  
  const newPrice = document.getElementById(`edit-price-${id}`).value.trim();
  const newDisc = parseInt(document.getElementById(`edit-disc-${id}`).value) || 0;
  const oos = document.getElementById(`edit-oos-${id}`).checked;
  
  const updateData = {
    discount: newDisc,
    out_of_stock: oos
  };
  
  if (newPrice) {
    updateData.price = newPrice;
    updateData.orig_price = pNum(newPrice);
  }
  
  toast('⏳ جاري حفظ التغييرات...');
  
  try {
    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);
      
    if (error) throw error;
    
    await loadProducts();
    calcStats();
    editId = null;
    renderAProds();
    toast('✅ تم حفظ تعديلات المنتج بنجاح');
  } catch (err) {
    console.error(err);
    toast('❌ فشل تعديل المنتج');
  }
}

async function removeProdSize(pid, si) {
  const p = products.find(x => x.id === pid);
  if (!p) return;
  
  p.sizes.splice(si, 1);
  
  try {
    const { error } = await supabase
      .from('products')
      .update({ sizes: p.sizes })
      .eq('id', pid);
      
    if (error) throw error;
    renderAProds();
    toast('🗑 تم حذف المقاس');
  } catch (err) {
    console.error(err);
  }
}

async function addProdSize(pid) {
  const inp = document.getElementById(`edit-sz-inp-${pid}`);
  const v = inp.value.trim();
  if (!v) return;
  
  const p = products.find(x => x.id === pid);
  if (!p) return;
  
  if (p.sizes.includes(v)) {
    toast('⚠️ المقاس موجود مسبقاً');
    return;
  }
  
  p.sizes.push(v);
  inp.value = '';
  
  try {
    const { error } = await supabase
      .from('products')
      .update({ sizes: p.sizes })
      .eq('id', pid);
      
    if (error) throw error;
    renderAProds();
  } catch (err) {
    console.error(err);
  }
}

async function delProd(id) {
  if (!confirm('⚠️ هل أنتِ متأكدة من حذف هذا المنتج نهائياً من المتجر؟')) return;
  
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    await loadProducts();
    calcStats();
    renderAProds();
    toast('🗑 تم حذف المنتج بنجاح');
  } catch (err) {
    console.error(err);
    toast('❌ حدث خطأ أثناء الحذف');
  }
}

function renderAProds() {
  const el = document.getElementById('a-prods-list');
  if (!el) return;
  
  // Filter products locally if search query exists
  const q = document.getElementById('search-prods-input')?.value.toLowerCase().trim() || '';
  const oosFilter = document.getElementById('filter-prods-stock')?.value || 'all';
  
  let filtered = [...products];
  if (q) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }
  if (oosFilter === 'instock') {
    filtered = filtered.filter(p => !p.outOfStock);
  } else if (oosFilter === 'oos') {
    filtered = filtered.filter(p => p.outOfStock);
  }

  if (!filtered.length) {
    el.innerHTML = '<p class="no-data">لا توجد منتجات مطابقة لخيارات البحث</p>';
    return;
  }
  
  el.innerHTML = `
    <p style="font-size: .88rem; color: var(--muted); margin-bottom: 1.2rem;">يتم عرض ${filtered.length} منتج</p>
    ${filtered.map(p => `
      <div class="a-prod-row">
        <img src="${p.imgs[0] || DEFAULT_PLACEHOLDER}" alt="${p.name}" onerror="this.src='${DEFAULT_PLACEHOLDER}'">
        <div class="inf">
          <span>${p.name} ${p.outOfStock ? '<span style="color:#c0706a; font-size:0.75rem">(🔴 نفذ)</span>' : ''}</span>
          <small>${p.price} ${p.discount ? `— خصم ${p.discount}%` : ''} | المقاسات: ${p.sizes.length ? p.sizes.join(', ') : 'لا يوجد'}</small>
        </div>
        <div class="a-prod-actions">
          <button class="a-edit" onclick="toggleEdit(${p.id})"><i data-lucide="edit-3" style="width:14px;height:14px"></i> تعديل</button>
          <button class="a-del" onclick="delProd(${p.id})"><i data-lucide="trash-2" style="width:14px;height:14px"></i> حذف</button>
        </div>
      </div>
      ${editId === p.id ? `
      <div class="edit-panel">
        <h4>تعديل المنتج: ${p.name}</h4>
        <div class="edit-row">
          <label>السعر (ل.س)</label>
          <input id="edit-price-${p.id}" value="${p.price}">
        </div>
        <div class="edit-row">
          <label>الخصم (%)</label>
          <input id="edit-disc-${p.id}" type="number" value="${p.discount}" min="0" max="99">
        </div>
        <div class="oos-toggle">
          <input type="checkbox" id="edit-oos-${p.id}" ${p.outOfStock ? 'checked' : ''}>
          <label for="edit-oos-${p.id}">علامة "نفذت الكمية" (خارج المخزن)</label>
        </div>
        <button class="edit-save" onclick="saveEdit(${p.id})">حفظ التعديلات ✓</button>
        
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem">
          <div style="font-size: .8rem; font-weight: 600; color: var(--muted); margin-bottom: 0.8rem">إدارة المقاسات المتوفرة</div>
          <div class="sizes-admin-wrap">
            ${p.sizes.map((s, si) => `
              <div class="sz-tag">${s}<button onclick="removeProdSize(${p.id}, ${si})">×</button></div>`).join('')}
          </div>
          <div class="sz-add-row" style="max-width: 280px">
            <input id="edit-sz-inp-${p.id}" placeholder="أضف مقاساً">
            <button onclick="addProdSize(${p.id})">+</button>
          </div>
        </div>
      </div>` : ''}
    `).join('');
    
  if (window.lucide) window.lucide.createIcons();
}

// Trigger Product list filter/search
function filterProductsAdmin() {
  renderAProds();
}

// ── ADMIN: ORDERS MANAGEMENT ──
async function loadOrdersAdmin() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error(error);
    return;
  }
  ordersList = data || [];
}

async function renderAOrders() {
  const el = document.getElementById('a-orders-list');
  if (!el) return;
  
  el.innerHTML = '<p class="no-data">⏳ جاري تحميل سجل الطلبات...</p>';
  await loadOrdersAdmin();
  
  const q = document.getElementById('search-orders-input')?.value.toLowerCase().trim() || '';
  const statusFilter = document.getElementById('filter-orders-status')?.value || 'all';
  
  let filtered = [...ordersList];
  
  // Apply Search
  if (q) {
    filtered = filtered.filter(o => 
      o.id.toLowerCase().includes(q) || 
      o.customer_name.toLowerCase().includes(q) || 
      o.phone.includes(q) || 
      o.address.toLowerCase().includes(q)
    );
  }
  
  // Apply Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(o => o.status === statusFilter);
  }
  
  if (!filtered.length) {
    el.innerHTML = '<div class="no-data">لا توجد طلبات مطابقة لخيارات البحث 🌸</div>';
    return;
  }
  
  el.innerHTML = `
    <p style="font-size: .88rem; color: var(--muted); margin-bottom: 1.2rem;">يتم عرض ${filtered.length} طلب</p>
    ${filtered.map(o => {
      let statusClass = 'status-pending';
      let statusLabel = 'جديد (انتظار)';
      if (o.status === 'confirmed') { statusClass = 'status-confirmed'; statusLabel = 'مؤكد'; }
      if (o.status === 'cancelled') { statusClass = 'status-cancelled'; statusLabel = 'ملغي'; }

      return `
      <div class="o-card" style="border-right-color: ${o.status === 'cancelled' ? '#c0706a' : (o.status === 'confirmed' ? '#8cb89f' : 'var(--rose)')}">
        <h4>
          <span>#${o.id} — ${o.customer_name}</span>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </h4>
        <p><i data-lucide="phone"></i> <strong>هاتف الزبونة:</strong> ${o.phone}</p>
        <p><i data-lucide="map-pin"></i> <strong>المنطقة والشحن:</strong> ${o.zone} ${o.ship_company ? `— عبر ${o.ship_company}` : ''}</p>
        <p><i data-lucide="home"></i> <strong>العنوان بالتفصيل:</strong> ${o.address}</p>
        ${o.notes ? `<p><i data-lucide="file-text"></i> <strong>ملاحظات:</strong> ${o.notes}</p>` : ''}
        <p><i data-lucide="clock"></i> <strong>وقت الطلب:</strong> ${new Date(o.created_at).toLocaleString('ar-SY')}</p>
        
        <div class="o-items">
          ${(o.items || []).map(i => `${i.name} ${i.size ? `(${i.size})` : ''} × ${i.qty} — ${i.price}`).join('<br>')}
        </div>
        
        <div class="o-tot">المجموع الفرعي: ${fmt(o.subtotal)} + توصيل: ${fmt(o.delivery)} = <strong>إجمالي: ${fmt(o.total)}</strong></div>
        
        <div style="display: flex; gap: 0.6rem; margin-top: 1.2rem;">
          <button onclick="confirmOrderWa('${o.id}', '${o.customer_name}', '${o.phone}')" style="flex:1; padding:0.6rem; background:#25D366; color:#fff; border:none; font-family:'Tajawal',sans-serif; font-size:0.82rem; font-weight:500; cursor:pointer; border-radius:var(--radius-sm); display:inline-flex; align-items:center; justify-content:center; gap:0.4rem;">
            <i data-lucide="check-circle" style="width:14px;height:14px"></i> تأكيد الطلب بالواتساب
          </button>
          <button onclick="cancelOrderWa('${o.id}', '${o.customer_name}', '${o.phone}')" style="flex:1; padding:0.6rem; background:#c0706a; color:#fff; border:none; font-family:'Tajawal',sans-serif; font-size:0.82rem; font-weight:500; cursor:pointer; border-radius:var(--radius-sm); display:inline-flex; align-items:center; justify-content:center; gap:0.4rem;">
            <i data-lucide="x-circle" style="width:14px;height:14px"></i> إلغاء وإعلام بالواتساب
          </button>
        </div>
        
        <div style="display: flex; gap: 0.6rem; margin-top: 0.5rem;">
          <button onclick="updateOrderStatus('${o.id}', 'confirmed')" class="share-btn" style="flex: 1; padding: 0.4rem;">تحويل الحالة إلى "مؤكد"</button>
          <button onclick="updateOrderStatus('${o.id}', 'cancelled')" class="share-btn" style="flex: 1; padding: 0.4rem; color: #c0706a">تحويل الحالة إلى "ملغي"</button>
        </div>
      </div>`;
    }).join('');
    
  if (window.lucide) window.lucide.createIcons();
}

function filterOrdersAdmin() {
  renderAOrders();
}

async function updateOrderStatus(orderId, nextStatus) {
  if (!supabase) return;
  toast('⏳ جاري تحديث حالة الطلب...');
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);
      
    if (error) throw error;
    
    await renderAOrders();
    calcStats();
    toast('✅ تم تحديث حالة الطلب في قاعدة البيانات');
  } catch (err) {
    console.error(err);
    toast('❌ فشل تحديث حالة الطلب');
  }
}

// WhatsApp actions
function confirmOrderWa(id, name, phone) {
  // Set in DB first
  updateOrderStatus(id, 'confirmed');
  
  const msg = encodeURIComponent(`🌸 *تأكيد طلبكِ من متجر نور للأزياء التركية*\n\nأهلاً ${name}،\nيسعدنا إعلامكِ بأنه تم تأكيد طلبكِ رقم *${id}* بنجاح ✅\nسيتم تجهيز الطلب ويسلم لشركة التوصيل في أقرب وقت.\n\nشكراً لثقتكِ بنا وبأزيائنا 💕`);
  window.open(`https://wa.me/963${phone.replace(/^0/, '')}?text=${msg}`, '_blank');
}

function cancelOrderWa(id, name, phone) {
  // Set in DB first
  updateOrderStatus(id, 'cancelled');
  
  const msg = encodeURIComponent(`نعتذر منكِ يا ${name} 🙏\nللأسف نود إعلامكِ بأنه تم إلغاء الطلب رقم *${id}*.\n\nلأي استفسار أو لمعرفة التفاصيل، يمكنكِ مراسلتنا مباشرة على هذا الرقم.\n— متجر نور للأزياء التركية 🌸`);
  window.open(`https://wa.me/963${phone.replace(/^0/, '')}?text=${msg}`, '_blank');
}

// ── ADMIN: FEEDBACK RATINGS MANAGEMENT ──
async function loadRatingsAdmin() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error(error);
    return;
  }
  ratingsList = data || [];
}

async function renderARatings() {
  const el = document.getElementById('a-ratings-list');
  if (!el) return;
  
  el.innerHTML = '<p class="no-data">⏳ جاري تحميل تقييمات المتجر...</p>';
  await loadRatingsAdmin();
  
  if (!ratingsList.length) {
    el.innerHTML = '<div class="no-data">لا توجد تقييمات مسجلة بعد 🌸</div>';
    return;
  }
  
  el.innerHTML = `
    <p style="font-size: .88rem; color: var(--muted); margin-bottom: 1.2rem;">إجمالي الآراء: ${ratingsList.length}</p>
    <div style="display:flex; flex-direction:column; gap:1rem">
      ${ratingsList.map(r => `
        <div class="o-card" style="border-right-color: var(--gold)">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
            <span style="color:var(--gold); font-size:1.1rem; font-weight:700">
              ${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}
            </span>
            <small style="color:var(--muted)">${new Date(r.created_at).toLocaleDateString('ar-SY')}</small>
          </div>
          <p style="color:var(--charcoal); font-size:0.95rem; font-weight:400; line-height:1.7">
            ${r.comment ? `"${r.comment}"` : '<em>تقييم بدون تعليق</em>'}
          </p>
        </div>
      `).join('')}
    </div>`;
}

// Export functions to global scope for HTML onclick bindings
window.goto = goto;
window.openWa = openWa;
window.toast = toast;
window.toggleTheme = toggleTheme;
window.openProd = openProd;
window.closeProdModal = closeProdModal;
window.selSz = selSz;
window.goImg = goImg;
window.galNav = galNav;
window.addFromModal = addFromModal;
window.quickAdd = quickAdd;
window.addToCart = addToCart;
window.openCart = openCart;
window.closeCart = closeCart;
window.chQty = chQty;
window.rmItem = rmItem;
window.openCheckout = openCheckout;
window.closeCheckout = closeCheckout;
window.selShip = selShip;
window.zoneChanged = zoneChanged;
window.confirmOrder = confirmOrder;
window.closeSuccess = closeSuccess;
window.openCancelOrder = openCancelOrder;
window.closeCancelOrder = closeCancelOrder;
window.submitCancelOrder = submitCancelOrder;
window.openRating = openRating;
window.closeRating = closeRating;
window.setRating = setRating;
window.submitRating = submitRating;
window.openProdRating = openProdRating;
window.closeProdRating = closeProdRating;
window.setProdRating = setProdRating;
window.submitProdRating = submitProdRating;
window.shareProduct = shareProduct;
window.toggleFav = toggleFav;
window.openAdmin = openAdmin;
window.closeAdmin = closeAdmin;
window.closeAdminOv = closeAdminOv;
window.checkLogin = checkLogin;
window.handleLogout = handleLogout;
window.aTab = aTab;
window.addNewSize = addNewSize;
window.removeNewSize = removeNewSize;
window.handleImgs = handleImgs;
window.removeImg = removeImg;
window.addProd = addProd;
window.toggleEdit = toggleEdit;
window.saveEdit = saveEdit;
window.removeProdSize = removeProdSize;
window.addProdSize = addProdSize;
window.delProd = delProd;
window.filterProductsAdmin = filterProductsAdmin;
window.filterOrdersAdmin = filterOrdersAdmin;
window.updateOrderStatus = updateOrderStatus;
window.filterShopCategory = filterShopCategory;
window.filterShopSearch = filterShopSearch;
}
}
