# Migrasi Storage ke WebP

Script ini memigrasikan gambar yang direferensikan database ke file WebP baru. File sumber tidak dihapus.

## Cakupan

- `events.poster_url` → bucket `posters`
- `users.avatar_url` → bucket `avatars`
- `costume_rentals.image_url` dan `image_path` → bucket `costume-rentals`
- `event_documentations.image_url` dan `documentations.image_url` → bucket `documentations`
- `ad_campaigns.image_path` → bucket `ad-assets`

Script hanya memproses file yang direferensikan tabel tersebut dan berada pada bucket yang sesuai. Referensi URL eksternal dilewati.

## Persiapan

1. Checkout branch `optimization/cached-egress-v1`.
2. Pastikan Node.js 20 atau lebih baru terpasang.
3. Pastikan file `.env.local` lokal memiliki `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`. Jangan membagikan atau meng-commit file ini.
4. Dari root repository, jalankan:

```bash
npm install --no-save sharp
```

## Jalankan pemeriksaan terlebih dahulu

Perintah default adalah dry-run. Tidak ada file Storage atau baris database yang diubah.

```bash
node --env-file=.env.local scripts/migrate-images-to-webp.mjs
```

Periksa ringkasan jumlah referensi dan jumlah file unik. Jika jumlahnya tidak masuk akal, hentikan proses dan jangan lanjutkan.

## Jalankan migrasi

Hanya setelah dry-run diperiksa:

```bash
node --env-file=.env.local scripts/migrate-images-to-webp.mjs --apply
```

Script akan:
- mengunduh file sumber;
- melakukan auto-rotate berdasarkan metadata EXIF;
- membatasi dimensi maksimum per kategori;
- mengonversi ke WebP kualitas 80;
- mengunggah file baru dengan nama yang sama dan ekstensi `.webp`;
- memperbarui URL/path database hanya setelah upload berhasil;
- mempertahankan file asli untuk rollback manual;
- menyimpan manifest dan checkpoint di folder `migration-output/`.

Script dibuat agar dapat dilanjutkan: jika file WebP sudah berhasil diunggah pada percobaan sebelumnya tetapi update database belum selesai, file WebP yang ada akan dipakai kembali. Update database juga menggunakan URL/path lama sebagai kondisi agar tidak menimpa perubahan yang terjadi bersamaan.

## Setelah migrasi

1. Simpan manifest dari `migration-output/` di tempat aman.
2. Periksa seluruh hasil yang berstatus `migrated` dan `*-failed`.
3. Uji poster, avatar, rental, dokumentasi, dan materi iklan melalui aplikasi.
4. Bandingkan ukuran byte pada manifest.
5. Jangan menghapus file sumber sampai seluruh gambar terverifikasi dan masa observasi selesai.

## Catatan

- Script tidak menjalankan SQL DDL dan tidak mengubah struktur database.
- Script menggunakan Supabase service-role key secara lokal. Kunci tersebut memiliki hak akses tinggi; jangan taruh di browser, jangan commit, dan jangan kirim ke chat.
- Proses `--apply` mengubah Storage dan data produksi jika `.env.local` menunjuk ke proyek produksi. Jalankan hanya setelah backup/ekspor database dan persetujuan pemilik proyek.
- Migrasi tidak mengubah gambar di folder `public/` pada repository.
