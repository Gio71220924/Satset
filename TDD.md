# TDD: Satset — Technical Design Document

**Versi:** 0.1
**Turunan dari:** [PRD-JobAutofill-Extension.md](PRD-JobAutofill-Extension.md)
**Status:** Draft, belum diverifikasi ke halaman ATS live

---

## 1. Ruang Lingkup MVP

Yang dibangun:

- Editor profil (options page)
- Deteksi field + auto-fill di **Greenhouse** dan **Lever**
- Fallback heuristik untuk domain lain (dipicu manual lewat klik ikon)
- Upload file resume otomatis ke `input[type=file]`
- Highlight visual + undo

Yang **tidak** dibangun di MVP (alasan di §11):

- Parsing CV (PDF/DOCX) → Fase 2
- LinkedIn Easy Apply → Fase 2
- Cover letter generator → Fase 2
- Sync lintas device / backend → Fase 3 atau tidak sama sekali
- Multi-profil → Fase 2

## 2. Stack

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Manifest | MV3 | Wajib, MV2 sudah tidak diterima Chrome Web Store |
| Build step | **Tidak ada** | Load unpacked langsung. Tanpa npm, bundler, transpiler |
| Framework UI | **Tidak ada** | Options page = form HTML. Popup = list + 2 tombol. React di sini murni beban |
| Modul di content script | `manifest.content_scripts[].js: [a.js, b.js]` | Content script MV3 tidak mendukung `import`. Array file = multi-file tanpa bundler, berbagi scope global |
| Modul di service worker | `"type": "module"` | SW mendukung ESM native |
| Data mapping | `data/*.json` di `web_accessible_resources`, di-`fetch` | Mapping jadi data, bukan kode. Bisa diedit tanpa sentuh logic |
| Storage | `chrome.storage.local` | Lihat §8 |

> Kalau nanti butuh bundler (misal mau pakai pdf.js untuk parsing CV), tambahkan `esbuild` satu perintah tanpa config file. Jangan sebelum itu.

## 3. Struktur Folder

```
manifest.json
src/
  schema.js         # definisi profil + default + migrasi (dipakai options & popup)
  options.html
  options.js        # editor profil
  popup.html
  popup.js          # preview hasil scan, tombol Isi / Undo
  sw.js             # service worker: badge saja
  content/
    dom.js          # util: cari label, cek field bisa diisi, set value ala-React
    match.js        # mapping platform + scoring heuristik
    fill.js         # eksekusi isi, highlight, undo, entry point pesan
data/
  mappings.json     # selector per platform  (lihat docs/field-mapping.md)
  keywords.json     # kamus heuristik
docs/
  profile-schema.md
  field-mapping.md
  ux-flows.md
  test-plan.md
  roadmap.md
PRIVACY.md
```

Urutan `content/` di manifest: `dom.js`, `match.js`, `fill.js` (bergantung berurutan).

## 4. Permission

```json
{
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://boards.greenhouse.io/*",
    "https://job-boards.greenhouse.io/*",
    "https://jobs.lever.co/*"
  ]
}
```

**Tidak pakai `<all_urls>`.** Ini keputusan sadar:

- Domain ATS yang sudah punya mapping → content script auto-inject lewat `content_scripts` (deteksi otomatis jalan, badge muncul sendiri)
- Domain lain → tidak ada script yang jalan sampai user klik ikon extension. `activeTab` + `chrome.scripting.executeScript` inject on demand

Efeknya: heuristik fallback butuh 1 klik, bukan otomatis. Trade-off yang diambil karena `<all_urls>` di extension yang menyimpan data pribadi hampir pasti kena review panjang atau ditolak Chrome Web Store, dan itu risiko rilis yang lebih mahal daripada 1 klik ekstra.

Setiap penambahan platform ke `mappings.json` juga harus menambah entry di `host_permissions` + `content_scripts.matches`.

## 5. Komunikasi Antar Komponen

Tiga arah pesan saja. Tidak ada state global di service worker.

```
[content script]  --('detected', {count})-->  [service worker]  --> chrome.action.setBadgeText
[popup] --('scan')--> [content script] --(FieldReport[])--> [popup]
[popup] --('fill', {profile})--> [content script] --(FillResult)--> [popup]
[popup] --('undo')--> [content script]
```

Semua lewat `chrome.tabs.sendMessage` / `chrome.runtime.sendMessage`. Payload:

```js
// FieldReport — hasil scan, dikirim ke popup untuk preview
{ id: 3, label: "First Name", path: "personal.firstName",
  source: "mapping" | "heuristic", score: 5, currentValue: "" }

// FillResult
{ filled: 8, skipped: 2, failed: 0 }
```

