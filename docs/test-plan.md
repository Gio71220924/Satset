# Test Plan

Sebagian besar pengujian di sini **manual**, dan itu disengaja: yang paling mungkin rusak adalah interaksi dengan DOM ATS nyata yang berubah tanpa pemberitahuan. Mem-*mock* halaman Greenhouse berarti menguji tiruan yang kita buat sendiri — lulus semua, tetap gagal di halaman asli.

Otomatis hanya untuk logika murni yang tidak menyentuh DOM.

---

## 0. Aturan Data Uji

**Jangan pernah memakai data pribadi asli saat menguji ke halaman lowongan live.** Uji berarti mengisi form lamaran sungguhan di perusahaan sungguhan; salah klik = lamaran palsu terkirim atas nama Anda.

Profil uji baku:

```
Nama          : Ana Wijaya  (depan: Ana, belakang: Wijaya)
Email         : ana@contoh.id
No. HP        : +6281234567890
Lahir         : 1999-04-17
Kota          : Bandung, Jawa Barat, 40111, Indonesia
LinkedIn      : https://linkedin.com/in/contoh
GitHub        : https://github.com/contoh
Kerja[0]      : PT Contoh — Data Analyst, 2023-08 → sekarang (endDate null)
Kerja[1]      : PT Lama — Intern, 2022-01 → 2023-07
Pendidikan[0] : Universitas Contoh, S1 Teknik Informatika, IPK 3.45
Resume        : CV_Ana.pdf (PDF dummy, ±500 KB)
```

Simpan sebagai `fixtures/profil-uji.json` (hasil ekspor) supaya bisa diimpor ulang setelah menguji reset data. **Jangan commit resume asli.**

## 1. Otomatis

Yang bisa diuji tanpa browser: transformasi data murni. `node --test` dari root repo, tanpa dependency.

| Modul | Berkas | Cakupan | Status |
|---|---|---|---|
| Skema profil | `src/schema.test.js` | `migrate()` (default, tambal key hilang, tolak versi lebih baru), `getPath()` (nested, indeks array, path tidak ada, array→string, boolean→Yes/No) | ✅ 6/6 |
| Skoring heuristik | `src/content/match.test.js` | belum ada — Milestone 2 | ⬜ |

**`match.test.js` wajib ada sebelum `keywords.json` bertambah besar.** Fungsi skoring menerima string haystack dan mengembalikan `{path, score}` — tidak menyentuh DOM sama sekali, jadi bisa diuji sebagai fungsi biasa. Kasus minimum:

| Haystack | Harus menghasilkan |
|---|---|
| `"first name"` | `personal.firstName` |
| `"emergency contact phone"` | tidak ada (negative menang) |
| `"current salary"` | tidak ada, **bukan** `preferences.desiredSalary` |
| `"company website"` | tidak ada, **bukan** `links.website` |
| `"confirm email"` | tidak ada, **bukan** `personal.email` |
| `"nama depan"` | `personal.firstName` |
| `"name"` (sendirian, ambigu) | tidak ada (selisih skor < 1) |
| `"password"` | tidak ada (`_neverFill`) |

Nilai dari test ini bukan angka coverage, melainkan: menambah pola baru ke `keywords.json` tidak boleh diam-diam merusak pencocokan yang sudah benar. Itu satu-satunya regresi yang sulit terlihat mata.

## 2. Manual per Platform

Ulangi seluruh blok ini untuk **Greenhouse** dan **Lever**, masing-masing di **2 lowongan berbeda** (form ATS berbeda antar perusahaan karena adanya custom question).

Hasil dicatat di [field-mapping.md](field-mapping.md) beserta tanggal uji.

### T1 — Deteksi

| # | Langkah | Diharapkan |
|---|---|---|
| T1.1 | Buka halaman lamaran | Badge muncul di ikon, angkanya = jumlah field cocok |
| T1.2 | Buka halaman lowongan (belum klik Apply) | Badge kosong atau 0 — jangan mengaku menemukan form yang belum ada |
| T1.3 | Buka tab lain lalu kembali | Badge sesuai tab aktif, tidak nyangkut dari tab sebelumnya |
| T1.4 | Reload halaman | Deteksi jalan lagi, badge tidak jadi dobel |

