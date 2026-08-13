# Satset

**Sistem Auto Tempel Sat-set Emang Top** — Chrome extension untuk mengisi form lamaran kerja otomatis dari satu profil tersimpan.

> Status: **v0.3.0, dalam pengembangan.** Sudah bisa dipakai lewat *load unpacked*, belum ada di Chrome Web Store.

---

## Masalah

Melamar kerja online berarti mengisi data yang sama berulang-ulang di tiap platform: nama, email, nomor HP, riwayat pendidikan, pengalaman kerja, link portofolio. Melamar ke puluhan posisi berarti mengetik hal yang sama puluhan kali — memakan waktu, dan menurunkan motivasi untuk apply secara konsisten.

## Cara Kerja

1. **Isi profil sekali** di halaman pengaturan extension — data pribadi, pendidikan, pengalaman kerja, tautan, resume
2. **Buka halaman lamaran.** Extension membaca elemen form di halaman lewat content script
3. **Kolom dicocokkan ke profil** — "Full Name" ke nama, "Email" ke email, dan seterusnya
4. **Preview dulu, baru isi.** Popup menampilkan nilai yang akan ditulis sebelum menyentuh halaman
5. **Kolom yang terisi diberi outline** supaya mudah di-review
6. **Kamu yang menekan submit.** Satset tidak pernah menekannya

## Cakupan

Tidak ada portal yang "tidak didukung". Yang berbeda hanya akurasi dan apakah perlu satu klik:

| Tingkat | Cakupan | Cara |
|---|---|---|
| **Otomatis + mapping** | Lever, Greenhouse | Selector khusus, akurasi tertinggi, ditandai `✓` |
| **Otomatis** | 17 vendor ATS | Heuristik jalan sendiri, badge muncul, ditandai `~` |
| **Sekali klik** | Situs mana pun | Popup → "Pindai halaman ini" |

Vendor yang terdeteksi otomatis: Workday, Lever, Greenhouse, Ashby, SmartRecruiters, Workable, iCIMS, Taleo, BambooHR, Recruitee, Teamtailor, Breezy, Jobvite, Rippling, Kalibrr, JobStreet, Glints.

Yang didaftarkan adalah **vendor ATS, bukan perusahaan** — mayoritas perusahaan menyewa salah satu vendor di atas alih-alih membuat form sendiri.

Opsional: toggle **"Deteksi otomatis di semua situs"** di pengaturan (default mati) meminta izin `<all_urls>` supaya portal apa pun terdeteksi tanpa diklik.

## Pasang

Belum ada di Chrome Web Store. Sementara ini lewat *load unpacked*:

1. Clone repo ini
2. Buka `chrome://extensions`
3. Nyalakan **Developer mode** (kanan atas)
4. **Load unpacked** → pilih folder repo
5. Pin ikon Satset lewat menu puzzle 🧩 di toolbar

Setelah mengubah kode: klik **⟳** di kartu extension. Jangan *remove lalu load lagi* — itu menghapus profil yang tersimpan.

## Pakai

**Sekali di awal** — klik ikon → **Isi profil** → halaman pengaturan terbuka.

| Mau apa | Caranya |
|---|---|
| Isi data | Ketik lalu klik keluar dari kolom. Tersimpan otomatis |
| Tambah pengalaman kerja | **+ Tambah** di section Pengalaman |
| Kerja yang masih jalan | Centang "Masih bekerja di sini" |
| Upload CV | Section Dokumen, maks 2 MB |
| Backup / pindah perangkat | **Ekspor profil** → `.json`, lalu **Impor profil** |
| Mulai dari nol | **Hapus semua data** |

Kartu pengalaman paling atas dipakai untuk kolom "Current company" dan "Current title".

**Tiap lamaran** — buka halaman apply, klik ikon Satset, periksa preview, klik **Isi N kolom**, review, submit sendiri.

Kalau ada kolom yang tidak kena, klik **Salin laporan kolom**. Isinya label/name/id kolom yang gagal, tanpa nilai kolom dan tanpa isi profil — aman dibagikan untuk memperbaiki kamus pencocokan.

## Yang Sengaja Tidak Diisi

Bukan keterbatasan, tapi keputusan:

- **Checkbox dan radio** — mencentang persetujuan atas nama user tidak pernah boleh terjadi
- **Pertanyaan EEO/demografi** (ras, gender, veteran, disabilitas, agama)
- **Password, OTP, CAPTCHA**
- **Nomor identitas** — NIK, NPWP, paspor, rekening
- **Kolom yang sudah ada isinya**, kecuali kamu menyalakannya sendiri
- **Kolom ambigu** — kalau dua kandidat berimbang, dilewati. Kolom kosong lebih murah daripada kolom salah isi

