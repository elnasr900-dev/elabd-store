const money = value => `${Math.round(value).toLocaleString('ar-EG')} جنيه`;
const modelNames = [
  'X Road 150-200CC Keeway', 'Keft 150CC Keeway', 'RK7 200CC Keeway', 'Superlight 200CC Keeway',
  'Super Sport 200CC Benelli', 'VLM 200CC Benelli', 'VLM 200CC Benelli', 'VLM 200CC Benelli',
  'L 250CC Vigore', 'G 200CC Dayun', 'Sport Light 250CC Vigore', 'RK 200CC Keeway',
  'VLR 150/200CC Vigore', 'X 150CC Zontes', '150/200CC Wuyang', 'Dayun 4 150CC',
  'ADV 300CC Aria', 'ARIC 350CC Vigore', '50CC Vigore', 'X Road 200CC Vigore',
  '250CC Haojiang', 'XDV 200CC Keeway', 'VR 300CC Vigore', 'VLR 150/200CC Vigore',
  'F 250CC Haojiang', 'Vortex 200AW Keeway', 'N Max 200CC Haojiang', 'TX 250CC Dayun',
  'Trail 250CC Dayun', 'Bold 800W Keeway', 'Maximus 200CC Keeway', 'F 368CC Zontes'
];
const scooterIds = [2, 19, 22, 27];
const products = modelNames.map((name, index) => {
  const number = String(index + 1).padStart(2, '0');
  return { id: index + 1, name, kind: scooterIds.includes(index + 1) ? 'سكوتر' : 'موتوسيكل', image: `/assets/product-page-${number}.jpg` };
});
const grid = document.querySelector('#productGrid');
let activeKind = 'الكل';
function renderProducts() {
  const query = document.querySelector('#searchInput').value.trim().toLowerCase();
  const shown = products.filter(p => (activeKind === 'الكل' || p.kind === activeKind) && `${p.name} ${p.kind}`.toLowerCase().includes(query));
  grid.innerHTML = shown.length ? shown.map(p => `<article class="product-card"><div class="product-art"><img src="${p.image}" alt="${p.name} من معرض العبد" loading="lazy"></div><div class="product-info"><h3>${p.name}</h3><div class="product-bottom"><span class="product-price">اسأل عن السعر</span><a class="product-contact" href="https://wa.me/201128884080?text=${encodeURIComponent(`عايز أعرف تفاصيل ${p.name}`)}" target="_blank" rel="noreferrer">استفسر ↗</a></div></div></article>`).join('') : '<div class="empty-state">مفيش موديلات مطابقة لبحثك حالياً.</div>';
}
renderProducts();
document.querySelector('#searchInput').addEventListener('input', renderProducts);
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.filter.active').classList.remove('active'); button.classList.add('active'); activeKind = button.dataset.kind; renderProducts();
}));
let months = 24;
function calculate() {
  const price = Number(document.querySelector('#priceInput').value);
  if (!price || price < 1000) { document.querySelector('#monthlyResult').innerHTML = '— <i>جنيه</i>'; document.querySelector('#totalResult').textContent = '—'; return; }
  const years = months / 12;
  const total = price * (1 + 0.20 * years);
  document.querySelector('#monthlyResult').innerHTML = `${Math.round(total / months).toLocaleString('ar-EG')} <i>جنيه</i>`;
  document.querySelector('#totalResult').textContent = money(total);
}
document.querySelector('#priceInput').addEventListener('input', calculate);
document.querySelectorAll('#termOptions button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#termOptions .selected').classList.remove('selected'); button.classList.add('selected'); months = Number(button.dataset.months); calculate();
}));

