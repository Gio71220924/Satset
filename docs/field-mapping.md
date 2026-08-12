# Field-Mapping Spec

Selector yang dipakai ada di **[`data/mappings.json`](../data/mappings.json)** dan kamus heuristiknya di **[`data/keywords.json`](../data/keywords.json)**. Kedua file itu yang di-`fetch` content script saat runtime — dokumen ini tabel bacanya plus prosedur update.

Kalau tabel di sini dan JSON berbeda, **JSON yang benar**. Update JSON dulu, tabel menyusul.

---

## 1. Status Verifikasi

| Status | Arti |
|---|---|
| `unverified` | Belum diuji ke halaman live. Boleh salah. Jangan dianggap benar |
| `verified` | Sudah diuji ke ≥2 halaman lowongan berbeda, tanggalnya dicatat di tabel |
| `broken` | Pernah `verified`, sekarang gagal. **Jangan dihapus** — entri `broken` adalah catatan bahwa ATS-nya berubah |

**Semua entri saat ini `unverified`.** Selector ditulis dari struktur form yang umum dipakai kedua ATS, bukan hasil inspect halaman nyata. Verifikasi adalah pekerjaan Milestone 2 di [roadmap](roadmap.md).

## 2. Greenhouse

**Domain:** `boards.greenhouse.io`, `job-boards.greenhouse.io`, `*.greenhouse.io`
**Terakhir diuji:** —

Dua generasi form hidup bersamaan: yang lama berbasis `id`, yang baru berbasis atribut `name`. Selector digabung pakai koma — `querySelector` mengambil match pertama, jadi satu entri menutup keduanya tanpa cabang kode.

| Field profil | Selector | Status | Catatan |
|---|---|---|---|
| `personal.firstName` | `#first_name, input[name='first_name']` | unverified | |
| `personal.lastName` | `#last_name, input[name='last_name']` | unverified | |
| `personal.email` | `#email, input[name='email']` | unverified | |
| `personal.phone` | `#phone, input[name='phone']` | unverified | |
| `personal.city` | `input[autocomplete='address-level2']` | unverified | |
| `documents.resume` | `#resume, input[type='file'][name*='resume']` | unverified | Upload ke S3 lewat widget sendiri, lihat §5 |
| `documents.coverLetter` | `#cover_letter, input[type='file'][name*='cover']` | unverified | |
| `links.linkedin` | `input[name*='urls'][name*='LinkedIn'], #job_application_answers_attributes_0_text_value` | unverified | Rapuh, lihat catatan bawah |

**Masalah yang sudah diketahui:** Greenhouse tidak punya field baku untuk link. LinkedIn/portfolio hampir selalu jadi *custom question*, dan indeks `job_application_answers_attributes_N` berbeda tiap lowongan. Selector di atas hanya kebetulan benar kalau pertanyaannya kebetulan yang pertama. **Untuk link di Greenhouse, andalkan heuristik label, bukan mapping ini** — heuristik justru lebih akurat karena labelnya jelas ("LinkedIn Profile").

## 3. Lever

**Domain:** `jobs.lever.co`, `jobs.eu.lever.co`
**Terakhir diuji:** —

Form paling stabil dari kandidat MVP: berbasis atribut `name`, praktis tidak berubah bertahun-tahun. Kandidat terbaik untuk platform pertama yang di-*verify*.

| Field profil | Selector | Status | Catatan |
|---|---|---|---|
| `personal.fullName` | `input[name='name']` | unverified | Satu field nama lengkap, bukan first/last |
| `personal.email` | `input[name='email']` | unverified | |
| `personal.phone` | `input[name='phone']` | unverified | |
| `personal.city` | `input[name='location']` | unverified | Autocomplete Google Places, lihat §5 |
| `work.0.company` | `input[name='org']` | unverified | Label "Current company" |
| `links.linkedin` | `input[name='urls[LinkedIn]']` | unverified | |
| `links.github` | `input[name='urls[GitHub]']` | unverified | |
| `links.portfolio` | `input[name='urls[Portfolio]']` | unverified | |
| `links.website` | `input[name='urls[Other]']` | unverified | |
| `documents.resume` | `input[type='file'][name='resume']` | unverified | |

**Catatan `personal.fullName`:** Lever minta satu field nama. Kalau `fullName` di profil kosong, **jangan** menyambung `firstName + lastName` di sini — perbaikannya di options page (isi `fullName` saat user mengisi nama). Menyambung di titik pengisian berarti aturan yang sama harus diulang di tiap platform yang punya field nama tunggal.

## 4. Heuristik (semua domain lain)

