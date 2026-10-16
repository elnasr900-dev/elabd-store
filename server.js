const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, 'public');
const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data'));
const usersFile = path.join(dataDir, 'users.json');
const raffleEntriesFile = path.join(dataDir, 'raffle-entries.json');
const sessions = new Map();
const port = Number(process.env.PORT || 3000);
fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]', 'utf8');
if (!fs.existsSync(raffleEntriesFile)) fs.writeFileSync(raffleEntriesFile, '[]', 'utf8');

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
const scooterIds = new Set([2, 19, 22, 27]);
const products = modelNames.map((name, index) => {
  const id = index + 1;
  const number = String(id).padStart(2, '0');
  return { id, name, kind: scooterIds.has(id) ? 'سكوتر' : 'موتوسيكل', image: `/assets/product-page-${number}.jpg` };
});
const rafflePrizes = [
  { id: 'motorcycle-license', name: 'رخصة موتوسيكل' },
  { id: 'oil-change', name: 'غيار زيت' },
  { id: 'discount-5000', name: 'خصم 5000 جنيه' }
];

function send(res, status, payload, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(payload));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100_000) reject(new Error('حجم الطلب كبير')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('بيانات غير صالحة')); } });
    req.on('error', reject);
  });
}
function readUsers() { try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { return []; } }
function safeUser(user) { return { name: user.name, phone: user.phone }; }
function sessionUser(req) {
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('abd_session='))?.slice(12);
  const phone = token && sessions.get(token);
  const user = phone && readUsers().find(item => item.phone === phone);
  return user || null;
}
function makeSession(res, phone) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, phone);
  res.setHeader('Set-Cookie', `abd_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/products') return send(res, 200, products);
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const user = sessionUser(req);
    return send(res, 200, { user: user ? safeUser(user) : null });
  }
  if (req.method === 'GET' && url.pathname === '/api/raffle/status') {
    const user = sessionUser(req);
    if (!user) return send(res, 401, { error: 'سجل دخولك أولاً.' });
    const entries = (() => { try { return JSON.parse(fs.readFileSync(raffleEntriesFile, 'utf8')); } catch { return []; } })();
    return send(res, 200, { entries: entries.filter(entry => entry.phone === user.phone).map(entry => entry.prizeId) });
  }
  if (req.method === 'POST' && url.pathname === '/api/raffle/enter') {
    const user = sessionUser(req);
    if (!user) return send(res, 401, { error: 'سجل دخولك الأول عشان تدخل السحب.' });
    try {
      const body = await readBody(req);
      const prize = rafflePrizes.find(item => item.id === body.prizeId);
      if (!prize) return send(res, 400, { error: 'اختار جائزة صحيحة.' });
      const entries = (() => { try { return JSON.parse(fs.readFileSync(raffleEntriesFile, 'utf8')); } catch { return []; } })();
      const existing = entries.find(entry => entry.phone === user.phone && entry.prizeId === prize.id);
      if (existing) return send(res, 200, { entered: true, alreadyEntered: true, prize: prize.name });
      entries.push({ name: user.name, phone: user.phone, prizeId: prize.id, prize: prize.name, enteredAt: new Date().toISOString() });
      fs.writeFileSync(raffleEntriesFile, JSON.stringify(entries, null, 2), 'utf8');
      return send(res, 201, { entered: true, alreadyEntered: false, prize: prize.name });
    } catch (error) { return send(res, 400, { error: error.message || 'تعذر تسجيل دخولك للسحب.' }); }
  }
  if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
    try {
      const body = await readBody(req);
      const phone = String(body.phone || '').replace(/[\s()-]/g, '');
      const password = String(body.password || '');
      const users = readUsers();
      if (!/^01[0125][0-9]{8}$/.test(phone)) return send(res, 400, { error: 'اكتب رقم موبايل مصري صحيح من 11 رقم.' });
      if (password.length < 6) return send(res, 400, { error: 'كلمة المرور لازم تكون 6 أحرف على الأقل.' });
      let user = users.find(item => item.phone === phone);
      if (url.pathname === '/api/register') {
        const name = String(body.name || '').trim();
        if (name.length < 2) return send(res, 400, { error: 'اكتب اسمك بالكامل.' });
        if (user) return send(res, 409, { error: 'الرقم مسجل بالفعل. سجل الدخول.' });
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(password, salt, 64).toString('hex');
        user = { name, phone, salt, hash, createdAt: new Date().toISOString() };
        users.push(user);
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
      } else {
        if (!user) return send(res, 401, { error: 'الرقم غير مسجل. أنشئ حساباً جديداً.' });
        const hash = crypto.scryptSync(password, user.salt, 64).toString('hex');
        if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'))) return send(res, 401, { error: 'رقم الهاتف أو كلمة المرور غير صحيحة.' });
      }
      makeSession(res, phone);
      return send(res, 200, { user: safeUser(user) });
    } catch (error) { return send(res, 400, { error: error.message || 'حصل خطأ، حاول مرة أخرى.' }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('abd_session='))?.slice(12);
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'abd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return send(res, 200, { ok: true });
  }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(root, requested);
  if (!file.startsWith(root + path.sep)) return send(res, 403, { error: 'غير مسموح' });
  const ext = path.extname(file).toLowerCase();
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };
  if (ext === '.pdf') {
    fs.stat(file, (error, stat) => {
      if (error) return send(res, 404, { error: 'الصفحة غير موجودة' });
      const range = req.headers.range;
      const match = range && range.match(/^bytes=(\d*)-(\d*)$/);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
        if (start > end || start >= stat.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
          return res.end();
        }
        res.writeHead(206, { 'Content-Type': types[ext], 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Disposition': 'inline; filename="el-abd-catalog.pdf"', 'Accept-Ranges': 'bytes' });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': types[ext], 'Content-Length': stat.size, 'Content-Disposition': 'inline; filename="el-abd-catalog.pdf"', 'Accept-Ranges': 'bytes' });
      fs.createReadStream(file).pipe(res);
    });
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) return send(res, 404, { error: 'الصفحة غير موجودة' });
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => console.log(`El Abd store running at http://localhost:${port}`));
