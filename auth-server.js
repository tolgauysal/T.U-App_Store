const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const DEVELOPER_SECRET = process.env.DEVELOPER_SECRET || '';
const DB_FILE = path.join(__dirname, 'db', 'users.json');
const VERIFY_DIR = path.join(__dirname, 'db', 'verification');
const PROFILE_DIR = path.join(__dirname, 'db', 'profiles');
const PAYMENTS_DIR = path.join(__dirname, 'db', 'payments');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const EventEmitter = require('events');
const profileEvents = new EventEmitter();

if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
if (!fs.existsSync(VERIFY_DIR)) fs.mkdirSync(VERIFY_DIR, { recursive: true });
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
if (!fs.existsSync(PAYMENTS_DIR)) fs.mkdirSync(PAYMENTS_DIR, { recursive: true });
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.disable('x-powered-by');
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/downloads', express.static(DOWNLOADS_DIR, {
  index: false,
  redirect: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: DOWNLOADS_DIR,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${req.params.appId}-${Date.now()}${extension}`);
    }
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedExtensions = ['.apk'];
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return callback(new Error('Yalnızca APK dosyaları yüklenebilir.'));
    }
    callback(null, true);
  }
});

function loadUsers() {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return []; }
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function profilePath(userId) {
  return path.join(PROFILE_DIR, `${userId}.json`);
}

function loadProfile(userId) {
  const filePath = profilePath(userId);
  if (!fs.existsSync(filePath)) return { bio: '', avatar: '', backupEmail: '' };
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return { bio: '', avatar: '', backupEmail: '' }; }
}

function saveProfile(userId, profile) {
  fs.writeFileSync(profilePath(userId), JSON.stringify(profile, null, 2));
  profileEvents.emit(`profileUpdate:${userId}`, profile);
}

function sendProfileUpdate(userId, profile) {
  profileEvents.emit(`profileUpdate:${userId}`, profile);
}

function hashPassword(password, salt = '') {
  const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
  return crypto.pbkdf2Sync(password, effectiveSalt, 100000, 64, 'sha256').toString('hex');
}

function verifyPassword(password, user) {
  if (!user) return false;
  if (user.salt) {
    return crypto.timingSafeEqual(
      Buffer.from(hashPassword(password, user.salt), 'hex'),
      Buffer.from(user.password, 'hex')
    );
  }
  return user.password === crypto.createHash('sha256').update(password).digest('hex');
}

function makeCode(length = 6) {
  // produce a 6-digit numeric code by default
  if (length === 6) {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, '0').toUpperCase();
}

function sendMail(to, subject, text) {
  if (!SMTP_USER || !SMTP_PASS) {
    return Promise.resolve({ messageId: 'smtp-disabled' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  return transporter.sendMail({ from: SMTP_USER, to, subject, text });
}

function writeCodesFile(userId, codes, prefix) {
  const filePath = path.join(VERIFY_DIR, `${userId}-${prefix}.txt`);
  fs.writeFileSync(filePath, codes.join('\n'));
}

app.post('/api/register', (req, res) => {
  const { name, email, password, nickname } = req.body;
  const users = loadUsers();
  if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Tüm alanlar gerekli.' });
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ success: false, message: 'Bu e-posta zaten kayıtlı.' });

  const verificationCode = makeCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: crypto.randomBytes(16).toString('hex'),
    name,
    email: email.toLowerCase(),
    password: hashPassword(password, salt),
    salt,
    nickname: nickname || '',
    profile: { bio: '', avatar: '', backupEmail: '' },
    verified: false,
    twoFactorEnabled: false,
    twoFactorCodes: [],
    developer: false,
    createdAt: new Date().toISOString(),
    verificationCode
  };

  users.push(user);
  saveUsers(users);
  saveProfile(user.id, user.profile);
  fs.writeFileSync(path.join(VERIFY_DIR, `${user.id}.txt`), verificationCode);
  sendMail(email, 'T.U App Store doğrulama', `Merhaba ${name}, doğrulama kodun: ${verificationCode}`).catch(() => {});

  res.json({ success: true, message: 'Kayıt başarılı. E-posta doğrulama kodu gönderildi.', userId: user.id, name: user.name });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !verifyPassword(password, user)) return res.status(401).json({ success: false, message: 'E-posta veya parola hatalı.' });
  if (!user.verified) return res.status(403).json({ success: false, message: 'E-posta doğrulaması yapılmadı.' });

  const code = makeCode(6);
  user.twoFactorCodes = [...(user.twoFactorCodes || []), code];
  if (user.twoFactorCodes.length > 10) user.twoFactorCodes = user.twoFactorCodes.slice(-10);
  saveUsers(users);
  writeCodesFile(user.id, user.twoFactorCodes, '2fa');

  sendMail(user.email, 'T.U App Store 2FA kodu', `Giriş kodun: ${code}`).catch(() => {});

  res.json({ success: true, message: 'Giriş başarılı. 2FA kodu e-postana gönderildi.', userId: user.id, name: user.name });
});

// Apps API
const APPS_DIR = path.join(__dirname, 'db', 'apps');
if (!fs.existsSync(APPS_DIR)) fs.mkdirSync(APPS_DIR, { recursive: true });

function appPath(appId) {
  return path.join(APPS_DIR, `${appId}.json`);
}

app.get('/api/apps', (req, res) => {
  try {
    const files = fs.readdirSync(APPS_DIR).filter(f => f.endsWith('.json'));
    const apps = files.map(f => JSON.parse(fs.readFileSync(path.join(APPS_DIR, f), 'utf8')));
    res.json({ success: true, apps });
  } catch (e) { res.status(500).json({ success: false, message: 'Uygulamalar yüklenemedi.' }); }
});

app.post('/api/apps', (req, res) => {
  const { title, description, category, author, downloadUrl, userId, price } = req.body;
  if (!title) return res.status(400).json({ success: false, message: 'Başlık gerekli.' });
  // require userId and check developer flag
  if (!userId) return res.status(401).json({ success: false, message: 'Kullanıcı doğrulaması gerekli.' });
  const users = loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  if (!user.developer) return res.status(403).json({ success: false, message: 'Geliştirici hesabı gerekli.' });

  const id = require('crypto').randomBytes(8).toString('hex');
  const appObj = { 
    id, 
    title, 
    description: description || '', 
    category: category || 'Genel', 
    author: author || user.name || user.nickname || 'Anonim', 
    downloadUrl: downloadUrl || '', 
    fileName: '',
    price: price || 9.99,
    createdAt: new Date().toISOString(), 
    ownerId: userId 
  };
  fs.writeFileSync(appPath(id), JSON.stringify(appObj, null, 2));
  res.json({ success: true, message: 'Uygulama eklendi.', app: appObj });
});

app.post('/api/apps/:appId/upload', upload.single('file'), (req, res) => {
  const { appId } = req.params;
  const { userId } = req.body;

  try {
    const appFile = appPath(appId);
    if (!fs.existsSync(appFile)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Uygulama bulunamadı.' });
    }

    const users = loadUsers();
    const user = users.find((candidate) => candidate.id === userId);
    const appObj = JSON.parse(fs.readFileSync(appFile, 'utf8'));
    if (!user || !user.developer || appObj.ownerId !== userId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Geçerli bir uygulama dosyası seçin.' });

    if (appObj.fileName) {
      try { fs.unlinkSync(path.join(DOWNLOADS_DIR, appObj.fileName)); } catch (error) {}
    }
    appObj.fileName = req.file.filename;
    appObj.downloadUrl = `/downloads/${encodeURIComponent(req.file.filename)}`;
    appObj.updatedAt = new Date().toISOString();
    fs.writeFileSync(appFile, JSON.stringify(appObj, null, 2));
    res.json({ success: true, message: 'Uygulama dosyası barındırıldı.', app: appObj });
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (cleanupError) {}
    }
    res.status(500).json({ success: false, message: 'Dosya yüklenemedi.' });
  }
});

app.put('/api/apps/:appId', (req, res) => {
  const appId = req.params.appId;
  const { title, description, category, price, downloadUrl, userId } = req.body;
  
  try {
    const appFile = appPath(appId);
    if (!fs.existsSync(appFile)) {
      return res.status(404).json({ success: false, message: 'Uygulama bulunamadı.' });
    }
    
    const appObj = JSON.parse(fs.readFileSync(appFile, 'utf8'));
    
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    if (!user || !user.developer) {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }
    
    if (appObj.ownerId !== userId) {
      return res.status(403).json({ success: false, message: 'Bu uygulamayı düzenleyemezsiniz.' });
    }
    
    if (title) appObj.title = title;
    if (description !== undefined) appObj.description = description;
    if (category) appObj.category = category;
    if (price) appObj.price = price;
    if (downloadUrl !== undefined) appObj.downloadUrl = downloadUrl;
    appObj.updatedAt = new Date().toISOString();
    
    fs.writeFileSync(appFile, JSON.stringify(appObj, null, 2));
    res.json({ success: true, message: 'Uygulama güncellendi.', app: appObj });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Güncelleme başarısız.' });
  }
});

app.delete('/api/apps/:appId', (req, res) => {
  const appId = req.params.appId;
  const userId = req.body?.userId;

  try {
    const appFile = appPath(appId);
    if (!fs.existsSync(appFile)) {
      return res.status(404).json({ success: false, message: 'Uygulama bulunamadı.' });
    }

    const appObj = JSON.parse(fs.readFileSync(appFile, 'utf8'));
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    if (!user || !user.developer) {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok.' });
    }

    fs.unlinkSync(appFile);
    if (appObj.fileName) {
      try { fs.unlinkSync(path.join(DOWNLOADS_DIR, appObj.fileName)); } catch (error) {}
    }
    return res.json({ success: true, message: 'Uygulama silindi.' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Silme başarısız.' });
  }
});

app.post('/api/verify', (req, res) => {
  const { userId, code } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  if (user.verificationCode === code) {
    user.verified = true;
    user.verificationCode = '';
    saveUsers(users);
    return res.json({ success: true, message: 'E-posta doğrulandı.' });
  }
  res.status(400).json({ success: false, message: 'Doğrulama kodu yanlış.' });
});

app.post('/api/2fa', (req, res) => {
  const { userId, code } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  if ((user.twoFactorCodes || []).includes(code)) {
    user.twoFactorCodes = (user.twoFactorCodes || []).filter((c) => c !== code);
    saveUsers(users);
    return res.json({ success: true, message: '2FA doğrulandı.' });
  }
  res.status(400).json({ success: false, message: '2FA kodu yanlış.' });
});

app.post('/api/profile', (req, res) => {
  const { userId, bio, backupEmail, avatar, nickname } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  user.profile = { ...user.profile, bio, backupEmail, avatar };
  if (typeof nickname !== 'undefined') user.nickname = nickname;
  saveUsers(users);
  saveProfile(user.id, user.profile);
  res.json({ success: true, message: 'Profil güncellendi.', profile: user.profile });
});

app.post('/api/password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  if (!verifyPassword(oldPassword, user)) return res.status(400).json({ success: false, message: 'Eski parola yanlış.' });
  const newSalt = crypto.randomBytes(16).toString('hex');
  user.salt = newSalt;
  user.password = hashPassword(newPassword, newSalt);
  saveUsers(users);
  res.json({ success: true, message: 'Parola değiştirildi.' });
});

app.post('/api/developer', (req, res) => {
  const { userId, secretKey } = req.body;
  if (!DEVELOPER_SECRET) {
    return res.status(503).json({ success: false, message: 'Geliştirici sunucu anahtarı yapılandırılmadı.' });
  }
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  if (secretKey !== DEVELOPER_SECRET) {
    return res.status(403).json({ success: false, message: 'Geliştirici erişim anahtarı gerekli.' });
  }
  user.developer = true;
  saveUsers(users);
  res.json({ success: true, message: 'Geliştirici hesabı açıldı.' });
});

// Delete account
app.post('/api/delete', (req, res) => {
  const { userId } = req.body;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  const user = users[idx];
  // remove from users
  users.splice(idx, 1);
  saveUsers(users);
  // remove profile file
  try { fs.unlinkSync(profilePath(userId)); } catch (e) {}
  // remove verification files
  try { fs.unlinkSync(path.join(VERIFY_DIR, `${userId}.txt`)); } catch (e) {}
  try {
    const files = fs.readdirSync(VERIFY_DIR);
    files.forEach(f => { if (f.startsWith(userId + '-')) fs.unlinkSync(path.join(VERIFY_DIR, f)); });
  } catch (e) {}
  res.json({ success: true, message: 'Hesap silindi.' });
});

app.get('/api/user/:userId', (req, res) => {
  const users = loadUsers();
  const user = users.find((u) => u.id === req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  const profile = loadProfile(user.id);
  res.json({ success: true, user: { id: user.id, name: user.name, nickname: user.nickname || '', email: user.email, verified: user.verified, twoFactorEnabled: user.twoFactorEnabled, developer: user.developer, profile } });
});

app.get('/api/profile/stream/:userId', (req, res) => {
  const userId = req.params.userId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (profile) => {
    res.write(`event: profileUpdate\n`);
    res.write(`data: ${JSON.stringify(profile)}\n\n`);
  };

  profileEvents.on(`profileUpdate:${userId}`, listener);
  req.on('close', () => {
    profileEvents.off(`profileUpdate:${userId}`, listener);
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: error.message || 'Dosya yükleme hatası.' });
  }
  if (error) {
    return res.status(400).json({ success: false, message: error.message || 'İstek hatası.' });
  }
  next();
});

app.listen(PORT, () => console.log(`Auth server http://localhost:${PORT}`));
