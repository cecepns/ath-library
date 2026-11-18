require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ==========================================
// 1. UPLOAD, DATABASE & HELPERS
// ==========================================
const UP = path.join(__dirname, "uploads-ath-library");
fs.mkdirSync(UP, { recursive: true });
app.use("/uploads", express.static(UP));

const upload = multer({
  storage: multer.diskStorage({
    destination: UP,
    filename: (_r, f, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e4)}${path.extname(f.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)),
});

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ath_library",
  dateStrings: true,
  connectionLimit: 10,
});

const SECRET = process.env.JWT_SECRET || "ath-library-secret-key-2026-pp-attholibiyah";
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const DEFAULT_SETTINGS = {
  library_name: "Perpustakaan Attholibiyah",
  app_title: "ATH LIBRARY",
  app_subtitle: "Sistem Administrasi Perpustakaan PP Attholibiyah",
  institution_name: "Pondok Pesantren Attholibiyah",
  address: "Bumijawa, Tegal, Jawa Tengah",
  phone: "0812-3456-7890",
  email: "perpustakaan@attholibiyah.sch.id",
  logo: "",
  theme: "Hijau (Default)",
  language: "Indonesia",
  mode: "light",
  notifications: "true",
  remember_me: "true",
  max_books: "3",
  loan_days: "14",
  loan_fee: String(+process.env.LOAN_FEE_PER_BOOK || 2000),
  max_extend: "1",
  extend_days: "7",
  fine_per_day: String(+process.env.FINE_PER_DAY_PER_BOOK || 2000),
};

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (v) => String(v ?? "").replace(/[<>]/g, "").trim();
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    if (e.code === "ER_DUP_ENTRY") e = bad("Data sudah ada (duplikat)", 409);
    if (e.code === "ER_ROW_IS_REFERENCED_2") e = bad("Data masih digunakan oleh data lain", 409);
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ success: false, message: e.status ? e.message : "Terjadi kesalahan server" });
  });

// ==========================================
// 2. AUTHENTICATION HELPERS (CRYPTO SCRYPT + JWT)
// ==========================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, key] = stored.split(":");
  const derived = crypto.scryptSync(String(password), salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function signToken(payload, expiresInSec = 60 * 60 * 24 * 7) {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const body = b64url({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSec });
  const sig = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ success: false, message: "Sesi berakhir, silakan login kembali" });
  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "administrator") {
    return res.status(403).json({ success: false, message: "Hanya Administrator yang memiliki akses ini" });
  }
  next();
}

// ==========================================
// 3. DATABASE AUTO-MIGRATION & SETTINGS HELPER
// ==========================================
async function safeAlter(sql) {
  try {
    await db.query(sql);
  } catch (e) {
    if (!["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_CANT_DROP_FIELD_OR_KEY"].includes(e.code)) {
      console.warn("[migrate]", e.message);
    }
  }
}

async function initSchema() {
  await db.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('administrator','petugas') NOT NULL DEFAULT 'petugas',
    status ENUM('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS settings (
    key_name VARCHAR(64) PRIMARY KEY,
    value_text TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    visit_date DATE NOT NULL,
    check_in TIME NOT NULL,
    check_out TIME NULL,
    purpose VARCHAR(60) NOT NULL DEFAULT 'Membaca Buku',
    note VARCHAR(250),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    INDEX idx_visits_date (visit_date)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS procurement_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    priority ENUM('Tinggi','Sedang','Rendah') DEFAULT 'Sedang',
    funding_source ENUM('Pembelian','Donasi','Hibah','Program/Kerja Sama') DEFAULT 'Pembelian',
    estimated_price INT DEFAULT 0,
    status ENUM('usulan','disetujui','dalam_proses','diterima','ditolak') DEFAULT 'usulan',
    note VARCHAR(250),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_date DATE NOT NULL,
    supplier VARCHAR(150) NOT NULL,
    invoice_no VARCHAR(60),
    funding_source VARCHAR(80) DEFAULT 'Dana Perpustakaan',
    payment_method VARCHAR(30) DEFAULT 'Tunai',
    total_amount INT DEFAULT 0,
    note VARCHAR(250),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price INT NOT NULL DEFAULT 0,
    subtotal INT NOT NULL DEFAULT 0,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    received_date DATE NOT NULL,
    donor_name VARCHAR(150) NOT NULL,
    donor_type VARCHAR(60) DEFAULT 'Alumni',
    contact VARCHAR(60),
    donation_type VARCHAR(60) DEFAULT 'Buku',
    note VARCHAR(250),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS donation_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donation_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    condition_status ENUM('Baik','Kurang Baik','Rusak') DEFAULT 'Baik',
    FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    status ENUM('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await safeAlter("ALTER TABLE categories ADD COLUMN icon VARCHAR(40) DEFAULT 'book'");
  await safeAlter("ALTER TABLE shelves ADD COLUMN category_id INT NULL");
  await safeAlter("ALTER TABLE books ADD COLUMN acquisition_source ENUM('Pembelian','Donasi','Hibah','Program/Kerja Sama') DEFAULT 'Pembelian'");
  await safeAlter("ALTER TABLE books MODIFY COLUMN `condition` ENUM('baik','kurang_baik','rusak','hilang') DEFAULT 'baik'");
  await safeAlter("ALTER TABLE members ADD COLUMN photo VARCHAR(255) NULL");
  await safeAlter("ALTER TABLE members ADD COLUMN phone VARCHAR(30) NULL");
  await safeAlter("ALTER TABLE members ADD COLUMN address VARCHAR(255) NULL");
  await safeAlter("ALTER TABLE loans ADD COLUMN user_id INT NULL");
  await safeAlter("ALTER TABLE loans ADD COLUMN damage_fine INT NOT NULL DEFAULT 0");
  await safeAlter("ALTER TABLE loans ADD COLUMN fine_paid TINYINT(1) DEFAULT 0");
  await safeAlter("ALTER TABLE loans ADD COLUMN payment_method VARCHAR(30) DEFAULT 'Tunai'");
  await safeAlter("ALTER TABLE loans ADD COLUMN fine_payment_method VARCHAR(30) DEFAULT 'Tunai'");
  await safeAlter("ALTER TABLE loans ADD COLUMN extend_count INT DEFAULT 0");
  await safeAlter("ALTER TABLE loans ADD COLUMN return_note VARCHAR(250) NULL");
  await safeAlter("ALTER TABLE loan_items ADD COLUMN returned_at DATE NULL");
  await safeAlter("ALTER TABLE loan_items ADD COLUMN fine INT DEFAULT 0");

  // Fix typo Pskestren -> Poskestren & seed default rooms if empty
  await db.query("UPDATE members SET room='Poskestren' WHERE room='Pskestren'");
  const [[{ roomCnt }]] = await db.query("SELECT COUNT(*) roomCnt FROM rooms");
  if (!roomCnt) {
    await db.query("INSERT IGNORE INTO rooms (name, description) VALUES ?", [[
      ["Asatidz", "Kamar / Kediaman Asatidz"],
      ["Pengurus 1", "Kamar Pengurus 1"],
      ["Pengurus 2", "Kamar Pengurus 2"],
      ["Poskestren", "Pos Kesehatan Pesantren"],
      ["Abu Bakar", "Asrama Santri Abu Bakar"],
      ["Umar", "Asrama Santri Umar"],
      ["Utsman", "Asrama Santri Utsman"],
      ["Ali", "Asrama Santri Ali"],
      ["Bilal", "Asrama Santri Bilal"],
      ["Hamzah", "Asrama Santri Hamzah"],
      ["Hasan", "Asrama Santri Hasan"],
      ["Husein", "Asrama Santri Husein"],
      ["Tahfid", "Asrama Santri Tahfid"],
    ]]);
    await db.query("INSERT IGNORE INTO rooms (name) SELECT DISTINCT TRIM(room) FROM members WHERE room IS NOT NULL AND TRIM(room) <> ''");
  }

  const [[{ cnt }]] = await db.query("SELECT COUNT(*) cnt FROM users");
  if (!cnt) {
    await db.query("INSERT INTO users (name, username, password_hash, role, status) VALUES ?", [[
      ["Admin Perpustakaan", "admin", hashPassword("admin123"), "administrator", "aktif"],
      ["Petugas 1", "petugas1", hashPassword("petugas123"), "petugas", "aktif"],
      ["Petugas 2", "petugas2", hashPassword("petugas123"), "petugas", "aktif"],
    ]]);
  }

  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query("INSERT IGNORE INTO settings (key_name, value_text) VALUES (?, ?)", [k, v]);
  }
}

async function getSettingsMap() {
  const [rows] = await db.query("SELECT key_name, value_text FROM settings");
  const map = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.key_name] = r.value_text;
  return map;
}

// ==========================================
// 4. PUBLIC, AUTH & USERS ROUTES
// ==========================================
app.get("/api/health", (_req, res) => res.json({ success: true, app: "ATH Library API" }));

app.post("/api/auth/login", wrap(async (req, res) => {
  const username = clean(req.body.username);
  const password = String(req.body.password ?? "");
  const remember = !!req.body.remember;
  if (!username || !password) throw bad("Username dan password wajib diisi");

  const [[user]] = await db.query("SELECT * FROM users WHERE username=?", [username]);
  if (!user || !verifyPassword(password, user.password_hash)) throw bad("Username atau password salah", 401);
  if (user.status !== "aktif") throw bad("Akun Anda sedang dinonaktifkan", 403);

  const payload = { id: user.id, name: user.name, username: user.username, role: user.role };
  const token = signToken(payload, remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24);
  res.json({ success: true, data: { token, user: payload } });
}));

app.get("/api/auth/me", authMiddleware, wrap(async (req, res) => {
  const [[user]] = await db.query("SELECT id, name, username, role, status, created_at FROM users WHERE id=?", [req.user.id]);
  if (!user) throw bad("Pengguna tidak ditemukan", 404);
  res.json({ success: true, data: user });
}));

