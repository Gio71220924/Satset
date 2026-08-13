# Roadmap

Asumsi: **satu orang, paruh waktu**, kira-kira 8–10 jam per minggu. Estimasi ditulis relatif ("Minggu 1"), bukan tanggal, karena belum ada tanggal mulai.

Aturan yang berlaku di seluruh roadmap: **tiap milestone harus menghasilkan sesuatu yang bisa dipakai sendiri.** Bukan "storage layer selesai" lalu menunggu tiga minggu untuk tahu apakah pendekatannya benar.

---

## Sudah Selesai — M0: Dokumentasi & Skema

| Artefak | Status |
|---|---|
| [PRD](../PRD-JobAutofill-Extension.md) | ✅ |
| [TDD](../TDD.md) | ✅ |
| [`src/schema.js`](../src/schema.js) + test (6/6 hijau) | ✅ |
| [Skema profil](profile-schema.md) | ✅ |
| [`data/mappings.json`](../data/mappings.json), [`data/keywords.json`](../data/keywords.json) | ✅ semua entri `unverified` |
| [Field-mapping spec](field-mapping.md) | ✅ |
| [UX flow](ux-flows.md) | ✅ |
| [Test plan](test-plan.md) | ✅ |
| [Privacy policy](../PRIVACY.md) | ✅ draft, 3 isian kosong |

---

## M1 — Profil Bisa Disimpan (Minggu 1)

**Selesai kalau:** profil terisi lewat options page, bertahan setelah browser ditutup, dan bisa diekspor–impor.

