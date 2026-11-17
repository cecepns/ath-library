# ATH Library — Sistem Administrasi Perpustakaan PP Attholibiyah

## Cara Menjalankan
1. Import `backend/sql/database.sql` ke MySQL (atau jika database lama sudah ada, backend akan melakukan migrasi tabel/kolom otomatis saat dijalankan).
2. Jalankan Backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. Jalankan Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Akun Login Default
- **Administrator**: `admin` / `admin123`
- **Petugas 1**: `petugas1` / `petugas123`
- **Petugas 2**: `petugas2` / `petugas123`

## Scan QR
Scanner USB/HP mode keyboard mengetik kode buku (mis. `ATH-0001`) lalu tekan Enter pada kolom pencarian/scan QR di halaman **Transaksi → Peminjaman** maupun **Pengembalian**.
# ath-library