app.put("/api/auth/change-password", authMiddleware, wrap(async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) throw bad("Password lama dan baru wajib diisi");
  if (String(new_password).length < 6) throw bad("Password baru minimal 6 karakter");

  const [[user]] = await db.query("SELECT * FROM users WHERE id=?", [req.user.id]);
  if (!user || !verifyPassword(old_password, user.password_hash)) throw bad("Password lama tidak sesuai");
  await db.query("UPDATE users SET password_hash=? WHERE id=?", [hashPassword(new_password), req.user.id]);
  res.json({ success: true, message: "Password berhasil diubah" });
}));

app.get("/api/users", authMiddleware, wrap(async (_req, res) => {
  const [rows] = await db.query("SELECT id, name, username, role, status, created_at FROM users ORDER BY id ASC");
  res.json({ success: true, data: rows });
}));

app.post("/api/users", authMiddleware, adminOnly, wrap(async (req, res) => {
  const name = clean(req.body.name);
  const username = clean(req.body.username);
  const password = String(req.body.password || "petugas123");
  const role = req.body.role === "administrator" ? "administrator" : "petugas";
  const status = req.body.status === "tidak_aktif" ? "tidak_aktif" : "aktif";
  if (!name || !username) throw bad("Nama dan username wajib diisi");
  if (password.length < 6) throw bad("Password minimal 6 karakter");

  const [r] = await db.query(
    "INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
    [name, username, hashPassword(password), role, status]
  );
  res.status(201).json({ success: true, id: r.insertId });
}));

app.put("/api/users/:id", authMiddleware, adminOnly, wrap(async (req, res) => {
  const name = clean(req.body.name);
  const username = clean(req.body.username);
  const role = req.body.role === "administrator" ? "administrator" : "petugas";
  const status = req.body.status === "tidak_aktif" ? "tidak_aktif" : "aktif";
  if (!name || !username) throw bad("Nama dan username wajib diisi");

  const updates = { name, username, role, status };
  if (req.body.password && String(req.body.password).trim().length > 0) {
    if (String(req.body.password).length < 6) throw bad("Password minimal 6 karakter");
    updates.password_hash = hashPassword(req.body.password);
  }
  const [r] = await db.query("UPDATE users SET ? WHERE id=?", [updates, req.params.id]);
  if (!r.affectedRows) throw bad("Pengguna tidak ditemukan", 404);
  res.json({ success: true });
}));

app.delete("/api/users/:id", authMiddleware, adminOnly, wrap(async (req, res) => {
  if (+req.params.id === req.user.id) throw bad("Tidak dapat menghapus akun sendiri");
  const [r] = await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
  if (!r.affectedRows) throw bad("Pengguna tidak ditemukan", 404);
  res.json({ success: true });
}));

// ==========================================
// 5. SETTINGS, LOGO & BACKUP/RESTORE (Page 14)
// ==========================================
app.get("/api/settings/public", wrap(async (_req, res) => {
  const s = await getSettingsMap();
  res.json({
    success: true,
    data: {
      library_name: s.library_name,
      app_title: s.app_title,
      app_subtitle: s.app_subtitle,
      institution_name: s.institution_name,
      address: s.address,
      logo: s.logo,
      mode: s.mode,
    },
  });
}));

app.get("/api/settings", authMiddleware, wrap(async (_req, res) => {
  const settings = await getSettingsMap();
  const [[summary]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM categories) AS total_categories,
      (SELECT COUNT(*) FROM shelves) AS total_shelves,
      (SELECT COUNT(*) FROM users) AS total_users
  `);
  res.json({ success: true, data: { settings, summary } });
}));

app.put("/api/settings", authMiddleware, wrap(async (req, res) => {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (req.body[key] !== undefined) {
      await db.query(
        "INSERT INTO settings (key_name, value_text) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)",
        [key, clean(req.body[key])]
      );
    }
  }
  res.json({ success: true, data: await getSettingsMap() });
}));

app.post("/api/settings/logo", authMiddleware, upload.single("logo"), wrap(async (req, res) => {
  if (!req.file) throw bad("Pilih file gambar logo (JPG/PNG, maks 2MB)");
  await db.query(
    "INSERT INTO settings (key_name, value_text) VALUES ('logo', ?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)",
    [req.file.filename]
  );
  res.json({ success: true, logo: req.file.filename });
}));

app.post("/api/settings/reset", authMiddleware, adminOnly, wrap(async (_req, res) => {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query("INSERT INTO settings (key_name, value_text) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)", [k, v]);
  }
  res.json({ success: true, data: DEFAULT_SETTINGS });
}));

app.get("/api/settings/backup", authMiddleware, adminOnly, wrap(async (_req, res) => {
  const tables = ["settings", "rooms", "categories", "shelves", "books", "members", "loans", "loan_items", "visits", "procurement_plans", "purchases", "purchase_items", "donations", "donation_items"];
  const backup = { exported_at: new Date().toISOString(), app: "ATH Library", tables: {} };
  for (const t of tables) {
    const [rows] = await db.query(`SELECT * FROM ${t}`);
    backup.tables[t] = rows;
  }
  res.json({ success: true, data: backup });
}));

app.post("/api/settings/restore", authMiddleware, adminOnly, wrap(async (req, res) => {
  const payload = req.body?.tables;
  if (!payload || typeof payload !== "object") throw bad("Format file backup tidak valid");
  if (Array.isArray(payload.settings)) {
    for (const s of payload.settings) {
      if (s.key_name) {
        await db.query("INSERT INTO settings (key_name, value_text) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)", [s.key_name, s.value_text ?? ""]);
      }
    }
  }
  res.json({ success: true, message: "Konfigurasi berhasil dipulihkan dari backup" });
}));

// ==========================================
// 6. CATALOG: BOOKS, CATEGORIES & SHELVES (Pages 2-5)
// ==========================================
const syncBook = async (id) => {
  await db.query("UPDATE books SET inventory_code=CONCAT('ATH-',LPAD(id,4,'0')) WHERE id=? AND (inventory_code IS NULL OR inventory_code='')", [id]);
  await db.query(
    `UPDATE books SET available=GREATEST(copies-(SELECT COUNT(*) FROM loan_items li JOIN loans l ON l.id=li.loan_id WHERE li.book_id=books.id AND l.status='borrowed' AND li.returned_at IS NULL),0) WHERE id=?`,
    [id]
  );
};

app.get("/api/books/stats", authMiddleware, wrap(async (_req, res) => {
  const [[row]] = await db.query(`
    SELECT
      COUNT(*) AS total_titles,
      COALESCE(SUM(copies), 0) AS total_copies,
      COALESCE(SUM(available), 0) AS available_copies,
      COALESCE(SUM(GREATEST(copies - available, 0)), 0) AS borrowed_copies,
      SUM(CASE WHEN \`condition\`='rusak' THEN 1 ELSE 0 END) AS damaged_books,
      SUM(CASE WHEN \`condition\`='hilang' THEN 1 ELSE 0 END) AS lost_books
    FROM books WHERE deleted_at IS NULL
  `);
  res.json({ success: true, data: row });
}));

app.get("/api/books/next-code", authMiddleware, wrap(async (_req, res) => {
  const [[{ next_id }]] = await db.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM books");
  const code = `ATH-${String(next_id).padStart(4, "0")}`;
  res.json({ success: true, data: { code } });
}));

app.get("/api/books/code/:code", authMiddleware, wrap(async (req, res) => {
  const code = clean(req.params.code);
  const [[b]] = await db.query(
    `SELECT b.*, c.name category_name, sh.code shelf_code, sh.name shelf_name
     FROM books b JOIN categories c ON c.id=b.category_id JOIN shelves sh ON sh.id=b.shelf_id
     WHERE (b.inventory_code=? OR b.isbn=? OR REPLACE(COALESCE(b.isbn,''),'-','')=REPLACE(?,'-','')) AND b.deleted_at IS NULL LIMIT 1`,
    [code, code, code]
  );
  if (!b) throw bad("Buku tidak ditemukan", 404);
  res.json({ success: true, data: b });
}));

app.get("/api/books/:id/qr", authMiddleware, wrap(async (req, res) => {
  const [[b]] = await db.query("SELECT id, inventory_code, title, author FROM books WHERE id=?", [req.params.id]);
  if (!b) throw bad("Buku tidak ditemukan", 404);
  res.json({ success: true, data: { id: b.id, code: b.inventory_code, title: b.title, author: b.author } });
}));

app.post("/api/books/qr-batch", authMiddleware, wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  const [rows] = ids.length
    ? await db.query("SELECT id, inventory_code, title, author FROM books WHERE id IN (?) AND deleted_at IS NULL", [ids])
    : await db.query("SELECT id, inventory_code, title, author FROM books WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 30");
  const items = rows.map((b) => ({ id: b.id, code: b.inventory_code, title: b.title, author: b.author }));
  res.json({ success: true, data: items });
}));

app.post("/api/books/import", authMiddleware, wrap(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw bad("Tidak ada data untuk diimpor");
  const [[defCat]] = await db.query("SELECT id FROM categories ORDER BY id ASC LIMIT 1");
  const [[defShelf]] = await db.query("SELECT id FROM shelves ORDER BY id ASC LIMIT 1");
  let imported = 0;
  for (const r of rows) {
    const title = clean(r.title || r.judul);
    const author = clean(r.author || r.penulis);
    if (!title || !author) continue;
    const copies = Math.max(Number(r.copies || r.eksemplar || 1) || 1, 1);
    const [ins] = await db.query("INSERT INTO books SET ?", [{
      title,
      author,
      publisher: clean(r.publisher || r.penerbit) || null,
      year: Number(r.year || r.tahun) || null,
      isbn: clean(r.isbn) || null,
      category_id: Number(r.category_id) || defCat?.id || 1,
      subcategory: clean(r.subcategory || r.subkategori) || null,
      shelf_id: Number(r.shelf_id) || defShelf?.id || 1,
      language: clean(r.language || r.bahasa) || "Indonesia",
      acquisition_source: clean(r.acquisition_source || r.sumber) || "Pembelian",
      copies,
      available: copies,
      condition: "baik",
    }]);
    await syncBook(ins.insertId);
    imported++;
  }
  res.json({ success: true, imported, message: `${imported} buku berhasil diimpor` });
}));

