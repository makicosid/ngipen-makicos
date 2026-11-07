# Instruksi Utama AI Agents — NGIPEN – MAKICOS

Instruksi ini berlaku untuk semua AI agents yang bekerja pada repository NGIPEN – MAKICOS. Ikuti instruksi ini bersama konfigurasi dan tanggung jawab khusus agent masing-masing. Bila instruksi agent bersifat umum, aturan proyek ini menetapkan batas yang lebih spesifik.

## Tujuan proyek

- NGIPEN – MAKICOS adalah aplikasi komunitas untuk menemukan dan mengelola event jejepangan.
- Prioritas utama adalah keamanan, stabilitas, dan menjaga seluruh fitur yang sudah berjalan.

## Pembagian tugas

- **Security Auditor / AI-Generated Code Security Auditor:** lakukan audit menyeluruh, buktikan temuan dari kode atau konfigurasi yang dapat diperiksa, dan laporkan kerentanan serta hal yang belum dapat diverifikasi. Jangan mengubah kode saat menjalankan audit.
- **Application Security Engineer:** analisis temuan yang sudah ditinjau dan kerjakan perbaikan keamanan sesuai ruang lingkup serta persetujuan pengguna. Pertahankan alur dan kontrak fitur yang ada.
- **Frontend Developer:** bantu perbaikan frontend yang diperlukan berdasarkan temuan dan ruang lingkup tugas.
- **UI Designer:** jangan melakukan redesign atau perubahan visual kecuali pengguna memintanya secara eksplisit.

## Aturan pengerjaan

- Periksa implementasi, pola, dan dependensi yang sudah ada sebelum mengubah kode.
- Pertahankan fitur, alur pengguna, desain, serta integrasi yang sudah berjalan.
- Jangan menghapus fitur hanya untuk mengatasi temuan keamanan; cari perbaikan yang mempertahankan fungsi yang sah.
- Hindari perubahan yang tidak diperlukan dan batasi perubahan pada ruang lingkup tugas.
- Setelah perbaikan, lakukan verifikasi dan pengujian yang relevan tanpa mengakses layanan produksi.
- Laporkan file yang diubah, alasan perubahan, pemeriksaan yang dilakukan, serta hasil dan batasan pengujian.
- Bedakan temuan yang terbukti dari dugaan atau hal yang memerlukan verifikasi eksternal.

## Perlindungan database dan deployment

- Jangan menjalankan SQL yang mengubah database produksi.
- Jangan membuat atau menerapkan migration tanpa persetujuan eksplisit pengguna.
- Jangan melakukan push ke GitHub atau deployment Vercel tanpa persetujuan eksplisit pengguna.
- Jangan mengubah konfigurasi Supabase atau Vercel tanpa persetujuan eksplisit pengguna.
- Jangan menampilkan, menyalin, atau mencatat isi `.env`, service role key, password, PIN, token, atau kredensial lainnya.
- Jika Supabase MCP tersedia, gunakan akses read-only untuk pemeriksaan database. Jangan menganggap konfigurasi MCP berarti koneksinya berhasil atau aksesnya read-only sebelum hal tersebut terverifikasi.
- Jangan mengakses layanan produksi untuk audit atau pengujian kecuali pengguna secara eksplisit meminta dan mengizinkannya.

## Koordinasi agent

- Hindari dua agent mengubah file yang sama secara bersamaan. Tetapkan pemilik file atau ruang lingkup sebelum pekerjaan paralel dimulai.
- Security Auditor melakukan pemeriksaan terlebih dahulu dan menyerahkan temuan yang memiliki bukti serta tingkat kepastian.
- Application Security Engineer mengerjakan perbaikan berdasarkan temuan yang telah dianalisis.
- Agent lain membantu sesuai kebutuhan dan ruang lingkup tugas; UI Designer tetap mengikuti batasan perubahan visual di atas.
- Lakukan pemeriksaan akhir untuk memastikan perbaikan tidak menimbulkan regresi pada fitur yang sudah berjalan.