const overlay = document.querySelector('#authOverlay');
const form = document.querySelector('#authForm');
let authMode = 'register';
let currentUser = null;
let pendingPrizeId = null;
let enteredPrizeIds = new Set();
function setMode(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.querySelector('#nameField').hidden = mode === 'login';
  document.querySelector('#nameField input').required = mode === 'register';
  document.querySelector('#authTitle').textContent = mode === 'register' ? 'حساب جديد' : 'تسجيل الدخول';
  document.querySelector('#authSubmit').innerHTML = mode === 'register' ? 'إنشاء الحساب <span>←</span>' : 'دخول <span>←</span>';
  form.elements.password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  document.querySelector('#authError').textContent = '';
}
document.querySelectorAll('.auth-tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
function openAuth(mode = 'register') { setMode(mode); overlay.classList.remove('hidden'); }
function closeAuth() { overlay.classList.add('hidden'); }
const accountButton = document.querySelector('#accountButton');
function updateAccountButton() {
  accountButton.textContent = currentUser ? `خروج (${currentUser.name.split(' ')[0]})` : 'دخول / حساب جديد';
  accountButton.title = currentUser ? 'تسجيل الخروج' : 'تسجيل الدخول أو إنشاء حساب';
}
accountButton.addEventListener('click', async () => {
  if (!currentUser) return openAuth('register');
  try {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null; enteredPrizeIds = new Set(); updateAccountButton(); updateRaffleButtons();
    showToast('تم تسجيل الخروج.');
  } catch { showToast('تعذر تسجيل الخروج، حاول مرة أخرى.'); }
});
document.querySelector('#authClose').addEventListener('click', closeAuth);
overlay.addEventListener('click', e => { if (e.target === overlay) closeAuth(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const error = document.querySelector('#authError'); error.textContent = '';
  try {
    const response = await fetch(`/api/${authMode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { error.textContent = result.error || 'تعذر إتمام الطلب.'; return; }
    closeAuth(); form.reset(); currentUser = result.user; updateAccountButton(); await updateRaffleStatus();
    showToast(`أهلاً بيك يا ${result.user.name}، تم تسجيل دخولك.`);
    if (pendingPrizeId) {
      const prizeId = pendingPrizeId; pendingPrizeId = null;
      enterRaffle(prizeId);
    }
  } catch { error.textContent = 'مش قادرين نوصل للسيرفر. تأكد إن التطبيق شغال.'; }
});
document.querySelector('#year').textContent = new Date().getFullYear();
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3200); }
function updateRaffleButtons() {
  document.querySelectorAll('.raffle-enter').forEach(button => {
    const entered = enteredPrizeIds.has(button.dataset.prize);
    button.disabled = entered;
    button.innerHTML = entered ? 'أنت داخل السحب ✓' : 'ادخل السحب <span>←</span>';
  });
}
async function updateRaffleStatus() {
  if (!currentUser) { enteredPrizeIds = new Set(); updateRaffleButtons(); return; }
  try {
    const response = await fetch('/api/raffle/status');
    if (!response.ok) return;
    const data = await response.json(); enteredPrizeIds = new Set(data.entries); updateRaffleButtons();
  } catch {}
}
async function enterRaffle(prizeId) {
  if (!currentUser) {
    pendingPrizeId = prizeId; setMode('register'); openAuth('register');
    document.querySelector('#authError').textContent = 'سجّل بياناتك عشان تدخل السحب.';
    return;
  }
  const button = document.querySelector(`.raffle-enter[data-prize="${prizeId}"]`);
  if (button) { button.disabled = true; button.textContent = 'جاري تسجيلك...'; }
  try {
    const response = await fetch('/api/raffle/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prizeId }) });
    const data = await response.json();
    if (response.status === 401) {
      if (button) { button.disabled = false; button.innerHTML = 'ادخل السحب <span>←</span>'; }
      currentUser = null; pendingPrizeId = prizeId; updateAccountButton(); openAuth('login'); return;
    }
    if (!response.ok) throw new Error(data.error || 'تعذر تسجيلك في السحب.');
    enteredPrizeIds.add(prizeId); updateRaffleButtons();
    showToast(data.alreadyEntered ? `أنت مسجل بالفعل في سحب ${data.prize}.` : `تم تسجيلك في سحب ${data.prize} بنجاح.`);
  } catch (error) {
    if (button) { button.disabled = false; button.innerHTML = 'ادخل السحب <span>←</span>'; }
    showToast(error.message || 'حصل خطأ، حاول مرة أخرى.');
  }
}
document.querySelectorAll('.raffle-enter').forEach(button => button.addEventListener('click', () => enterRaffle(button.dataset.prize)));
fetch('/api/me').then(r => r.json()).then(data => {
  if (data.user) { currentUser = data.user; updateAccountButton(); updateRaffleStatus(); }
  else openAuth('register');
}).catch(() => {});
document.querySelector('#menuButton').addEventListener('click', () => {
  const nav = document.querySelector('.desktop-nav');
  const open = nav.style.display === 'flex';
  nav.style.cssText = open ? '' : 'display:flex;position:absolute;top:66px;right:0;left:0;background:#171a20;color:#fff;padding:18px 22px;flex-direction:column;gap:14px;border-bottom:1px solid #343840';
});
document.querySelectorAll('.desktop-nav a').forEach(link => link.addEventListener('click', () => { document.querySelector('.desktop-nav').style.cssText = ''; }));