app.get("/api/books", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 10, 1), 200);
  const where = [`b.deleted_at IS ${req.query.deleted ? "NOT NULL" : "NULL"}`];
  const p = [];

  if (req.query.search) {
    where.push("(b.title LIKE ? OR b.author LIKE ? OR b.publisher LIKE ? OR b.isbn LIKE ? OR b.inventory_code LIKE ?)");
    const q = `%${req.query.search}%`;
    p.push(q, q, q, q, q);
  }
  if (req.query.category_id) { where.push("b.category_id=?"); p.push(req.query.category_id); }
  if (req.query.shelf_id) { where.push("b.shelf_id=?"); p.push(req.query.shelf_id); }
  if (req.query.language) { where.push("b.language=?"); p.push(req.query.language); }
  if (req.query.status === "tersedia") where.push("b.available > 0 AND b.`condition` NOT IN ('rusak','hilang')");
  if (req.query.status === "dipinjam") where.push("b.available = 0 AND b.`condition` NOT IN ('rusak','hilang')");
  if (req.query.status === "rusak") where.push("b.`condition`='rusak'");
  if (req.query.status === "hilang") where.push("b.`condition`='hilang'");

  const sortCols = ["id", "title", "author", "year", "created_at", "inventory_code"];
  const sort = sortCols.includes(req.query.sortBy) ? `b.${req.query.sortBy}` : "b.id";
  const dir = req.query.order === "desc" ? "DESC" : "ASC";
  const W = where.join(" AND ");

  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM books b WHERE ${W}`, p);
  const [rows] = await db.query(
    `SELECT b.*, c.name category_name, sh.code shelf_code, sh.name shelf_name
     FROM books b JOIN categories c ON c.id=b.category_id JOIN shelves sh ON sh.id=b.shelf_id
     WHERE ${W} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]
  );
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.get("/api/books/:id", authMiddleware, wrap(async (req, res) => {
  const [[b]] = await db.query(
    `SELECT b.*, c.name category_name, sh.code shelf_code, sh.name shelf_name
     FROM books b JOIN categories c ON c.id=b.category_id JOIN shelves sh ON sh.id=b.shelf_id WHERE b.id=?`,
    [req.params.id]
  );
  if (!b) throw bad("Buku tidak ditemukan", 404);
  res.json({ success: true, data: b });
}));

const BOOK_FIELDS = [
  "inventory_code", "title", "author", "publisher", "year", "isbn", "category_id",
  "subcategory", "shelf_id", "language", "acquisition_source", "copies", "condition", "note",
];

function extractBookPayload(req) {
  const d = {};
  for (const f of BOOK_FIELDS) if (req.body[f] !== undefined) d[f] = clean(req.body[f]) || null;
  if (!d.title || !d.author || !d.category_id || !d.shelf_id) throw bad("Judul, Penulis, Kategori, dan Lokasi Rak wajib diisi");
  d.copies = Math.max(Number(d.copies) || 1, 1);
  if (req.file) d.cover = req.file.filename;
  else if (req.body.remove_cover === "1") d.cover = null;
  return d;
}

app.post("/api/books", authMiddleware, upload.single("cover"), wrap(async (req, res) => {
  const d = extractBookPayload(req);
  d.available = d.copies;
  const [x] = await db.query("INSERT INTO books SET ?", [d]);
  await syncBook(x.insertId);
  const [[created]] = await db.query("SELECT * FROM books WHERE id=?", [x.insertId]);
  res.status(201).json({ success: true, id: x.insertId, data: created });
}));

app.put("/api/books/:id", authMiddleware, upload.single("cover"), wrap(async (req, res) => {
  const d = extractBookPayload(req);
  const [x] = await db.query("UPDATE books SET ? WHERE id=?", [d, req.params.id]);
  if (!x.affectedRows) throw bad("Buku tidak ditemukan", 404);
  await syncBook(+req.params.id);
  res.json({ success: true });
}));

app.delete("/api/books/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("UPDATE books SET deleted_at=NOW() WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Buku tidak ditemukan", 404);
  res.json({ success: true });
}));

app.put("/api/books/:id/restore", authMiddleware, wrap(async (req, res) => {
  await db.query("UPDATE books SET deleted_at=NULL WHERE id=?", [req.params.id]);
  res.json({ success: true });
}));

// ---- Categories ----
app.get("/api/categories/tree", authMiddleware, wrap(async (_req, res) => {
  const [cats] = await db.query(`
    SELECT c.id, c.name, c.icon,
      (SELECT COUNT(*) FROM books b WHERE b.category_id=c.id AND b.deleted_at IS NULL) total_titles
    FROM categories c ORDER BY c.id ASC
  `);
  const [subs] = await db.query(`
    SELECT category_id, COALESCE(NULLIF(TRIM(subcategory), ''), 'Lainnya') AS sub_name, COUNT(*) AS total
    FROM books WHERE deleted_at IS NULL GROUP BY category_id, sub_name ORDER BY total DESC
  `);
  res.json({ success: true, data: cats.map((c) => ({ ...c, subcategories: subs.filter((s) => s.category_id === c.id) })) });
}));

app.get("/api/categories", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 20, 1), 100);
  const where = [], p = [];
  if (req.query.search) { where.push("c.name LIKE ?"); p.push(`%${req.query.search}%`); }
  const W = where.length ? where.join(" AND ") : "1=1";
  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM categories c WHERE ${W}`, p);
  const [rows] = await db.query(
    `SELECT c.*,
      (SELECT COUNT(*) FROM books b WHERE b.category_id=c.id AND b.deleted_at IS NULL) total_titles,
      (SELECT COALESCE(SUM(copies),0) FROM books b WHERE b.category_id=c.id AND b.deleted_at IS NULL) total_copies
     FROM categories c WHERE ${W} ORDER BY c.id ASC LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]
  );
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.post("/api/categories", authMiddleware, wrap(async (req, res) => {
  const name = clean(req.body.name);
  if (!name) throw bad("Nama kategori wajib diisi");
  const [x] = await db.query("INSERT INTO categories SET ?", [{ name, description: clean(req.body.description) || null, icon: clean(req.body.icon) || "book" }]);
  res.status(201).json({ success: true, id: x.insertId });
}));

app.put("/api/categories/:id", authMiddleware, wrap(async (req, res) => {
  const name = clean(req.body.name);
  if (!name) throw bad("Nama kategori wajib diisi");
  const [x] = await db.query("UPDATE categories SET ? WHERE id=?", [{ name, description: clean(req.body.description) || null, icon: clean(req.body.icon) || "book" }, req.params.id]);
  if (!x.affectedRows) throw bad("Kategori tidak ditemukan", 404);
  res.json({ success: true });
}));

app.delete("/api/categories/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("DELETE FROM categories WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Kategori tidak ditemukan", 404);
  res.json({ success: true });
}));

// ---- Shelves ----
app.get("/api/shelves/stats", authMiddleware, wrap(async (_req, res) => {
  const [[s]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM shelves) AS total_shelves,
      COALESCE(SUM(copies), 0) AS total_copies,
      COALESCE(SUM(available), 0) AS available_copies,
      COALESCE(SUM(GREATEST(copies - available, 0)), 0) AS borrowed_copies
    FROM books WHERE deleted_at IS NULL
  `);
  const [dist] = await db.query(`
    SELECT sh.id, sh.code, sh.name, COALESCE(SUM(b.copies), 0) AS total_copies
    FROM shelves sh LEFT JOIN books b ON b.shelf_id=sh.id AND b.deleted_at IS NULL
    GROUP BY sh.id ORDER BY total_copies DESC LIMIT 6
  `);
  res.json({ success: true, data: { ...s, avg_per_shelf: s.total_shelves ? Math.round(s.total_copies / s.total_shelves) : 0, distribution: dist } });
}));

app.get("/api/shelves", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 20, 1), 100);
  const where = [], p = [];
  if (req.query.search) { where.push("(sh.code LIKE ? OR sh.name LIKE ?)"); p.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  if (req.query.category_id) { where.push("sh.category_id=?"); p.push(req.query.category_id); }
  const W = where.length ? where.join(" AND ") : "1=1";
  const sort = ["code", "name", "id"].includes(req.query.sortBy) ? `sh.${req.query.sortBy}` : "sh.code";
  const dir = req.query.order === "desc" ? "DESC" : "ASC";

  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM shelves sh WHERE ${W}`, p);
  const [rows] = await db.query(
    `SELECT sh.*, c.name category_name,
      (SELECT COUNT(*) FROM books b WHERE b.shelf_id=sh.id AND b.deleted_at IS NULL) total_titles,
      (SELECT COALESCE(SUM(copies),0) FROM books b WHERE b.shelf_id=sh.id AND b.deleted_at IS NULL) total_copies
     FROM shelves sh LEFT JOIN categories c ON c.id=sh.category_id
     WHERE ${W} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]
  );
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.post("/api/shelves", authMiddleware, wrap(async (req, res) => {
  const code = clean(req.body.code), name = clean(req.body.name);
  if (!code || !name) throw bad("Kode dan nama rak wajib diisi");
  const [x] = await db.query("INSERT INTO shelves SET ?", [{ code, name, category_id: req.body.category_id || null }]);
  res.status(201).json({ success: true, id: x.insertId });
}));

app.put("/api/shelves/:id", authMiddleware, wrap(async (req, res) => {
  const code = clean(req.body.code), name = clean(req.body.name);
  if (!code || !name) throw bad("Kode dan nama rak wajib diisi");
  const [x] = await db.query("UPDATE shelves SET ? WHERE id=?", [{ code, name, category_id: req.body.category_id || null }, req.params.id]);
  if (!x.affectedRows) throw bad("Rak tidak ditemukan", 404);
  res.json({ success: true });
}));

app.delete("/api/shelves/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("DELETE FROM shelves WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Rak tidak ditemukan", 404);
  res.json({ success: true });
}));

// ==========================================
// 7. MEMBERS (Page 6)
// ==========================================
app.get("/api/members/stats", authMiddleware, wrap(async (_req, res) => {
  const [[row]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN type='santri' THEN 1 ELSE 0 END) AS santri,
      SUM(CASE WHEN type='ustadz' THEN 1 ELSE 0 END) AS ustadz,
      SUM(CASE WHEN type='pengurus' THEN 1 ELSE 0 END) AS pengurus,
      SUM(CASE WHEN status='aktif' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status='tidak_aktif' THEN 1 ELSE 0 END) AS inactive
    FROM members
  `);
  res.json({ success: true, data: row });
}));