### T2 — Pengisian yang Benar

| # | Langkah | Diharapkan |
|---|---|---|
| T2.1 | Klik ikon | Popup menampilkan daftar field + preview nilai sebelum mengisi |
| T2.2 | Klik "Isi N field" | Field terisi, outline hijau (mapping) / kuning (heuristik) |
| T2.3 | Periksa tiap nilai | Sama persis dengan profil. **Terutama email dan nomor HP** |
| T2.4 | Klik ke luar field | Outline hilang setelah blur |
| T2.5 | Submit form | Tidak ada error validasi dari ATS karena format nilai |

**T2.5 adalah tes yang sebenarnya.** Field yang terlihat terisi tapi ditolak validator ATS (format telepon, URL tanpa `https://`) sama saja dengan gagal. Uji sampai halaman konfirmasi ATS-nya muncul — pakai lowongan yang tidak Anda minati, atau tarik lamarannya setelah itu.

### T3 — Kompatibilitas React

Yang paling mungkin gagal diam-diam, karena field *terlihat* terisi.

| # | Langkah | Diharapkan |
|---|---|---|
| T3.1 | Isi, lalu submit tanpa menyentuh field apa pun | Semua nilai terkirim. Kalau ATS bilang "field wajib kosong" padahal terlihat terisi, `setNativeValue` gagal |
| T3.2 | Isi, klik satu field, ketik lalu hapus satu huruf | Nilai tidak kembali kosong |
| T3.3 | Isi field yang punya penghitung karakter | Penghitung ikut memperbarui angkanya |

