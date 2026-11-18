-- =============================================================
-- Migration: 2026-11-18
-- 1. Tambah tabel master `rooms` (Data Kamar) + koreksi typo Poskestren
-- 2. Tambah kolom `damage_fine` (Denda Kerusakan) pada tabel `loans`
-- =============================================================

USE ath_library;

-- 1. Buat tabel master kamar (`rooms`)
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  status ENUM('aktif', 'tidak_aktif') NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Koreksi typo "Pskestren" -> "Poskestren" pada data anggota yang sudah ada
UPDATE members SET room = 'Poskestren' WHERE room = 'Pskestren';

-- Seed data kamar default (aman dijalankan berulang dengan INSERT IGNORE)
INSERT IGNORE INTO rooms (name, description) VALUES
('Asatidz', 'Kamar / Kediaman Asatidz'),
('Pengurus 1', 'Kamar Pengurus 1'),
('Pengurus 2', 'Kamar Pengurus 2'),
('Poskestren', 'Pos Kesehatan Pesantren'),
('Abu Bakar', 'Asrama Santri Abu Bakar'),
('Umar', 'Asrama Santri Umar'),
('Utsman', 'Asrama Santri Utsman'),
('Ali', 'Asrama Santri Ali'),
('Bilal', 'Asrama Santri Bilal'),
('Hamzah', 'Asrama Santri Hamzah'),
('Hasan', 'Asrama Santri Hasan'),
('Husein', 'Asrama Santri Husein'),
('Tahfid', 'Asrama Santri Tahfid'),
('A1', 'Kamar A1'),
('A2', 'Kamar A2'),
('B1', 'Kamar B1'),
('B2', 'Kamar B2'),
('C1', 'Kamar C1'),
('C2', 'Kamar C2');

-- Sinkronkan nama kamar lain yang mungkin sudah terinput di tabel members
INSERT IGNORE INTO rooms (name)
SELECT DISTINCT TRIM(room) FROM members WHERE room IS NOT NULL AND TRIM(room) <> '';

-- 2. Tambah kolom `damage_fine` (Denda Kerusakan) pada tabel `loans`
-- Catatan: Jika kolom sudah ada, abaikan error Duplicate column atau jalankan blok kondisional di bawah.
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'loans'
    AND COLUMN_NAME = 'damage_fine'
);
SET @sql_add_col := IF(
  @col_exists = 0,
  'ALTER TABLE loans ADD COLUMN damage_fine INT NOT NULL DEFAULT 0 AFTER fine',
  'SELECT ''Kolom damage_fine sudah ada'' AS info'
);
PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