app.get("/api/members", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 10, 1), 200);
  const where = [], p = [];
  if (req.query.search) {
    where.push("(m.name LIKE ? OR m.member_no LIKE ? OR m.room LIKE ?)");
    const q = `%${req.query.search}%`;
    p.push(q, q, q);
  }
  for (const f of ["room", "level", "type", "status"]) {
    if (req.query[f]) { where.push(`m.${f}=?`); p.push(req.query[f]); }
  }
  const W = where.length ? where.join(" AND ") : "1=1";
  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM members m WHERE ${W}`, p);
  const [rows] = await db.query(`SELECT m.* FROM members m WHERE ${W} ORDER BY m.id ASC LIMIT ? OFFSET ?`, [...p, limit, (page - 1) * limit]);
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.get("/api/members/:id/detail", authMiddleware, wrap(async (req, res) => {
  const [[member]] = await db.query("SELECT * FROM members WHERE id=?", [req.params.id]);
  if (!member) throw bad("Anggota tidak ditemukan", 404);

  const [loans] = await db.query(
    `SELECT l.*,
      IF(l.status='borrowed' AND l.due_date<CURDATE(),'overdue',l.status) display_status,
      (SELECT GROUP_CONCAT(b.title SEPARATOR ', ') FROM loan_items li JOIN books b ON b.id=li.book_id WHERE li.loan_id=l.id) titles
     FROM loans l WHERE l.member_id=? ORDER BY l.loan_date DESC, l.id DESC LIMIT 20`,
    [member.id]
  );
  const [payments] = await db.query(
    `SELECT l.id, l.trx_no, l.loan_date, l.return_date, l.fee, l.fine, l.paid, l.fine_paid, l.payment_method
     FROM loans l WHERE l.member_id=? ORDER BY l.created_at DESC LIMIT 20`,
    [member.id]
  );
  res.json({ success: true, data: { member, loans, payments } });
}));

app.post("/api/members/import", authMiddleware, wrap(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw bad("Tidak ada data anggota untuk diimpor");
  let imported = 0;
  for (const r of rows) {
    const name = clean(r.name || r.nama);
    const member_no = clean(r.member_no || r.no_anggota);
    const entry_year = Number(r.entry_year || r.tahun_masuk) || new Date().getFullYear();
    if (!name || !member_no) continue;
    try {
      await db.query("INSERT INTO members SET ?", [{
        name, member_no, entry_year,
        room: clean(r.room || r.kamar) || null,
        level: clean(r.level || r.jenjang) || null,
        type: ["santri", "pengurus", "ustadz"].includes(r.type) ? r.type : "santri",
        status: r.status === "tidak_aktif" ? "tidak_aktif" : "aktif",
        phone: clean(r.phone || r.hp) || null,
      }]);
      imported++;
    } catch { /* skip duplicate */ }
  }
  res.json({ success: true, imported, message: `${imported} anggota berhasil diimpor` });
}));

function extractMember(req) {
  const fields = ["name", "member_no", "entry_year", "room", "level", "type", "status", "phone", "address"];
  const d = {};
  for (const f of fields) if (req.body[f] !== undefined) d[f] = clean(req.body[f]) || null;
  if (!d.name || !d.member_no || !d.entry_year) throw bad("Nama, No. Anggota, dan Tahun Masuk wajib diisi");
  if (req.file) d.photo = req.file.filename;
  return d;
}

app.post("/api/members", authMiddleware, upload.single("photo"), wrap(async (req, res) => {
  const [x] = await db.query("INSERT INTO members SET ?", [extractMember(req)]);
  res.status(201).json({ success: true, id: x.insertId });
}));

app.put("/api/members/:id", authMiddleware, upload.single("photo"), wrap(async (req, res) => {
  const [x] = await db.query("UPDATE members SET ? WHERE id=?", [extractMember(req), req.params.id]);
  if (!x.affectedRows) throw bad("Anggota tidak ditemukan", 404);
  res.json({ success: true });
}));

app.delete("/api/members/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("DELETE FROM members WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Anggota tidak ditemukan", 404);
  res.json({ success: true });
}));

// ---- Rooms / Data Kamar ----
app.get("/api/rooms", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 50, 1), 200);
  const where = [], p = [];
  if (req.query.search) { where.push("(r.name LIKE ? OR r.description LIKE ?)"); p.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  if (req.query.status) { where.push("r.status=?"); p.push(req.query.status); }
  const W = where.length ? where.join(" AND ") : "1=1";
  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM rooms r WHERE ${W}`, p);
  const [rows] = await db.query(
    `SELECT r.*, (SELECT COUNT(*) FROM members m WHERE m.room = r.name) AS total_members
     FROM rooms r WHERE ${W} ORDER BY r.id ASC LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]
  );
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.post("/api/rooms", authMiddleware, wrap(async (req, res) => {
  const name = clean(req.body.name);
  if (!name) throw bad("Nama kamar wajib diisi");
  const status = req.body.status === "tidak_aktif" ? "tidak_aktif" : "aktif";
  const [x] = await db.query("INSERT INTO rooms SET ?", [{ name, description: clean(req.body.description) || null, status }]);
  res.status(201).json({ success: true, id: x.insertId, name });
}));

app.put("/api/rooms/:id", authMiddleware, wrap(async (req, res) => {
  const name = clean(req.body.name);
  if (!name) throw bad("Nama kamar wajib diisi");
  const status = req.body.status === "tidak_aktif" ? "tidak_aktif" : "aktif";
  const [[existing]] = await db.query("SELECT * FROM rooms WHERE id=?", [req.params.id]);
  if (!existing) throw bad("Kamar tidak ditemukan", 404);

  await db.query("UPDATE rooms SET ? WHERE id=?", [{ name, description: clean(req.body.description) || null, status }, req.params.id]);
  if (existing.name !== name) {
    await db.query("UPDATE members SET room=? WHERE room=?", [name, existing.name]);
  }
  res.json({ success: true });
}));

app.delete("/api/rooms/:id", authMiddleware, wrap(async (req, res) => {
  const [[existing]] = await db.query("SELECT * FROM rooms WHERE id=?", [req.params.id]);
  if (!existing) throw bad("Kamar tidak ditemukan", 404);
  const [[{ used }]] = await db.query("SELECT COUNT(*) used FROM members WHERE room=?", [existing.name]);
  if (used > 0) throw bad(`Kamar "${existing.name}" masih digunakan oleh ${used} anggota`, 409);
  await db.query("DELETE FROM rooms WHERE id=?", [req.params.id]);
  res.json({ success: true });
}));

// ==========================================
// 8. LOANS: PEMINJAMAN, PENGEMBALIAN & PERPANJANGAN (Pages 7-8)
// ==========================================
app.get("/api/loans", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 10, 1), 200);
  const where = [], p = [];

  if (req.query.search) {
    where.push("(l.trx_no LIKE ? OR m.name LIKE ? OR m.member_no LIKE ?)");
    const q = `%${req.query.search}%`;
    p.push(q, q, q);
  }
  if (req.query.status === "overdue") where.push("l.status='borrowed' AND l.due_date < CURDATE()");
  else if (req.query.status) { where.push("l.status=?"); p.push(req.query.status); }
  if (req.query.member_id) { where.push("l.member_id=?"); p.push(req.query.member_id); }
  if (req.query.paid !== undefined && req.query.paid !== "") { where.push("l.paid=?"); p.push(+req.query.paid); }
  if (req.query.from) { where.push("l.loan_date >= ?"); p.push(req.query.from); }
  if (req.query.to) { where.push("l.loan_date <= ?"); p.push(req.query.to); }

  const W = where.length ? where.join(" AND ") : "1=1";
  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM loans l JOIN members m ON m.id=l.member_id WHERE ${W}`, p);
  const [rows] = await db.query(
    `SELECT l.*, m.name member_name, m.member_no, m.level member_level, m.room member_room, m.photo member_photo,
      COALESCE(u.name, 'Admin') officer_name,
      IF(l.status='borrowed' AND l.due_date < CURDATE(), 'overdue', l.status) display_status,
      (SELECT COUNT(*) FROM loan_items li WHERE li.loan_id=l.id) book_count,
      (SELECT GROUP_CONCAT(b.title SEPARATOR ', ') FROM loan_items li JOIN books b ON b.id=li.book_id WHERE li.loan_id=l.id) titles
     FROM loans l JOIN members m ON m.id=l.member_id LEFT JOIN users u ON u.id=l.user_id
     WHERE ${W} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]
  );
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.get("/api/loans/active-by-member/:memberId", authMiddleware, wrap(async (req, res) => {
  const settings = await getSettingsMap();
  const finePerDay = Number(settings.fine_per_day) || 2000;
  const [items] = await db.query(
    `SELECT l.id AS loan_id, l.trx_no, l.loan_date, l.due_date, l.paid, l.extended, l.extend_count,
      b.id AS book_id, b.inventory_code, b.title, b.author, li.returned_at
     FROM loans l JOIN loan_items li ON li.loan_id=l.id JOIN books b ON b.id=li.book_id
     WHERE l.member_id=? AND l.status='borrowed' AND li.returned_at IS NULL ORDER BY l.due_date ASC`,
    [req.params.memberId]
  );
  res.json({ success: true, data: items, fine_per_day: finePerDay });
}));

app.get("/api/loans/active-by-code/:code", authMiddleware, wrap(async (req, res) => {
  const code = clean(req.params.code);
  const [[item]] = await db.query(
    `SELECT l.id AS loan_id, l.trx_no, l.member_id, l.loan_date, l.due_date,
      b.id AS book_id, b.inventory_code, b.title,
      m.name AS member_name, m.member_no, m.level, m.room, m.photo
     FROM loans l JOIN loan_items li ON li.loan_id=l.id JOIN books b ON b.id=li.book_id JOIN members m ON m.id=l.member_id
     WHERE (b.inventory_code=? OR b.isbn=? OR REPLACE(COALESCE(b.isbn,''),'-','')=REPLACE(?,'-','')) AND l.status='borrowed' AND li.returned_at IS NULL ORDER BY l.id DESC LIMIT 1`,
    [code, code, code]
  );
  if (!item) throw bad("Buku ini tidak sedang dalam status dipinjam", 404);
  res.json({ success: true, data: item });
}));

app.get("/api/loans/:id", authMiddleware, wrap(async (req, res) => {
  const [[loan]] = await db.query(
    `SELECT l.*, m.name member_name, m.member_no, m.level member_level, m.room member_room,
      COALESCE(u.name, 'Admin') officer_name,
      IF(l.status='borrowed' AND l.due_date < CURDATE(), 'overdue', l.status) display_status
     FROM loans l JOIN members m ON m.id=l.member_id LEFT JOIN users u ON u.id=l.user_id WHERE l.id=?`,
    [req.params.id]
  );
  if (!loan) throw bad("Transaksi tidak ditemukan", 404);
  const [items] = await db.query(
    `SELECT li.*, b.inventory_code, b.title, b.author FROM loan_items li JOIN books b ON b.id=li.book_id WHERE li.loan_id=?`,
    [loan.id]
  );
  res.json({ success: true, data: { ...loan, items } });
}));

app.post("/api/loans", authMiddleware, wrap(async (req, res) => {
  const settings = await getSettingsMap();
  const maxBooks = Number(settings.max_books) || 3;
  const loanFee = Number(settings.loan_fee) || 2000;

  const { member_id, book_ids, loan_date, due_date, paid, payment_method, note } = req.body;
  if (!member_id || !Array.isArray(book_ids) || !book_ids.length || !loan_date || !due_date) throw bad("Data peminjaman tidak lengkap");
  if (new Set(book_ids).size !== book_ids.length) throw bad("Ada buku yang dipilih ganda");
  if (book_ids.length > maxBooks) throw bad(`Maksimal peminjaman ${maxBooks} buku`);

  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    for (const id of book_ids) {
      const [x] = await cn.query("UPDATE books SET available=available-1 WHERE id=? AND available>0 AND deleted_at IS NULL", [id]);
      if (!x.affectedRows) throw bad("Stok salah satu buku tidak tersedia");
    }
    const fee = loanFee * book_ids.length;
    const [l] = await cn.query("INSERT INTO loans SET ?", [{
      member_id, user_id: req.user?.id || null, loan_date, due_date, fee,
      paid: paid ? 1 : 0, payment_method: clean(payment_method) || "Tunai", note: clean(note) || null,
    }]);
    const trxNo = `PJ-${loan_date.replace(/-/g, "")}-${String(l.insertId).padStart(3, "0")}`;
    await cn.query("UPDATE loans SET trx_no=? WHERE id=?", [trxNo, l.insertId]);
    await cn.query("INSERT INTO loan_items(loan_id, book_id) VALUES ?", [book_ids.map((b) => [l.insertId, b])]);
    await cn.commit();
    res.status(201).json({ success: true, id: l.insertId, trx_no: trxNo, fee });
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}));

app.post("/api/loans/:id/return", authMiddleware, wrap(async (req, res) => {
  const settings = await getSettingsMap();
  const finePerDay = Number(settings.fine_per_day) || 2000;
  const returnDate = clean(req.body.return_date) || new Date().toISOString().slice(0, 10);
  const damageFine = Math.max(Number(req.body.damage_fine) || 0, 0);
  const finePaid = req.body.fine_paid !== undefined ? (req.body.fine_paid ? 1 : 0) : 1;
  const fineMethod = clean(req.body.fine_payment_method) || "Tunai";
  const returnNote = clean(req.body.return_note) || null;
  const selectedBookIds = Array.isArray(req.body.book_ids) && req.body.book_ids.length ? req.body.book_ids.map(Number) : null;

  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    const [[l]] = await cn.query("SELECT * FROM loans WHERE id=? AND status='borrowed' FOR UPDATE", [req.params.id]);
    if (!l) throw bad("Transaksi tidak ditemukan atau sudah dikembalikan", 404);

    const [items] = await cn.query("SELECT book_id FROM loan_items WHERE loan_id=? AND returned_at IS NULL", [l.id]);
    const toReturn = selectedBookIds ? items.filter((i) => selectedBookIds.includes(i.book_id)) : items;
    if (!toReturn.length) throw bad("Tidak ada buku yang dipilih untuk dikembalikan");

    const lateDays = Math.max(Math.ceil((new Date(returnDate) - new Date(l.due_date)) / 864e5), 0);
    const itemFine = lateDays * finePerDay;

    for (const it of toReturn) {
      await cn.query("UPDATE loan_items SET returned_at=?, fine=? WHERE loan_id=? AND book_id=?", [returnDate, itemFine, l.id, it.book_id]);
      await cn.query("UPDATE books SET available=LEAST(available+1, copies) WHERE id=?", [it.book_id]);
    }

    const [[{ remaining }]] = await cn.query("SELECT COUNT(*) remaining FROM loan_items WHERE loan_id=? AND returned_at IS NULL", [l.id]);
    const [[{ sumLateFine }]] = await cn.query("SELECT COALESCE(SUM(fine), 0) sumLateFine FROM loan_items WHERE loan_id=?", [l.id]);
    const totalDamage = Number(l.damage_fine || 0) + damageFine;
    const grandLoanFine = Number(sumLateFine) + totalDamage;

    if (remaining === 0) {
      await cn.query(
        "UPDATE loans SET status='returned', return_date=?, fine=?, damage_fine=?, fine_paid=?, fine_payment_method=?, return_note=? WHERE id=?",
        [returnDate, grandLoanFine, totalDamage, grandLoanFine > 0 ? finePaid : 1, fineMethod, returnNote, l.id]
      );
    } else {
      await cn.query("UPDATE loans SET fine=?, damage_fine=?, fine_paid=?, fine_payment_method=? WHERE id=?", [grandLoanFine, totalDamage, finePaid, fineMethod, l.id]);
    }
    await cn.commit();
    res.json({ success: true, fine: itemFine * toReturn.length + damageFine, damage_fine: damageFine, remaining });
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}));

app.post("/api/loans/return-batch", authMiddleware, wrap(async (req, res) => {
  const settings = await getSettingsMap();
  const finePerDay = Number(settings.fine_per_day) || 2000;
  const { items, return_date, damage_fine, fine_paid, fine_payment_method, return_note } = req.body;
  if (!Array.isArray(items) || !items.length) throw bad("Pilih minimal 1 buku untuk dikembalikan");
  const retDate = clean(return_date) || new Date().toISOString().slice(0, 10);
  const damageFineTotal = Math.max(Number(damage_fine) || 0, 0);

  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    let grandLateFine = 0;
    const touchedLoans = [];

    for (const it of items) {
      const [[loan]] = await cn.query("SELECT * FROM loans WHERE id=? AND status='borrowed' FOR UPDATE", [it.loan_id]);
      if (!loan) continue;
      const [[li]] = await cn.query("SELECT * FROM loan_items WHERE loan_id=? AND book_id=? AND returned_at IS NULL", [it.loan_id, it.book_id]);
      if (!li) continue;
      const late = Math.max(Math.ceil((new Date(retDate) - new Date(loan.due_date)) / 864e5), 0);
      const f = late * finePerDay;
      grandLateFine += f;
      await cn.query("UPDATE loan_items SET returned_at=?, fine=? WHERE loan_id=? AND book_id=?", [retDate, f, it.loan_id, it.book_id]);
      await cn.query("UPDATE books SET available=LEAST(available+1, copies) WHERE id=?", [it.book_id]);
      if (!touchedLoans.includes(it.loan_id)) touchedLoans.push(it.loan_id);
    }

    for (let idx = 0; idx < touchedLoans.length; idx++) {
      const loanId = touchedLoans[idx];
      const [[loanRow]] = await cn.query("SELECT damage_fine FROM loans WHERE id=?", [loanId]);
      const addDamage = idx === 0 ? damageFineTotal : 0;
      const newDamage = Number(loanRow?.damage_fine || 0) + addDamage;
      const [[{ remaining }]] = await cn.query("SELECT COUNT(*) remaining FROM loan_items WHERE loan_id=? AND returned_at IS NULL", [loanId]);
      const [[{ sumLate }]] = await cn.query("SELECT COALESCE(SUM(fine),0) sumLate FROM loan_items WHERE loan_id=?", [loanId]);
      const totalLoanFine = Number(sumLate) + newDamage;

      if (remaining === 0) {
        await cn.query(
          "UPDATE loans SET status='returned', return_date=?, fine=?, damage_fine=?, fine_paid=?, fine_payment_method=?, return_note=? WHERE id=?",
          [retDate, totalLoanFine, newDamage, totalLoanFine > 0 ? (fine_paid ? 1 : 0) : 1, clean(fine_payment_method) || "Tunai", clean(return_note) || null, loanId]
        );
      } else {
        await cn.query("UPDATE loans SET fine=?, damage_fine=?, fine_paid=?, fine_payment_method=? WHERE id=?", [totalLoanFine, newDamage, fine_paid ? 1 : 0, clean(fine_payment_method) || "Tunai", loanId]);
      }
    }
    await cn.commit();
    res.json({ success: true, total_fine: grandLateFine + damageFineTotal, late_fine: grandLateFine, damage_fine: damageFineTotal, returned_count: items.length });
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}));

app.post("/api/loans/:id/extend", authMiddleware, wrap(async (req, res) => {
  const settings = await getSettingsMap();
  const maxExtend = Number(settings.max_extend) || 1;
  const defaultDays = Number(settings.extend_days) || 7;
  const days = Math.min(Math.max(+req.body.days || defaultDays, 1), 30);

  const [x] = await db.query(
    "UPDATE loans SET due_date=DATE_ADD(due_date, INTERVAL ? DAY), extended=1, extend_count=extend_count+1 WHERE id=? AND status='borrowed' AND extend_count < ?",
    [days, req.params.id, maxExtend]
  );
  if (!x.affectedRows) throw bad(`Perpanjangan tidak dapat dilakukan (maksimal ${maxExtend}x atau sudah dikembalikan)`);
  res.json({ success: true });
}));

app.put("/api/loans/:id/pay", authMiddleware, wrap(async (req, res) => {
  const { type = "fee", payment_method = "Tunai" } = req.body;
  const sql = type === "fine" ? "UPDATE loans SET fine_paid=1, fine_payment_method=? WHERE id=?" : "UPDATE loans SET paid=1, payment_method=? WHERE id=?";
  const [x] = await db.query(sql, [clean(payment_method) || "Tunai", req.params.id]);
  if (!x.affectedRows) throw bad("Transaksi tidak ditemukan", 404);
  res.json({ success: true });
}));

// ==========================================
// 9. VISITS / KUNJUNGAN (Page 9)
// ==========================================
app.get("/api/visits/stats", authMiddleware, wrap(async (req, res) => {
  const period = req.query.period === "year" ? "year" : "month";
  const [[counts]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM visits WHERE visit_date = CURDATE()) AS today_count,
      (SELECT COUNT(*) FROM visits WHERE YEAR(visit_date)=YEAR(CURDATE()) AND MONTH(visit_date)=MONTH(CURDATE())) AS month_count,
      (SELECT COUNT(*) FROM visits WHERE YEAR(visit_date)=YEAR(CURDATE())) AS year_count,
      (SELECT COUNT(*) FROM members WHERE status='aktif') AS total_members
  `);
  const [[topRoom]] = await db.query(`
    SELECT COALESCE(NULLIF(m.room,''), '-') AS room, COUNT(*) AS total
    FROM visits v JOIN members m ON m.id=v.member_id
    WHERE YEAR(v.visit_date)=YEAR(CURDATE()) GROUP BY m.room ORDER BY total DESC LIMIT 1
  `);
  const [byPurpose] = await db.query(`
    SELECT purpose, COUNT(*) AS total FROM visits
    WHERE ${period === "year" ? "YEAR(visit_date)=YEAR(CURDATE())" : "YEAR(visit_date)=YEAR(CURDATE()) AND MONTH(visit_date)=MONTH(CURDATE())"}
    GROUP BY purpose ORDER BY total DESC
  `);

  let series = [];
  if (period === "month") {
    const [wRows] = await db.query(`
      SELECT LEAST(CEIL(DAY(visit_date) / 7), 4) AS wk, COUNT(*) AS total FROM visits
      WHERE YEAR(visit_date)=YEAR(CURDATE()) AND MONTH(visit_date)=MONTH(CURDATE()) GROUP BY wk ORDER BY wk ASC
    `);
    const map = Object.fromEntries(wRows.map((r) => [Number(r.wk), Number(r.total)]));
    series = [1, 2, 3, 4].map((w) => ({ label: `Minggu ${w}`, value: map[w] || 0 }));
  } else {
    const [mRows] = await db.query(`
      SELECT MONTH(visit_date) AS mo, COUNT(*) AS total FROM visits
      WHERE YEAR(visit_date)=YEAR(CURDATE()) GROUP BY mo ORDER BY mo ASC
    `);
    const map = Object.fromEntries(mRows.map((r) => [Number(r.mo), Number(r.total)]));
    series = MONTHS_ID.map((lbl, idx) => ({ label: lbl, value: map[idx + 1] || 0 }));
  }
  res.json({ success: true, data: { ...counts, top_room: topRoom || { room: "-", total: 0 }, by_purpose: byPurpose, series } });
}));