**Profil tidak disimpan di service worker.** Popup baca `chrome.storage.local` sendiri lalu kirim ke content script. SW hanya penerima event `detected` untuk set badge (±20 baris). Kalau nanti badge tidak diperlukan, SW bisa dihapus total.

Content script menyimpan hasil scan terakhir di variabel modul (`let lastScan`) supaya `fill` tidak perlu scan ulang. Hilang saat halaman reload — itu benar, karena DOM juga berubah.

## 6. Algoritma Pencocokan Field

### 6.1 Kandidat

Kumpulkan `input, select, textarea` yang lolos semua syarat:

- Bukan `type` = `password`, `hidden`, `submit`, `button`, `image`, `reset`
- Tidak `disabled`, tidak `readonly`
- Terlihat: `offsetParent !== null` **atau** `checkVisibility()` true
- Nilai masih kosong (kecuali user aktifkan "timpa isian yang sudah ada")

### 6.2 Lapis 1 — mapping platform

Cocokkan `location.hostname` ke `platforms[].match` (glob sederhana, `*` di awal saja). Untuk tiap entri `fields[]`, `document.querySelector(selector)`. Ketemu → pakai, `source: "mapping"`, skor maksimum. Selector yang tidak ketemu di-log, tidak error.

### 6.3 Lapis 2 — heuristik

Untuk kandidat yang belum ter-klaim lapis 1, susun **haystack**:

```
label.textContent + " " + name + " " + id + " " + placeholder + " " + aria-label
```

lalu `.toLowerCase()`, ganti `_ - [ ]` jadi spasi, rapikan whitespace.

Resolusi label, ambil yang pertama berhasil:

1. `el.labels[0].textContent`
2. `el.closest('label').textContent`
3. `document.getElementById(el.getAttribute('aria-labelledby')).textContent`
4. teks node sebelumnya di parent yang sama

Skoring terhadap tiap entri `keywords.json`:

| Kondisi | Skor |
|---|---|
| Pola cocok persis dengan `name` atau `id` | +3 |
| Pola cocok sebagai kata utuh di label (`\bpola\b`) | +2 |
| Pola muncul sebagai substring di placeholder / aria-label | +1 |
| Pola `negative` muncul di mana pun | −4 |

Aturan keputusan:

- Skor tertinggi menang, **minimum 2** untuk boleh diisi
- Selisih skor juara 1 dan juara 2 < 1 → **dilewati** (ambigu, biar user isi manual)
- Satu `path` profil hanya boleh dipakai satu field per halaman

Contoh kenapa `negative` penting: label "Emergency Contact Phone" jangan diisi nomor HP user. Entri `personal.phone` punya `negative: ["emergency", "reference", "darurat"]`.

### 6.4 Lapis 3 — klasifikasi LLM

Tidak diimplementasi. Kumpulkan dulu log field yang gagal (§10) selama beberapa minggu pemakaian nyata; kalau ternyata heuristik sudah menutup >90% kasus, lapis ini tidak pernah perlu dibangun.

## 7. Eksekusi Pengisian

### 7.1 Text input — masalah React

Set `el.value = x` langsung **tidak terbaca** oleh React/Vue karena keduanya melacak nilai lewat setter internal. Greenhouse dan Lever versi baru pakai React. Wajib lewat native setter:

```js
function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```

Ini sekaligus menjawab risiko "ATS memblokir input hasil script" di PRD §10: event-nya event DOM asli yang bubbling, bukan simulasi keyboard. Tidak perlu `execCommand` atau trik keystroke.

### 7.2 `<select>`

Cocokkan `option` dengan urutan: `value` persis → `textContent` persis → `textContent` mengandung nilai (case-insensitive). Tidak ketemu → skip, jangan tebak. Lalu dispatch `change`.

### 7.3 File input (resume)

```js
const dt = new DataTransfer();
dt.items.add(new File([blob], doc.name, { type: doc.mime }));
el.files = dt.files;
el.dispatchEvent(new Event('change', { bubbles: true }));
```

`blob` direkonstruksi dari base64 yang tersimpan di profil (`documents.resume.data`). Bekerja karena content script punya akses DOM penuh meski berjalan di isolated world.

### 7.4 Highlight & undo

Highlight: `el.style.outline = '2px solid #22c55e'` + `el.title = 'Diisi Satset'`. Tanpa shadow DOM, tanpa CSS injection, tanpa elemen overlay. Nilai lama disimpan di `Map<Element, {value, outline, title}>` untuk undo. Undo membalik nilai lewat `setNativeValue` yang sama.