`data/keywords.json` berisi 29 entri, dua bahasa (Inggris + Indonesia). Skoring lengkap di [TDD §6.3](../TDD.md#63-lapis-2--heuristik).

Yang penting dipahami saat mengedit file itu:

**`negative` lebih penting daripada `patterns`.** Field kosong bisa diisi user dalam 3 detik; field salah terisi bisa lolos submit tanpa disadari. Contoh yang sudah ditangani:

| Label di halaman | Salah diisi jadi | Dicegah oleh |
|---|---|---|
| "Emergency Contact Phone" | nomor HP user | `personal.phone` → `negative: ["emergency", "darurat"]` |
| "Current Salary" | ekspektasi gaji | `preferences.desiredSalary` → `negative: ["current salary", "gaji saat ini"]` |
| "Company Website" | website pribadi | `links.website` → `negative: ["company website"]` |
| "Confirm Email" | email | `personal.email` → `negative: ["confirm", "konfirmasi"]` |
| "Position Applied For" | jabatan saat ini | `work.0.title` → `negative: ["applying for", "posisi dilamar"]` |

**`_neverFill` bukan bagian dari skoring.** Field yang cocok ke daftar itu dilewati tanpa syarat berapa pun skornya: password, OTP, CAPTCHA, pertanyaan EEO/demografi (ras, gender, veteran, disabilitas, agama), dan nomor identitas (NIK, NPWP, paspor, rekening). Alasan per kategori ada di [TDD §12](../TDD.md#12-yang-sengaja-tidak-ditangani).

## 5. Field yang Butuh Perlakuan Khusus

| Jenis | Perilaku | Kenapa |
|---|---|---|
| Autocomplete lokasi (Lever `location`, Greenhouse city) | Isi teks + dispatch `input`, **jangan** coba memilih item dropdown | Dropdown-nya async dan berbeda tiap vendor. Membiarkan user memilih 1 kali jauh lebih murah daripada mengejar tiap implementasi |
| Upload resume (Greenhouse) | Coba `DataTransfer`; kalau tidak ada reaksi, tandai gagal dan minta user upload manual | Greenhouse mengunggah ke S3 lewat widget sendiri. Set `.files` mungkin tidak memicu handler-nya |
| `<select>` | value persis → teks persis → teks mengandung. Gagal ketiganya = skip | Menebak opsi dropdown adalah cara halus mengirim jawaban salah |
| Field bertingkat (Country → State → City) | Isi berurutan, tunggu `change` sebelum lanjut, atau skip | Opsi turunan sering baru dimuat setelah induknya berubah |

## 6. Menambah Platform Baru

1. Buka halaman lamaran, inspect form. Catat `id`, `name`, dan label tiap field
2. Tambah objek platform di `data/mappings.json` — `id`, `label`, `match` (daftar hostname), `fields`
3. Tambah hostname ke **`host_permissions`** dan **`content_scripts.matches`** di `manifest.json`. Tanpa ini deteksi otomatis tidak jalan ([TDD §4](../TDD.md#4-permission))
4. Reload extension, uji ke ≥2 lowongan berbeda di platform itu
5. Ubah `status` jadi `verified`, tambahkan section + tabel di dokumen ini beserta tanggal uji
6. Tambahkan skenario platform tersebut ke [test-plan.md](test-plan.md)

**Prioritas selector**, dari yang paling awet ke paling rapuh:

```
1. name / id yang bermakna         input[name='email']
2. atribut data-* milik ATS        [data-automation-id='email']
3. autocomplete standar            input[autocomplete='email']
4. type + posisi                   form input[type='email']
5. class hasil build tool          .css-1x2y3z4        ← jangan
```

Jangan pernah pakai nomor 5. Class hasil bundler berubah tiap kali ATS deploy, dan mapping-nya akan mati diam-diam.

## 7. Kalau Mapping Rusak

Gejala: field yang sebelumnya terisi jadi kosong terus di satu platform.

1. Popup → **Salin laporan field**. Isinya hostname + label/name/id field yang gagal, **tanpa nilai field dan tanpa isi profil** ([TDD §10](../TDD.md#10-logging--diagnostik))
2. Bandingkan dengan tabel di atas — biasanya `id` diganti, atau field pindah ke dalam custom question
3. Set entri lama jadi `status: "broken"` (jangan dihapus), tambah entri baru
4. Kalau selector barunya rapuh, pertimbangkan tidak menambal mapping sama sekali dan cukup memperkuat `keywords.json` — heuristik tidak ikut mati saat ATS ganti markup

## 8. Backlog Platform

| Platform | Fase | Kesulitan utama |
|---|---|---|
| LinkedIn Easy Apply | 2 | Modal multi-step, class ter-obfuscate, DOM ganti tiap langkah. Butuh observer per langkah — pendekatan berbeda, bukan sekadar entri baru di JSON |
| Workday | 2 | `data-automation-id` justru stabil, tapi form multi-halaman di balik sesi login |
| Kalibrr | 2 | Prioritas lokal, belum diriset |
| JobStreet | 2 | Prioritas lokal, belum diriset |
| Glints | 3 | Belum diriset |