app.get("/api/visits", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 10, 1), 200);
  const where = [], p = [];
  if (req.query.search) {
    where.push("(m.name LIKE ? OR m.member_no LIKE ? OR m.room LIKE ? OR v.purpose LIKE ?)");
    const q = `%${req.query.search}%`;
    p.push(q, q, q, q);
  }
  if (req.query.purpose) { where.push("v.purpose=?"); p.push(req.query.purpose); }
  if (req.query.date) { where.push("v.visit_date=?"); p.push(req.query.date); }
  const W = where.length ? where.join(" AND ") : "1=1";

  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM visits v JOIN members m ON m.id=v.member_id WHERE ${W}`, p);
  const [rows] = await db.query(
    `SELECT v.*, m.name member_name, m.member_no, m.level member_level, m.room member_room, m.photo member_photo
     FROM visits v JOIN members m ON m.id=v.member_id
     WHERE ${W} ORDER BY v.visit_date DESC, v.check_in DESC, v.id DESC LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]
  );
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.post("/api/visits", authMiddleware, wrap(async (req, res) => {
  const member_id = Number(req.body.member_id);
  if (!member_id) throw bad("Pilih anggota terlebih dahulu");
  const [x] = await db.query("INSERT INTO visits SET ?", [{
    member_id,
    visit_date: clean(req.body.visit_date) || new Date().toISOString().slice(0, 10),
    check_in: clean(req.body.check_in) || new Date().toTimeString().slice(0, 5),
    check_out: clean(req.body.check_out) || null,
    purpose: clean(req.body.purpose) || "Membaca Buku",
    note: clean(req.body.note) || null,
  }]);
  res.status(201).json({ success: true, id: x.insertId });
}));