- [ ] `manifest.json` MV3: `storage`, options page, popup, ikon
- [ ] `src/options.html` + `options.js` — semua section dari [ux-flows §3](ux-flows.md#3-options-page--editor-profil)
- [ ] Auto-save saat blur, indikator "Tersimpan"
- [ ] Kartu berulang untuk pengalaman & pendidikan (tambah, hapus, urutkan)
- [ ] Upload resume → base64, tolak >2 MB
- [ ] Ekspor / impor JSON, termasuk konfirmasi ekspor
- [ ] Popup versi minimal: "Buka pengaturan"

Uji: S1–S8 di [test plan §3](test-plan.md#3-storage--profil).

> Belum ada content script sama sekali di sini. Kalau bentuk skema ternyata keliru, ketahuannya sekarang — saat memperbaikinya masih murah.

## M2 — Lever Terisi (Minggu 2)

**Selesai kalau:** satu form Lever sungguhan terisi dan lolos submit.

Lever duluan, bukan Greenhouse: form-nya berbasis `name`, paling stabil, dan tidak punya widget upload khusus. Platform pertama sebaiknya yang paling tidak melawan.

- [x] `src/content/dom.js` — resolusi label, cek kelayakan field, `setNativeValue()`
- [x] `src/content/match.js` — dua lapis, mapping + heuristik
- [x] `src/content/fill.js` — isi, highlight, undo
- [x] `src/sw.js` — badge
- [x] Popup: daftar field + preview + tombol isi ([ux-flows §2](ux-flows.md#2-popup))
- [x] Upload resume lewat `DataTransfer`
- [ ] **Verifikasi selector Lever ke halaman live**, ubah `status` jadi `verified`, catat tanggal di [field-mapping §3](field-mapping.md#3-lever)

Uji: T1–T7 untuk Lever.

**Risiko terbesar ada di milestone ini.** T3.1 (submit tanpa menyentuh field) menentukan apakah `setNativeValue` benar-benar bekerja.

Sebagian sudah dijawab: fixture React controlled input lokal membuktikan `setNativeValue` mengubah state React untuk `<input>` maupun `<textarea>`. Tapi fixture itu tidak memasang value tracker, jadi **belum** membuktikan form ATS sungguhan bereaksi sama. T3.1 di halaman asli tetap wajib.

## M3 — Deteksi Universal (Minggu 3)

**Selesai kalau:** form lamaran di portal mana pun bisa diisi, dan portal ATS populer terdeteksi tanpa diklik.

Awalnya milestone ini bernama "Greenhouse + heuristik". Diubah setelah jelas mesin heuristiknya sudah platform-agnostik sejak awal — yang mengunci cuma daftar domain di manifest. Menambah platform satu per satu berarti mengerjakan ulang hal yang sama belasan kali.

- [x] `score.js` lapis 2: skoring + `negative` + `_neverFill`, terpisah dari DOM
- [x] `score.test.js` — 8 test lewat `node:vm`, memakai `keywords.json` asli
- [x] 17 pola vendor ATS di `content_scripts.matches` — deteksi otomatis
- [x] Injeksi on-demand lewat `activeTab` + `scripting` — situs mana pun, satu klik
- [x] `optional_host_permissions: ["<all_urls>"]` + toggle di pengaturan, default mati
- [x] Popup: pembeda `✓` / `~` / `⊘`
- [x] "Salin laporan kolom"
- [x] Penahan honeypot anti-bot
- [ ] Verifikasi selector Greenhouse, tangani dua generasi form
- [ ] Upload resume Greenhouse (S3) — kalau gagal, tampilkan pesan, jangan dipaksa
- [ ] Mapping Workday (`data-automation-id`) — kandidat berikutnya, selectornya stabil

Uji: T5 lengkap di ≥3 portal berbeda, termasuk satu yang tidak ada di daftar vendor.

> `score.test.js` ditulis berbarengan dengan `score.js`, bukan sesudahnya — dan langsung menangkap satu bug: aturan "cocok persis dengan name/id" tidak pernah kena di dunia nyata, karena ATS menamai kolomnya `urls[LinkedIn]` dan `job_application_first_name`.

**Konsekuensi jadi universal:** kualitas `keywords.json` sekarang menentukan seluruh produk, bukan cuma satu platform. Laporan kolom naik dari fitur pinggiran jadi mekanisme inti — tiap kolom yang gagal adalah bahan menambah pola, dan 22 test yang ada adalah jaring pengamannya.

## M4 — Layak Pakai Sendiri (Minggu 4)

**Selesai kalau:** Anda memakainya untuk melamar sungguhan selama seminggu tanpa merasa terganggu.

- [ ] Semua penanganan error di [ux-flows §5](ux-flows.md#5-penanganan-error)
- [ ] Halaman pengaturan: `overwriteFilled`, `autoDetect`, hapus semua data
- [ ] Ikon extension (16/32/48/128)
- [ ] Perbaiki apa pun yang mengganggu selama pemakaian nyata

**Ini gerbang keputusan, bukan sekadar milestone.** Kalau setelah seminggu Anda sendiri tidak terdorong memakainya, masalahnya ada di produk, dan merilis ke Chrome Web Store tidak akan memperbaikinya.

## M5 — Rilis (Minggu 5)

- [ ] Checklist R1–R7 di [test plan §4](test-plan.md#4-sebelum-rilis-ke-chrome-web-store)
- [ ] Lengkapi PRIVACY.md, host di URL publik, buat versi bahasa Inggris
- [ ] Form Data Safety + justifikasi izin di Developer Dashboard, konsisten dengan PRIVACY.md §5
- [ ] Screenshot listing, deskripsi toko
- [ ] Bayar biaya developer (sekali, US$5), submit

Siapkan waktu untuk siklus review. Penolakan pertama lazim terjadi dan biasanya soal justifikasi izin — perbaiki dan submit ulang.

---

## Fase 2 — Setelah Ada Pengguna Nyata

Diurutkan berdasarkan **rasio nilai terhadap effort**, bukan menarik atau tidaknya.

| # | Item | Effort | Catatan |
|---|---|---|---|
| 1 | Kalibrr, JobStreet | S | Sekadar menambah entri mapping. Diferensiasi lokal yang tidak dimiliki kompetitor luar |
| 2 | Multi-profil | M | Bungkus `profile` jadi array + pemilih di popup. Skema sudah siap untuk ini |
| 3 | Riwayat lamaran | M | Catat domain + tanggal + posisi saat mengisi. Berdiri sendiri, tidak menyentuh mesin autofill |
| 4 | Parsing CV | L | pdf.js + heuristik layout. Proyek tersendiri, dan hasilnya belum tentu lebih akurat daripada mengetik manual sekali |
| 5 | LinkedIn Easy Apply | L | Butuh state machine per langkah. Effort-nya sendirian ≈ Greenhouse + Lever digabung |
| 6 | Cover letter generator | L | Butuh API LLM → biaya, API key, dan menulis ulang bab besar kebijakan privasi. Wajib opt-in |
| 7 | Workday | L | `data-automation-id` stabil, tapi multi-halaman di balik login |

**Urutan boleh berubah, dan sebaiknya memang berubah.** Setelah ada pengguna, laporan field yang masuk akan memberitahu platform mana yang benar-benar dibutuhkan — dan itu jawaban yang lebih baik daripada tebakan di tabel ini.

## Fase 3 — Hanya Kalau Ada Alasannya

| Item | Prasyarat |
|---|---|
| Sync lintas device | Ada yang benar-benar mengeluhkan ekspor/impor manual. Butuh backend + auth + kebijakan privasi baru seluruhnya |
| Enkripsi berbasis passphrase | Ada permintaan nyata, dan siap menerima UX memasukkan passphrase tiap sesi ([TDD §8](../TDD.md#8-storage--enkripsi)) |
| Klasifikasi field via LLM | Laporan field membuktikan heuristik tertinggal di bawah ~90% ([TDD §6.4](../TDD.md#64-lapis-3--klasifikasi-llm)) |
| Firefox / Edge | Ada permintaan. MV3 mirip, tapi tetap butuh jalur uji terpisah |

Tiga baris pertama bukan pekerjaan yang ditunda — semuanya adalah pekerjaan yang **belum terbukti perlu**. Jangan mulai sebelum prasyaratnya terpenuhi.

---

## Jalur Kritis

```
M1 skema & storage
      │
      ▼
M2 setNativeValue jalan di React  ◄── risiko tertinggi seluruh proyek
      │
      ▼
M3 heuristik + platform kedua
      │
      ▼
M4 dipakai sendiri  ◄── gerbang keputusan: lanjut atau berhenti
      │
      ▼
M5 rilis
```

Kalau harus memotong lingkup, potong dari M3 (Greenhouse boleh mundur) — jangan dari M2 atau M4.