T3.1 adalah kasus yang membedakan `el.value = x` (salah) dari native setter + event ([TDD §7.1](../TDD.md#71-text-input--masalah-react)). Kalau ini gagal, semua tes lain jadi tidak berarti.

### T4 — Field Tidak Ketemu

| # | Situasi | Diharapkan |
|---|---|---|
| T4.1 | Selector di mapping tidak ada di halaman | Dilewati diam-diam, field lain tetap terisi. **Bukan** exception yang menghentikan seluruh proses |
| T4.2 | Halaman tanpa form sama sekali | Popup state 2c, bukan error |
| T4.3 | Semua selector mapping gagal | Jatuh ke heuristik, bukan menyerah |
| T4.4 | Profil kosong, ada form | Popup: "Isi profil dulu", tidak mengisi apa pun |
| T4.5 | Sebagian profil kosong (mis. GitHub belum diisi) | Field itu dilewati, ditandai `⊘ (kosong di profil)`. **Tidak diisi string kosong** |

T4.5 penting: mengisi field dengan `""` bisa menandai field sebagai "sudah disentuh" di sebagian ATS dan lolos validasi required dalam keadaan kosong.

### T5 — Field Custom yang Tidak Dikenali

Inti dari fallback heuristik.

| # | Situasi | Diharapkan |
|---|---|---|
| T5.1 | "How did you hear about us?" | Tidak diisi, muncul sebagai `⊘` di popup |
| T5.2 | "Why do you want to work here?" (textarea) | Tidak diisi |
| T5.3 | Custom question berlabel jelas ("LinkedIn Profile URL") | **Terisi** lewat heuristik, ditandai `~` |
| T5.4 | Dropdown custom ("Years of experience") | Tidak diisi kecuali ada opsi yang cocok persis |
| T5.5 | Checkbox persetujuan / consent | **Tidak pernah** dicentang otomatis |
| T5.6 | Pertanyaan EEO (ras, gender, veteran, disabilitas) | **Tidak pernah** diisi ([TDD §12](../TDD.md#12-yang-sengaja-tidak-ditangani)) |
| T5.7 | Field password | Tidak pernah diisi |

T5.5 dan T5.6 adalah kegagalan yang paling merugikan di seluruh dokumen ini: mencentang persetujuan atas nama user, atau mengirim data demografi yang tidak dia pilih sendiri. Uji tiap rilis, tanpa kecuali.

### T6 — Upload Resume

| # | Langkah | Diharapkan |
|---|---|---|
| T6.1 | Isi form dengan resume tersimpan | Nama file muncul di widget upload ATS |
| T6.2 | Submit | Berkasnya benar-benar terkirim, bukan hanya nama filenya yang tampil |
| T6.3 | Upload gagal (khususnya Greenhouse S3) | Pesan "Resume perlu diunggah manual", bukan diam saja |
| T6.4 | Profil tanpa resume | Field upload dilewati, tidak error |

T6.2 hanya bisa dipastikan lewat halaman konfirmasi ATS atau email balasan. Nama file yang tampil di UI **bukan** bukti berkasnya terunggah.

### T7 — Undo

| # | Langkah | Diharapkan |
|---|---|---|
| T7.1 | Isi lalu Undo | Semua field kembali ke isi sebelumnya (biasanya kosong) |
| T7.2 | Isi, edit satu field manual, lalu Undo | Field yang diedit manual ikut dikembalikan — batasan yang diketahui, sebutkan di UI |
| T7.3 | Undo lalu Isi lagi | Terisi lagi dengan benar |
| T7.4 | Isi, reload halaman, buka popup | Tombol Undo tidak aktif (elemen lama sudah hilang) |

### T8 — Form Multi-step

| # | Langkah | Diharapkan |
|---|---|---|
| T8.1 | Isi langkah 1, lanjut ke langkah 2, buka popup | Scan ulang menemukan field langkah 2 |
| T8.2 | Kembali ke langkah 1 | Isian langkah 1 masih ada |

## 3. Storage & Profil

Tidak perlu halaman ATS, jalankan di options page.

| # | Langkah | Diharapkan |
|---|---|---|
| S1 | Isi semua field, tutup tab, buka lagi | Semua tersimpan (auto-save saat blur) |
| S2 | Tambah 3 pengalaman kerja, hapus yang tengah | Sisanya utuh, urutan tidak berubah |
| S3 | Centang "Masih bekerja di sini" | Field Selesai terkunci, tersimpan `endDate: null` + `current: true` |
| S4 | Upload resume 2,5 MB | Ditolak saat memilih file, dengan pesan |
| S5 | Ekspor lalu impor ke profil Chrome lain | Profil identik, termasuk resume |
| S6 | Impor file JSON rusak | Pesan error, **profil lama tidak tertimpa** |
| S7 | Impor file dengan `schemaVersion` lebih besar | Ditolak dengan pesan update extension ([skema §6](profile-schema.md#6-menambah-field-baru)) |
| S8 | Hapus semua data lalu buka popup | State profil kosong, tidak ada sisa data |

S6 dan S7 adalah jalur kehilangan data. Uji dua-duanya tiap rilis.

## 4. Sebelum Rilis ke Chrome Web Store

| # | Cek | Kenapa |
|---|---|---|
| R1 | `node --test` hijau | |
| R2 | Tidak ada `console.log` yang mencetak isi profil | Bocor ke DevTools halaman ATS |
| R3 | Tidak ada permintaan jaringan keluar (tab Network kosong saat mengisi) | Klaim inti di [PRIVACY.md §3](../PRIVACY.md) |
| R4 | Izin di `manifest.json` sama persis dengan [PRIVACY.md §5](../PRIVACY.md) | Ketidakcocokan = penolakan review |
| R5 | Laporan diagnostik tidak memuat nilai field maupun isi profil | [TDD §10](../TDD.md#10-logging--diagnostik) |
| R6 | Uji di profil Chrome yang bersih (tanpa extension lain) | Password manager sering ikut mengisi dan mengaburkan hasil |
| R7 | T5.5 dan T5.6 diulang | Konsekuensinya paling berat |

## 5. Yang Tidak Diuji

| Tidak diuji | Alasan |
|---|---|
| Browser selain Chrome | MVP hanya menargetkan Chrome |
| Unit test untuk kode DOM | Butuh mock DOM ATS = menguji tiruan buatan sendiri |
| E2E otomatis (Playwright dsb.) | Halaman lamaran nyata butuh login dan berubah sewaktu-waktu. Pertimbangkan lagi kalau jumlah platform sudah >5 |
| Beban / performa | Halaman form berisi puluhan input, bukan ribuan |
| ATS yang belum ada mapping-nya | Bukan janji MVP. Heuristik boleh gagal di sana |