app.put("/api/visits/:id/checkout", authMiddleware, wrap(async (req, res) => {
  const check_out = clean(req.body.check_out) || new Date().toTimeString().slice(0, 5);
  const [x] = await db.query("UPDATE visits SET check_out=? WHERE id=?", [check_out, req.params.id]);
  if (!x.affectedRows) throw bad("Data kunjungan tidak ditemukan", 404);
  res.json({ success: true });
}));

app.delete("/api/visits/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("DELETE FROM visits WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Data kunjungan tidak ditemukan", 404);
  res.json({ success: true });
}));

// ==========================================
// 10. PROCUREMENT: RENCANA, PEMBELIAN & DONASI (Pages 11-13)
// ==========================================
app.get("/api/procurement/plans/stats", authMiddleware, wrap(async (_req, res) => {
  const [[s]] = await db.query(`
    SELECT
      COUNT(*) AS total_plans,
      SUM(CASE WHEN status='disetujui' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status='dalam_proses' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN status='diterima' THEN 1 ELSE 0 END) AS received,
      (SELECT COUNT(*) FROM books WHERE deleted_at IS NULL) AS total_collection
    FROM procurement_plans
  `);
  const [bySource] = await db.query("SELECT funding_source AS label, COUNT(*) AS value FROM procurement_plans GROUP BY funding_source ORDER BY value DESC");
  res.json({ success: true, data: { ...s, by_source: bySource } });
}));

app.get("/api/procurement/plans", authMiddleware, wrap(async (req, res) => {
  const page = Math.max(+req.query.page || 1, 1);
  const limit = Math.min(Math.max(+req.query.limit || 10, 1), 100);
  const where = [], p = [];
  if (req.query.search) {
    where.push("(pp.title LIKE ? OR c.name LIKE ? OR pp.funding_source LIKE ?)");
    const q = `%${req.query.search}%`;
    p.push(q, q, q);
  }
  if (req.query.status) { where.push("pp.status=?"); p.push(req.query.status); }
  if (req.query.priority) { where.push("pp.priority=?"); p.push(req.query.priority); }
  const W = where.length ? where.join(" AND ") : "1=1";

  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM procurement_plans pp LEFT JOIN categories c ON c.id=pp.category_id WHERE ${W}`, p);
  const [rows] = await db.query(
    `SELECT pp.*, c.name category_name FROM procurement_plans pp LEFT JOIN categories c ON c.id=pp.category_id
     WHERE ${W} ORDER BY pp.id DESC LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]
  );
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}));

app.post("/api/procurement/plans", authMiddleware, wrap(async (req, res) => {
  const title = clean(req.body.title);
  if (!title) throw bad("Judul buku wajib diisi");
  const [x] = await db.query("INSERT INTO procurement_plans SET ?", [{
    title,
    category_id: req.body.category_id || null,
    quantity: Math.max(Number(req.body.quantity) || 1, 1),
    priority: ["Tinggi", "Sedang", "Rendah"].includes(req.body.priority) ? req.body.priority : "Sedang",
    funding_source: ["Pembelian", "Donasi", "Hibah", "Program/Kerja Sama"].includes(req.body.funding_source) ? req.body.funding_source : "Pembelian",
    estimated_price: Math.max(Number(req.body.estimated_price) || 0, 0),
    status: ["usulan", "disetujui", "dalam_proses", "diterima", "ditolak"].includes(req.body.status) ? req.body.status : "usulan",
    note: clean(req.body.note) || null,
  }]);
  res.status(201).json({ success: true, id: x.insertId });
}));

app.put("/api/procurement/plans/:id", authMiddleware, wrap(async (req, res) => {
  const fields = {};
  if (req.body.title !== undefined) fields.title = clean(req.body.title);
  if (req.body.category_id !== undefined) fields.category_id = req.body.category_id || null;
  if (req.body.quantity !== undefined) fields.quantity = Math.max(Number(req.body.quantity) || 1, 1);
  if (req.body.priority !== undefined) fields.priority = req.body.priority;
  if (req.body.funding_source !== undefined) fields.funding_source = req.body.funding_source;
  if (req.body.estimated_price !== undefined) fields.estimated_price = Math.max(Number(req.body.estimated_price) || 0, 0);
  if (req.body.status !== undefined) fields.status = req.body.status;
  if (req.body.note !== undefined) fields.note = clean(req.body.note) || null;
  const [x] = await db.query("UPDATE procurement_plans SET ? WHERE id=?", [fields, req.params.id]);
  if (!x.affectedRows) throw bad("Rencana pengadaan tidak ditemukan", 404);
  res.json({ success: true });
}));