Outline dihapus saat `blur` pertama di field itu, supaya halaman tidak terlihat berantakan setelah user selesai review.

## 8. Storage & Enkripsi

Satu key: `chrome.storage.local.set({ satset: { schemaVersion, profile, settings } })`. Skema lengkap di [docs/profile-schema.md](docs/profile-schema.md).

**Tidak ada enkripsi di MVP.** Alasan: kunci enkripsi harus tersimpan di tempat yang bisa dibaca extension itu sendiri, artinya kunci berada di sebelah datanya. Penyerang yang bisa membaca `chrome.storage.local` bisa membaca kuncinya juga — lapisan itu tidak menambah keamanan nyata, hanya menambah kode.

Enkripsi yang benar-benar berarti butuh passphrase yang **tidak** ikut disimpan, di-derive lewat PBKDF2/WebCrypto, dan dimasukkan ulang user tiap sesi browser. Itu keputusan produk (UX vs keamanan), bukan keputusan teknis — dan belum diambil. Sampai diambil, `PRIVACY.md` wajib jujur menyebut data disimpan tanpa enkripsi tambahan di storage lokal browser.

Kuota `chrome.storage.local` ±10 MB. Resume PDF 500 KB → ±680 KB setelah base64. Cukup. Tolak file >2 MB di UI upload.

## 9. Versi Skema & Migrasi

`schemaVersion` integer di root. `src/schema.js` mengekspor `migrate(stored)` yang menjalankan migrasi berurutan dari versi tersimpan ke versi sekarang, dipanggil tiap kali profil dibaca. Kalau versi tersimpan **lebih besar** dari versi kode (user downgrade extension) → tolak baca, tampilkan pesan, **jangan timpa**.

## 10. Logging & Diagnostik

Satu fitur diagnostik, dipakai untuk memperbaiki mapping:

Tombol "Salin laporan field" di popup → menyalin JSON berisi hostname dan, untuk tiap field yang **gagal** dicocokkan: label, name, id, placeholder, type. **Tanpa nilai field, tanpa isi profil.** Dipakai untuk menambah entri ke `keywords.json` / `mappings.json`.

Tidak ada telemetri otomatis, tidak ada pengiriman ke server. User yang menyalin dan mengirim manual kalau mau.

## 11. Keputusan yang Menutup PRD §11

| Pertanyaan PRD | Keputusan | Alasan |
|---|---|---|
| Sync lintas device? | Tidak. Local saja | Butuh backend + auth + kebijakan data. Ekspor/impor JSON di options page menutup ±90% kebutuhannya dengan ±30 baris kode |
| Berapa ATS di rilis pertama? | 2: Greenhouse, Lever | Keduanya form statis, selector stabil, tanpa login wall, bisa diuji dengan lowongan publik |
| Cover letter generator di MVP? | Tidak, Fase 2 | Butuh API LLM = biaya, API key, kebijakan privasi yang jauh lebih berat. Tidak berbagi kode dengan mesin autofill |
| LinkedIn Easy Apply di MVP? | Tidak, Fase 2 | Modal multi-step, DOM React ter-obfuscate yang sering berubah, butuh state machine antar langkah. Effort-nya sendirian setara dua platform lain digabung |
| Parsing CV di MVP? | Tidak, Fase 2 | pdf.js + heuristik layout resume adalah proyek tersendiri. Isi profil manual sekali ≈ 10 menit dan hasilnya lebih akurat daripada parser |

## 12. Yang Sengaja Tidak Ditangani

Ditulis eksplisit supaya tidak dikira lupa:

- **Form multi-step / wizard.** Scan ulang per langkah, user klik ikon lagi. Tidak ada pelacakan lintas langkah
- **iframe.** Sebagian career page menyematkan Greenhouse lewat iframe. `all_frames: true` menutup sebagian kasus, tapi iframe lintas-origin tetap butuh host permission untuk origin iframe-nya. Tangani per kasus saat ketemu
- **Pertanyaan EEO/demografi** (ras, gender, veteran, disabilitas). Tidak diisi otomatis sama sekali. Jawabannya punya konsekuensi berbeda per yurisdiksi dan sering opsional — biar user yang putuskan tiap kali
- **Pertanyaan spesifik posisi** ("Kenapa tertarik dengan role ini?"). Di luar cakupan autofill
- **CAPTCHA, rate limiting, anti-bot.** Tidak ada usaha melewatinya
