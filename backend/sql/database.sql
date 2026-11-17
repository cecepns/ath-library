CREATE DATABASE IF NOT EXISTS ath_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ath_library;

-- 1. Pengguna & Hak Akses
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrator', 'petugas') NOT NULL DEFAULT 'petugas',
  status ENUM('aktif', 'tidak_aktif') NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pengaturan Sistem
CREATE TABLE IF NOT EXISTS settings (
  key_name VARCHAR(64) PRIMARY KEY,
  value_text TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Kategori Buku
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  icon VARCHAR(40) DEFAULT 'book',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Rak Buku
CREATE TABLE IF NOT EXISTS shelves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 5. Koleksi Buku
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_code VARCHAR(30) UNIQUE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(150) NOT NULL,
  publisher VARCHAR(150),
  year SMALLINT,
  isbn VARCHAR(30),
  category_id INT NOT NULL,
  subcategory VARCHAR(100),
  shelf_id INT NOT NULL,
  language ENUM('Indonesia', 'Inggris', 'Arab', 'China', 'Jepang', 'Multibahasa') DEFAULT 'Indonesia',
  acquisition_source ENUM('Pembelian', 'Donasi', 'Hibah', 'Program/Kerja Sama') DEFAULT 'Pembelian',
  copies INT NOT NULL DEFAULT 1,
  available INT NOT NULL DEFAULT 1,
  `condition` ENUM('baik', 'kurang_baik', 'rusak', 'hilang') DEFAULT 'baik',
  cover VARCHAR(255),
  note VARCHAR(250),
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (shelf_id) REFERENCES shelves(id),
  INDEX idx_books_title (title),
  INDEX idx_books_deleted (deleted_at)
);

-- 6. Data Anggota
CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  member_no VARCHAR(30) NOT NULL UNIQUE,
  entry_year SMALLINT NOT NULL,
  room VARCHAR(40),
  level VARCHAR(30),
  type ENUM('santri', 'pengurus', 'ustadz') DEFAULT 'santri',
  status ENUM('aktif', 'tidak_aktif') DEFAULT 'aktif',
  photo VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Transaksi Peminjaman & Pengembalian
CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trx_no VARCHAR(35) UNIQUE,
  member_id INT NOT NULL,
  user_id INT NULL,
  loan_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  fee INT DEFAULT 0,
  fine INT DEFAULT 0,
  paid TINYINT(1) DEFAULT 0,
  fine_paid TINYINT(1) DEFAULT 0,
  payment_method VARCHAR(30) DEFAULT 'Tunai',
  fine_payment_method VARCHAR(30) DEFAULT 'Tunai',
  extended TINYINT(1) DEFAULT 0,
  extend_count INT DEFAULT 0,
  status ENUM('borrowed', 'returned') DEFAULT 'borrowed',
  note VARCHAR(250),
  return_note VARCHAR(250),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_loans_status (status),
  INDEX idx_loans_date (loan_date)
);