app.delete("/api/procurement/plans/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("DELETE FROM procurement_plans WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Rencana pengadaan tidak ditemukan", 404);
  res.json({ success: true });
}));

// ---- Purchases ----
app.get("/api/procurement/purchases/stats", authMiddleware, wrap(async (_req, res) => {
  const [[s]] = await db.query(`
    SELECT
      COUNT(*) AS total_trx,
      COALESCE(SUM(total_amount), 0) AS total_spent,
      MAX(purchase_date) AS last_purchase_date,
      (SELECT COUNT(*) FROM purchase_items) AS total_titles,
      (SELECT COALESCE(SUM(quantity), 0) FROM purchase_items) AS total_copies
    FROM purchases
  `);
  res.json({ success: true, data: s });
}));

app.get("/api/procurement/purchases", authMiddleware, wrap(async (req, res) => {
  const limit = Math.min(Math.max(+req.query.limit || 20, 1), 100);
  const [rows] = await db.query(`
    SELECT p.*,
      (SELECT COALESCE(SUM(pi.quantity), 0) FROM purchase_items pi WHERE pi.purchase_id=p.id) total_copies,
      (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id=p.id) total_titles
    FROM purchases p ORDER BY p.purchase_date DESC, p.id DESC LIMIT ?
  `, [limit]);
  res.json({ success: true, data: rows });
}));

app.get("/api/procurement/purchases/:id", authMiddleware, wrap(async (req, res) => {
  const [[purchase]] = await db.query("SELECT * FROM purchases WHERE id=?", [req.params.id]);
  if (!purchase) throw bad("Pembelian tidak ditemukan", 404);
  const [items] = await db.query(
    "SELECT pi.*, c.name category_name FROM purchase_items pi LEFT JOIN categories c ON c.id=pi.category_id WHERE pi.purchase_id=?",
    [purchase.id]
  );
  res.json({ success: true, data: { ...purchase, items } });
}));

app.post("/api/procurement/purchases", authMiddleware, wrap(async (req, res) => {
  const purchase_date = clean(req.body.purchase_date) || new Date().toISOString().slice(0, 10);
  const supplier = clean(req.body.supplier);
  const items = Array.isArray(req.body.items) ? req.body.items.filter((i) => clean(i.title)) : [];
  if (!supplier) throw bad("Pemasok / Toko Buku wajib diisi");
  if (!items.length) throw bad("Tambahkan minimal 1 buku yang dibeli");

  const prepared = items.map((i) => {
    const qty = Math.max(Number(i.quantity) || 1, 1);
    const price = Math.max(Number(i.unit_price) || 0, 0);
    return { title: clean(i.title), category_id: i.category_id || null, quantity: qty, unit_price: price, subtotal: qty * price };
  });
  const total_amount = prepared.reduce((acc, x) => acc + x.subtotal, 0);

  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    const [p] = await cn.query("INSERT INTO purchases SET ?", [{
      purchase_date, supplier,
      invoice_no: clean(req.body.invoice_no) || null,
      funding_source: clean(req.body.funding_source) || "Dana Perpustakaan",
      payment_method: clean(req.body.payment_method) || "Tunai",
      total_amount,
      note: clean(req.body.note) || null,
    }]);
    await cn.query(
      "INSERT INTO purchase_items (purchase_id, title, category_id, quantity, unit_price, subtotal) VALUES ?",
      [prepared.map((it) => [p.insertId, it.title, it.category_id, it.quantity, it.unit_price, it.subtotal])]
    );
    await cn.commit();
    res.status(201).json({ success: true, id: p.insertId, total_amount });
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}));

app.delete("/api/procurement/purchases/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("DELETE FROM purchases WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Data pembelian tidak ditemukan", 404);
  res.json({ success: true });
}));

// ---- Donations ----
app.get("/api/procurement/donations/stats", authMiddleware, wrap(async (_req, res) => {
  const [[s]] = await db.query(`
    SELECT
      COUNT(*) AS total_trx,
      COUNT(DISTINCT donor_name) AS total_donors,
      MAX(received_date) AS last_donation_date,
      (SELECT COALESCE(SUM(quantity), 0) FROM donation_items) AS total_copies
    FROM donations
  `);
  res.json({ success: true, data: s });
}));

app.get("/api/procurement/donations", authMiddleware, wrap(async (req, res) => {
  const limit = Math.min(Math.max(+req.query.limit || 20, 1), 100);
  const [rows] = await db.query(`
    SELECT d.*,
      (SELECT COALESCE(SUM(di.quantity), 0) FROM donation_items di WHERE di.donation_id=d.id) total_copies,
      (SELECT COUNT(*) FROM donation_items di WHERE di.donation_id=d.id) total_titles
    FROM donations d ORDER BY d.received_date DESC, d.id DESC LIMIT ?
  `, [limit]);
  res.json({ success: true, data: rows });
}));

app.get("/api/procurement/donations/:id", authMiddleware, wrap(async (req, res) => {
  const [[donation]] = await db.query("SELECT * FROM donations WHERE id=?", [req.params.id]);
  if (!donation) throw bad("Data donasi tidak ditemukan", 404);
  const [items] = await db.query(
    "SELECT di.*, c.name category_name FROM donation_items di LEFT JOIN categories c ON c.id=di.category_id WHERE di.donation_id=?",
    [donation.id]
  );
  res.json({ success: true, data: { ...donation, items } });
}));