## Tech Stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Platform | Chrome Extension **Manifest V3** | Wajib untuk Chrome Web Store |
| Bahasa | **Vanilla JavaScript** | — |
| Build step | **Tidak ada** | Load unpacked langsung. Tanpa npm install, bundler, atau transpiler |
| Dependency runtime | **Nol** | — |
| Framework UI | **Tidak ada** | Halaman pengaturan = form HTML, popup = daftar + dua tombol |
| Styling | CSS variabel, light + dark | Mengikuti `prefers-color-scheme` |
| Storage | `chrome.storage.local` | Tanpa server, tanpa akun, tanpa sinkronisasi |
| Test | `node:test` + `node:vm` bawaan Node | Tanpa framework, tanpa dependency |

Modul dipakai di halaman extension (`type="module"`); content script memakai classic script karena MV3 tidak mendukung `import` di sana — berkasnya dimuat berurutan lewat `content_scripts[].js` dan berbagi scope global.

## Struktur

```text
manifest.json          MV3: izin, daftar vendor, content script
src/
  schema.js            skema profil + migrasi + getPath/setPath  <- sumber kebenaran
  options.html/js      editor profil
  popup.html/js        preview hasil scan, tombol isi, undo
  sw.js                badge, relay data, registrasi skrip dinamis
  ui.css               token warna + komponen
  content/
    score.js           skoring heuristik  (tanpa DOM, bisa diuji)
    dom.js             baca/tulis elemen form
    match.js           mapping platform + heuristik
    fill.js            eksekusi, highlight, undo, handler pesan
data/
  mappings.json        selector per platform
  keywords.json        kamus pencocokan, dua bahasa
docs/                  skema, field mapping, UX flow, test plan, roadmap
```

## Test

```bash
node --test        # dari root repo
```

24 test, nol dependency. Yang diuji: migrasi skema, validasi impor, dan skoring heuristik — termasuk kasus yang **harus gagal**, seperti "Emergency Contact Phone" yang tidak boleh kena nomor HP dan "Current Salary" yang tidak boleh kena ekspektasi gaji.

`score.js` sengaja dipisah dari DOM supaya bisa diuji di Node. Berkasnya tetap classic script untuk Chrome; test memuatnya lewat `node:vm`, jadi yang diuji benar-benar berkas yang dikirim ke browser.

## Privasi

Data profil disimpan **di browser kamu sendiri**. Tidak ada server, tidak ada akun, tidak ada telemetri, tidak ada pustaka eksternal.

Data hanya keluar dari perangkat lewat tindakanmu sendiri: mengisi form (terkirim ke perusahaan saat **kamu** menekan submit), atau mengekspor profil ke file.

**Disimpan tanpa enkripsi tambahan.** Alasannya dijelaskan di [PRIVACY.md](PRIVACY.md) bagian 4 — enkripsi dengan kunci yang ikut tersimpan tidak menambah keamanan nyata, dan kami memilih menyatakannya terus terang.

## Dokumen

| File | Isi |
|---|---|
| [PRD](PRD-JobAutofill-Extension.md) | Produk, user story, metrik |
| [TDD](TDD.md) | Arsitektur, izin, algoritma pencocokan, keputusan teknis |
| [docs/profile-schema.md](docs/profile-schema.md) | Konvensi skema profil |
| [docs/field-mapping.md](docs/field-mapping.md) | Selector per ATS, cara menambah platform |
| [docs/ux-flows.md](docs/ux-flows.md) | Wireframe popup, pengaturan, indikator halaman |
| [docs/test-plan.md](docs/test-plan.md) | Skenario uji manual + otomatis |
| [docs/roadmap.md](docs/roadmap.md) | Milestone M1–M5 |
| [PRIVACY.md](PRIVACY.md) | Kebijakan privasi |

## Status

| Milestone | |
|---|---|
| M0 dokumentasi & skema | ✅ |
| M1 profil bisa disimpan | ✅ kode selesai |
| M2 pengisian form | ✅ kode selesai, verifikasi selector belum |
| M3 deteksi universal | 🔄 sebagian |
| M4 layak pakai sendiri | ⬜ |
| M5 rilis Chrome Web Store | ⬜ |

**Selector di `mappings.json` masih berstatus `unverified`** — ditulis dari struktur form yang umum, belum diuji ke halaman lamaran live. Heuristik menutup sebagian besar kasus, tapi jangan anggap mapping-nya pasti benar.

Belum ada: parsing CV otomatis, LinkedIn Easy Apply, multi-profil, riwayat lamaran, sinkronisasi lintas perangkat. Semuanya Fase 2+ di [roadmap](docs/roadmap.md).