CREATE TABLE IF NOT EXISTS loan_items (
  loan_id INT NOT NULL,
  book_id INT NOT NULL,
  returned_at DATE NULL,
  fine INT DEFAULT 0,
  PRIMARY KEY (loan_id, book_id),
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- 8. Kunjungan Perpustakaan
CREATE TABLE IF NOT EXISTS visits (
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
);

-- 9. Pengadaan Buku: Rencana Pengadaan
CREATE TABLE IF NOT EXISTS procurement_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category_id INT NULL,
  quantity INT NOT NULL DEFAULT 1,
  priority ENUM('Tinggi', 'Sedang', 'Rendah') DEFAULT 'Sedang',
  funding_source ENUM('Pembelian', 'Donasi', 'Hibah', 'Program/Kerja Sama') DEFAULT 'Pembelian',
  estimated_price INT DEFAULT 0,
  status ENUM('usulan', 'disetujui', 'dalam_proses', 'diterima', 'ditolak') DEFAULT 'usulan',
  note VARCHAR(250),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 10. Pengadaan Buku: Pembelian
CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_date DATE NOT NULL,
  supplier VARCHAR(150) NOT NULL,
  invoice_no VARCHAR(60),
  funding_source VARCHAR(80) DEFAULT 'Dana Perpustakaan',
  payment_method VARCHAR(30) DEFAULT 'Tunai',
  total_amount INT DEFAULT 0,
  note VARCHAR(250),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  category_id INT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL DEFAULT 0,
  subtotal INT NOT NULL DEFAULT 0,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 11. Pengadaan Buku: Donasi
CREATE TABLE IF NOT EXISTS donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  received_date DATE NOT NULL,
  donor_name VARCHAR(150) NOT NULL,
  donor_type VARCHAR(60) DEFAULT 'Alumni',
  contact VARCHAR(60),
  donation_type VARCHAR(60) DEFAULT 'Buku',
  note VARCHAR(250),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donation_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donation_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  category_id INT NULL,
  quantity INT NOT NULL DEFAULT 1,
  condition_status ENUM('Baik', 'Kurang Baik', 'Rusak') DEFAULT 'Baik',
  FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ==========================================
-- SEED DATA AWAL
-- ==========================================
INSERT IGNORE INTO categories (id, name, description, icon) VALUES
(1, 'Keislaman', 'Al-Qur''an, Tafsir, Hadis, Fiqih, Akidah & Akhlak', 'landmark'),
(2, 'Bahasa', 'Bahasa Arab, Bahasa Inggris, Kamus & Tata Bahasa', 'languages'),
(3, 'Sains & Teknologi', 'Matematika, Fisika, Biologi & Komputer', 'flask'),
(4, 'Pendidikan', 'Buku pelajaran, akademik & pengembangan diri', 'graduation'),
(5, 'Sastra & Novel', 'Novel islami, cerpen, puisi & komik edukatif', 'feather'),
(6, 'Sejarah & Biografi', 'Sejarah peradaban Islam, tokoh & biografi', 'globe'),
(7, 'Kesehatan', 'Kesehatan, kedokteran & pola hidup sehat', 'heart'),
(8, 'Umum & Referensi', 'Ensiklopedia, keterampilan, hobi & referensi umum', 'briefcase');

INSERT IGNORE INTO shelves (id, code, name, category_id) VALUES
(1, 'A1', 'Rak Sejarah Islam', 6),
(2, 'A2', 'Rak Fikih & Keislaman', 1),
(3, 'B1', 'Rak Bahasa Arab', 2),
(4, 'B2', 'Rak Bahasa Inggris', 2),
(5, 'C1', 'Rak Novel & Sastra', 5),
(6, 'D1', 'Rak Sains Umum', 3),
(7, 'E1', 'Rak Pendidikan', 4),
(8, 'E2', 'Rak Referensi', 8);

INSERT IGNORE INTO books (id, inventory_code, title, author, publisher, year, isbn, category_id, subcategory, shelf_id, language, acquisition_source, copies, available, `condition`) VALUES
(1, 'ATH-0001', 'Sejarah Peradaban Islam', 'Dr. Yusuf Qardhawi', 'Pustaka Islam', 2020, '978-602-1234-56-7', 6, 'Peradaban Islam', 1, 'Indonesia', 'Pembelian', 4, 3, 'baik'),
(2, 'ATH-0002', 'Kamus Bahasa Arab', 'Mahmud Yunus', 'Hidakarya', 2018, '978-602-2345-11-2', 2, 'Kamus Arab', 3, 'Arab', 'Pembelian', 2, 2, 'baik'),
(3, 'ATH-0003', 'Negeri 5 Menara', 'A. Fuadi', 'Gramedia', 2009, '978-979-2248-61-6', 5, 'Novel Islami', 5, 'Indonesia', 'Donasi', 3, 2, 'baik'),
(4, 'ATH-0004', 'Ensiklopedia Sains', 'Tim Pustaka Ilmu', 'Pustaka Ilmu', 2015, '978-602-9876-22-1', 3, 'Sains Umum', 6, 'Indonesia', 'Pembelian', 3, 3, 'baik'),
(5, 'ATH-0005', 'Fikih Madzhab Syafi''i', 'Imam An-Nawawi', 'Darul Kutub', 2012, '978-602-5432-88-9', 1, 'Fiqih', 2, 'Indonesia', 'Hibah', 5, 4, 'baik'),
(6, 'ATH-0006', 'Tafsir Al-Muyassar', 'Dr. Aidh Al-Qarni', 'Qisthi Press', 2019, '978-602-3456-77-1', 1, 'Al-Qur''an & Tafsir', 2, 'Indonesia', 'Pembelian', 4, 4, 'baik'),
(7, 'ATH-0007', 'Riyadhus Shalihin', 'Imam An-Nawawi', 'Ummul Qura', 2021, '978-602-7654-33-5', 1, 'Hadis', 2, 'Indonesia', 'Donasi', 3, 3, 'baik'),
(8, 'ATH-0008', 'Akhlak Lil Banin', 'Umar bin Ahmad Baraja', 'Maktabah Al-Ashriyah', 2017, NULL, 1, 'Akidah & Akhlak', 2, 'Arab', 'Hibah', 6, 5, 'kurang_baik');

INSERT IGNORE INTO members (id, name, member_no, entry_year, room, level, type, status, phone) VALUES
(1, 'Ahmad Fauzi', 'ATH-1001', 2024, 'Abu Bakar', 'MTs', 'santri', 'aktif', '0812-1111-2222'),
(2, 'Muhammad Rizki', 'ATH-1002', 2025, 'Umar', 'MTs', 'santri', 'aktif', '0812-3333-4444'),
(3, 'Fadli Al-Hakim', 'ATH-1003', 2024, 'Utsman', 'SMK', 'santri', 'aktif', '0813-5555-6666'),
(4, 'Ihsan Maulana', 'ATH-1004', 2023, 'Bilal', 'SMK', 'santri', 'aktif', '0813-7777-8888'),
(5, 'Rafi Hidayat', 'ATH-1005', 2023, 'Ali', 'Aliyah', 'santri', 'aktif', '0852-9999-0000'),
(6, 'Zidan Kamil', 'ATH-1006', 2022, 'Hamzah', 'Aliyah', 'santri', 'aktif', '0856-1212-3434'),
(7, 'Ust. Hamdan, Lc.', 'ATH-1007', 2018, 'Asatidz', 'Salaf', 'ustadz', 'aktif', '0812-8888-9999'),
(8, 'Ust. Saiful Anam', 'ATH-1008', 2020, 'Pengurus 1', 'Kuliah', 'pengurus', 'aktif', '0815-4545-6767');

INSERT IGNORE INTO procurement_plans (id, title, category_id, quantity, priority, funding_source, estimated_price, status, note) VALUES
(1, 'Tafsir Al-Muyassar Jilid Lengkap', 1, 5, 'Tinggi', 'Pembelian', 750000, 'disetujui', 'Referensi kajian kitab'),
(2, 'Buku Bahasa Arab untuk Pemula', 2, 10, 'Tinggi', 'Pembelian', 1200000, 'dalam_proses', 'Kebutuhan kelas MTs'),
(3, 'Sirah Nabawiyah Ar-Rahiq Al-Makhtum', 6, 3, 'Sedang', 'Donasi', 0, 'disetujui', 'Usulan alumni'),
(4, 'Keterampilan Public Speaking Santri', 4, 5, 'Sedang', 'Pembelian', 650000, 'usulan', 'Pengembangan ekstrakurikuler'),
(5, 'Ensiklopedia Sains Islam', 3, 4, 'Tinggi', 'Hibah', 0, 'diterima', 'Program bantuan literasi');