app.post("/api/procurement/donations", authMiddleware, wrap(async (req, res) => {
  const received_date = clean(req.body.received_date) || new Date().toISOString().slice(0, 10);
  const donor_name = clean(req.body.donor_name);
  const items = Array.isArray(req.body.items) ? req.body.items.filter((i) => clean(i.title)) : [];
  if (!donor_name) throw bad("Nama donatur wajib diisi");
  if (!items.length) throw bad("Tambahkan minimal 1 buku donasi");

  const cn = await db.getConnection();
  try {
    await cn.beginTransaction();
    const [d] = await cn.query("INSERT INTO donations SET ?", [{
      received_date, donor_name,
      donor_type: clean(req.body.donor_type) || "Alumni",
      contact: clean(req.body.contact) || null,
      donation_type: clean(req.body.donation_type) || "Buku",
      note: clean(req.body.note) || null,
    }]);
    await cn.query(
      "INSERT INTO donation_items (donation_id, title, category_id, quantity, condition_status) VALUES ?",
      [items.map((it) => [d.insertId, clean(it.title), it.category_id || null, Math.max(Number(it.quantity) || 1, 1), it.condition_status || "Baik"])]
    );
    await cn.commit();
    res.status(201).json({ success: true, id: d.insertId });
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}));

app.delete("/api/procurement/donations/:id", authMiddleware, wrap(async (req, res) => {
  const [x] = await db.query("DELETE FROM donations WHERE id=?", [req.params.id]);
  if (!x.affectedRows) throw bad("Data donasi tidak ditemukan", 404);
  res.json({ success: true });
}));

app.get("/api/procurement/history", authMiddleware, wrap(async (_req, res) => {
  const [purchases] = await db.query(`
    SELECT p.id, 'Pembelian' AS kind, p.purchase_date AS trx_date, p.supplier AS source_name,
      p.invoice_no AS ref_no, p.total_amount AS amount,
      (SELECT COALESCE(SUM(quantity),0) FROM purchase_items pi WHERE pi.purchase_id=p.id) AS total_copies, p.note
    FROM purchases p
  `);
  const [donations] = await db.query(`
    SELECT d.id, 'Donasi' AS kind, d.received_date AS trx_date, d.donor_name AS source_name,
      d.donor_type AS ref_no, 0 AS amount,
      (SELECT COALESCE(SUM(quantity),0) FROM donation_items di WHERE di.donation_id=d.id) AS total_copies, d.note
    FROM donations d
  `);
  const combined = [...purchases, ...donations].sort((a, b) => String(b.trx_date).localeCompare(String(a.trx_date)));
  res.json({ success: true, data: combined });
}));

// ==========================================
// 11. DASHBOARD & REPORTS (Pages 1 & 10)
// ==========================================
app.get("/api/dashboard", authMiddleware, wrap(async (req, res) => {
  const monthsBack = req.query.range === "12" ? 12 : 6;

  const [[stats]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM books WHERE deleted_at IS NULL) AS titles,
      (SELECT COALESCE(SUM(copies), 0) FROM books WHERE deleted_at IS NULL) AS copies,
      (SELECT COUNT(*) FROM loans WHERE status='borrowed') AS borrowed,
      (SELECT COUNT(*) FROM loans WHERE status='borrowed' AND due_date < CURDATE()) AS overdue,
      (SELECT COUNT(*) FROM members WHERE status='aktif') AS members,
      (SELECT COUNT(*) FROM visits WHERE visit_date = CURDATE()) AS visits_today,
      (SELECT COUNT(*) FROM loans WHERE paid=0) AS unpaid,
      (SELECT COUNT(*) FROM loans WHERE paid=1) AS paid_count,
      (SELECT COUNT(*) FROM loans) AS total_loans,
      (SELECT COUNT(*) FROM procurement_plans WHERE status IN ('usulan','disetujui')) AS pending_procurements
  `);

  const [monthlyRows] = await db.query(
    `SELECT DATE_FORMAT(loan_date, '%Y-%m') AS ym, COUNT(*) AS total
     FROM loans WHERE loan_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH) GROUP BY ym ORDER BY ym ASC`,
    [monthsBack]
  );
  const mMap = Object.fromEntries(monthlyRows.map((r) => [r.ym, Number(r.total)]));
  const now = new Date();
  const loan_chart = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    loan_chart.push({ label: MONTHS_ID[d.getMonth()], ym, value: mMap[ym] || 0 });
  }

  const [recent_transactions] = await db.query(`
    SELECT l.id, l.trx_no, l.loan_date, l.return_date, l.status, l.paid, l.fee, l.fine,
      m.name AS member_name, m.member_no, COALESCE(u.name, 'Admin') AS officer_name,
      (SELECT GROUP_CONCAT(b.title SEPARATOR ', ') FROM loan_items li JOIN books b ON b.id=li.book_id WHERE li.loan_id=l.id) AS titles
    FROM loans l JOIN members m ON m.id=l.member_id LEFT JOIN users u ON u.id=l.user_id
    ORDER BY l.id DESC LIMIT 6
  `);

  res.json({
    success: true,
    data: {
      ...stats,
      loan_chart,
      payment_summary: { total: Number(stats.total_loans) || 0, paid: Number(stats.paid_count) || 0, unpaid: Number(stats.unpaid) || 0 },
      recent_transactions,
    },
  });
}));

app.get("/api/reports/collection", authMiddleware, wrap(async (req, res) => {
  const where = ["b.deleted_at IS NULL"], p = [];
  if (req.query.category_id) { where.push("b.category_id=?"); p.push(req.query.category_id); }
  if (req.query.shelf_id) { where.push("b.shelf_id=?"); p.push(req.query.shelf_id); }
  if (req.query.status === "tersedia") where.push("b.available > 0");
  if (req.query.status === "dipinjam") where.push("b.copies > b.available");
  if (req.query.status === "rusak") where.push("b.`condition`='rusak'");
  if (req.query.status === "hilang") where.push("b.`condition`='hilang'");
  const W = where.join(" AND ");

  const [rows] = await db.query(`
    SELECT c.id, c.name AS category_name,
      COUNT(b.id) AS total_titles,
      COALESCE(SUM(b.copies), 0) AS total_copies,
      COALESCE(SUM(b.available), 0) AS available_copies,
      COALESCE(SUM(GREATEST(b.copies - b.available, 0)), 0) AS borrowed_copies,
      COALESCE(SUM(CASE WHEN b.\`condition\`='rusak' THEN 1 ELSE 0 END), 0) AS damaged_books,
      COALESCE(SUM(CASE WHEN b.\`condition\`='hilang' THEN 1 ELSE 0 END), 0) AS lost_books
    FROM categories c LEFT JOIN books b ON b.category_id=c.id AND ${W}
    ${req.query.category_id ? "WHERE c.id=?" : ""}
    GROUP BY c.id ORDER BY c.id ASC
  `, req.query.category_id ? [...p, req.query.category_id] : p);

  const summary = rows.reduce((a, r) => ({
    total_titles: a.total_titles + Number(r.total_titles),
    total_copies: a.total_copies + Number(r.total_copies),
    available_copies: a.available_copies + Number(r.available_copies),
    borrowed_copies: a.borrowed_copies + Number(r.borrowed_copies),
    damaged_books: a.damaged_books + Number(r.damaged_books),
    lost_books: a.lost_books + Number(r.lost_books),
  }), { total_titles: 0, total_copies: 0, available_copies: 0, borrowed_copies: 0, damaged_books: 0, lost_books: 0 });
  res.json({ success: true, data: { rows, summary } });
}));

app.get("/api/reports/transactions", authMiddleware, wrap(async (req, res) => {
  const where = ["1=1"], p = [];
  if (req.query.year) { where.push("YEAR(l.loan_date)=?"); p.push(req.query.year); }
  if (req.query.status === "overdue") where.push("l.status='borrowed' AND l.due_date < CURDATE()");
  else if (req.query.status) { where.push("l.status=?"); p.push(req.query.status); }
  const W = where.join(" AND ");

  const [rows] = await db.query(`
    SELECT l.id, l.trx_no, l.loan_date, l.due_date, l.return_date, l.fee, l.fine, l.paid, l.fine_paid, l.status,
      IF(l.status='borrowed' AND l.due_date < CURDATE(), 'overdue', l.status) AS display_status,
      m.name AS member_name, m.member_no,
      (SELECT GROUP_CONCAT(b.title SEPARATOR ', ') FROM loan_items li JOIN books b ON b.id=li.book_id WHERE li.loan_id=l.id) AS titles,
      (SELECT COUNT(*) FROM loan_items li WHERE li.loan_id=l.id) AS book_count
    FROM loans l JOIN members m ON m.id=l.member_id WHERE ${W} ORDER BY l.loan_date DESC, l.id DESC LIMIT 200
  `, p);

  const summary = {
    total_trx: rows.length,
    borrowed: rows.filter((r) => r.display_status === "borrowed").length,
    overdue: rows.filter((r) => r.display_status === "overdue").length,
    returned: rows.filter((r) => r.display_status === "returned").length,
    total_fee: rows.reduce((a, r) => a + Number(r.fee || 0), 0),
    total_fine: rows.reduce((a, r) => a + Number(r.fine || 0), 0),
  };
  res.json({ success: true, data: { rows, summary } });
}));

app.get("/api/reports/visits", authMiddleware, wrap(async (req, res) => {
  const where = ["1=1"], p = [];
  if (req.query.year) { where.push("YEAR(v.visit_date)=?"); p.push(req.query.year); }
  const W = where.join(" AND ");

  const [byRoom] = await db.query(`
    SELECT COALESCE(NULLIF(m.room,''), 'Tanpa Kamar') AS room, COUNT(*) AS total_visits, COUNT(DISTINCT v.member_id) AS unique_members
    FROM visits v JOIN members m ON m.id=v.member_id WHERE ${W} GROUP BY room ORDER BY total_visits DESC
  `, p);
  const [byPurpose] = await db.query(`SELECT v.purpose, COUNT(*) AS total FROM visits v WHERE ${W} GROUP BY v.purpose ORDER BY total DESC`, p);
  const [rows] = await db.query(`
    SELECT v.*, m.name AS member_name, m.member_no, m.room, m.level
    FROM visits v JOIN members m ON m.id=v.member_id WHERE ${W} ORDER BY v.visit_date DESC, v.check_in DESC LIMIT 150
  `, p);
  res.json({ success: true, data: { rows, byRoom, byPurpose, total_visits: rows.length } });
}));

app.get("/api/reports/members", authMiddleware, wrap(async (_req, res) => {
  const [byLevel] = await db.query(`
    SELECT COALESCE(NULLIF(level,''), 'Lainnya') AS level, COUNT(*) AS total,
      SUM(CASE WHEN status='aktif' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status='tidak_aktif' THEN 1 ELSE 0 END) AS inactive
    FROM members GROUP BY level ORDER BY total DESC
  `);
  const [topBorrowers] = await db.query(`
    SELECT m.id, m.member_no, m.name, m.level, m.room, COUNT(l.id) AS total_loans,
      (SELECT COUNT(*) FROM visits v WHERE v.member_id=m.id) AS total_visits
    FROM members m LEFT JOIN loans l ON l.member_id=m.id GROUP BY m.id ORDER BY total_loans DESC, total_visits DESC LIMIT 20
  `);
  res.json({ success: true, data: { byLevel, topBorrowers } });
}));

app.get("/api/reports/finance", authMiddleware, wrap(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const [[income]] = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN paid=1 THEN fee ELSE 0 END), 0) AS paid_fees,
      COALESCE(SUM(CASE WHEN paid=0 THEN fee ELSE 0 END), 0) AS unpaid_fees,
      COALESCE(SUM(CASE WHEN fine_paid=1 THEN fine ELSE 0 END), 0) AS paid_fines,
      COALESCE(SUM(CASE WHEN fine_paid=0 THEN fine ELSE 0 END), 0) AS unpaid_fines
    FROM loans WHERE YEAR(loan_date)=?
  `, [year]);
  const [[expense]] = await db.query("SELECT COALESCE(SUM(total_amount), 0) AS total_purchases, COUNT(*) AS purchase_count FROM purchases WHERE YEAR(purchase_date)=?", [year]);

  const [ledgerLoans] = await db.query(`
    SELECT l.loan_date AS trx_date, l.trx_no AS ref_no, CONCAT('Biaya & Denda - ', m.name) AS description,
      'Pemasukan' AS type, (CASE WHEN l.paid=1 THEN l.fee ELSE 0 END) + (CASE WHEN l.fine_paid=1 THEN l.fine ELSE 0 END) AS amount,
      l.payment_method
    FROM loans l JOIN members m ON m.id=l.member_id
    WHERE YEAR(l.loan_date)=? AND (l.paid=1 OR l.fine_paid=1) AND (l.fee > 0 OR l.fine > 0)
  `, [year]);
  const [ledgerPurchases] = await db.query(`
    SELECT p.purchase_date AS trx_date, COALESCE(p.invoice_no, CONCAT('PB-', p.id)) AS ref_no,
      CONCAT('Pembelian Buku - ', p.supplier) AS description, 'Pengeluaran' AS type, p.total_amount AS amount, p.payment_method
    FROM purchases p WHERE YEAR(p.purchase_date)=?
  `, [year]);

  const ledger = [...ledgerLoans, ...ledgerPurchases].sort((a, b) => String(b.trx_date).localeCompare(String(a.trx_date)));
  const totalIncome = Number(income.paid_fees) + Number(income.paid_fines);
  const totalExpense = Number(expense.total_purchases);

  res.json({
    success: true,
    data: {
      year,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_balance: totalIncome - totalExpense,
      paid_fees: Number(income.paid_fees),
      paid_fines: Number(income.paid_fines),
      unpaid_receivables: Number(income.unpaid_fees) + Number(income.unpaid_fines),
      ledger,
    },
  });
}));

// Global error fallback (termasuk error Multer)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 400).json({ success: false, message: err.message || "Terjadi kesalahan server" });
});

const PORT = process.env.PORT || 5000;
initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`ATH Library API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Database initialization failed:", err.message);
    app.listen(PORT, () => console.log(`ATH Library API running on port ${PORT} (DB init pending)`));
  });
