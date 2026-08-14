# Skema Profil

**Definisi resmi ada di [`src/schema.js`](../src/schema.js)**, bukan di dokumen ini. File itu yang di-import options page dan popup, jadi kalau keduanya berbeda, kode yang benar. Dokumen ini hanya menjelaskan konvensi dan alasan di balik bentuknya.

Cek: `node --test` dari root repo.

---

## 1. Layout Storage

Dua key di `chrome.storage.local`:

```jsonc
{
  "satset": {
    "schemaVersion": 2,
    "profiles": [
      { "id": "…uuid…", "name": "Data Analyst", "data": { /* §2 */ } },
      { "id": "…uuid…", "name": "ML Engineer",  "data": { /* §2 */ } }
    ],
    "activeId": "…uuid…",
    "settings": { /* §5 */ }
  },

  "satset_log": [ /* riwayat lamaran, lihat src/log.js */ ]
}
```

`data` di tiap profil bentuknya **persis** seperti `profile` di skema v1 — v2 hanya membungkusnya. Itu sengaja: `getPath`, `setPath`, dan `fillDefaults` tidak perlu berubah sama sekali, dan migrasi 1→2 cukup membungkus tanpa menyentuh isinya.

Profil ada di satu key, bukan satu key per section: `storage.local.get('satset')` sekali, tulis sekali, tidak ada state setengah jadi kalau tulis gagal di tengah.

Riwayat dipisah ke key sendiri karena alasan sebaliknya — menulis riwayat tiap kali mengisi form tidak boleh ikut menulis ulang resume base64 ratusan KB, dan riwayat harus bisa dihapus tanpa menyentuh profil.

`id` dibuat dengan `crypto.randomUUID()` bawaan. Profil aktif dibaca lewat `activeProfile(state)` di `src/schema.js` — kalau `activeId` menunjuk profil yang sudah dihapus, ia jatuh ke profil pertama, tidak melempar.

Pengecualian yang mungkin muncul nanti: kalau `documents` membuat tiap penyimpanan terasa lambat, pindahkan juga ke key terpisah. Belum perlu.

## 2. Section Profil

| Section | Tipe | Isi |
|---|---|---|
| `personal` | object | nama, kontak, alamat, kewarganegaraan |
| `links` | object | linkedin, github, portfolio, website |
| `work` | array | riwayat pekerjaan, urut terbaru dulu |
| `education` | array | riwayat pendidikan, urut terbaru dulu |
| `skills` | array of string | |
| `languages` | array | `{name, proficiency}` |
| `documents` | object | `resume`, `coverLetter` — `StoredFile` atau `null` |
| `preferences` | object | gaji, notice period, izin kerja, relokasi |
| `updatedAt` | string | ISO 8601, diisi saat simpan |

Contoh terisi (nilai sintetis):

```jsonc
{
  "personal": {
    "firstName": "Ana", "lastName": "Wijaya", "fullName": "Ana Wijaya",
    "email": "ana@contoh.id", "phone": "+6281234567890",
    "dateOfBirth": "1999-04-17",
    "addressLine": "Jl. Contoh No. 1", "city": "Bandung",
    "province": "Jawa Barat", "postalCode": "40111",
    "country": "Indonesia", "nationality": "Indonesian"
  },
  "links": {
    "linkedin": "https://linkedin.com/in/contoh",
    "github": "https://github.com/contoh",
    "portfolio": "", "website": ""
  },
  "work": [
    { "company": "PT Contoh", "title": "Data Analyst", "location": "Bandung",
      "startDate": "2023-08", "endDate": null, "current": true,
      "description": "Membangun dashboard operasional." }
  ],
  "education": [
    { "school": "Universitas Contoh", "degree": "S1",
      "fieldOfStudy": "Teknik Informatika", "location": "Bandung",
      "startDate": "2018-08", "endDate": "2022-07", "gpa": "3.45" }
  ],
  "skills": ["Python", "SQL", "React"],
  "languages": [
    { "name": "Indonesian", "proficiency": "native" },
    { "name": "English", "proficiency": "professional" }
  ],
  "documents": {
    "resume": { "name": "CV_Ana.pdf", "mime": "application/pdf",
                "size": 512000, "data": "JVBERi0xLjQK..." },
    "coverLetter": null
  },
  "preferences": {
    "desiredSalary": "Rp 12.000.000/bulan", "noticePeriod": "1 bulan",
    "availableFrom": "2026-09-01", "workAuthorization": "WNI",
    "requiresSponsorship": false, "willingToRelocate": true
  },
  "updatedAt": "2026-08-11T09:30:00.000Z"
}
```

## 3. Konvensi Tipe

**Semua field teks default `""`, bukan `null` atau `undefined`.** `null` hanya dipakai di dua tempat yang artinya memang beda: `endDate: null` = masih berjalan, dan `documents.resume: null` = belum upload. Sisanya string kosong, supaya options page bisa bind langsung ke `<input>` tanpa cek null di tiap field.

**Tanggal:**

| Field | Format | Alasan |
|---|---|---|
| `work[].startDate`, `endDate` | `"YYYY-MM"` | ATS hanya minta bulan+tahun. Tanpa hari = tidak ada pertanyaan "tanggal berapa persisnya" |
| `education[].startDate`, `endDate` | `"YYYY-MM"` | sama |
| `personal.dateOfBirth` | `"YYYY-MM-DD"` | butuh hari, cocok dengan `<input type="date">` |
| `preferences.availableFrom` | `"YYYY-MM-DD"` | sama |
| `updatedAt` | ISO 8601 UTC | timestamp mesin |

Tidak ada objek `Date` yang disimpan. Semua string. `chrome.storage` melewatkan JSON, `Date` akan berubah jadi string ISO tanpa diminta dan berbeda-beda tergantung jalur — string dari awal menghilangkan seluruh kelas bug itu, plus `"YYYY-MM"` sudah urut secara leksikografis.

**`gpa` adalah string, bukan number.** "3.450" harus terisi persis seperti user menulisnya; `parseFloat` akan membuangnya jadi "3.45".

**`phone` format E.164** (`+62...`). Sebagian ATS memvalidasi, dan konversi ke format lokal (`0812...`) mudah dilakukan saat mengisi kalau nanti diperlukan — sebaliknya tidak.

**`work[].current` redundan** dengan `endDate === null`. Sengaja disimpan karena banyak ATS punya checkbox "I currently work here" yang perlu diisi terpisah dari field tanggal. Options page wajib menjaga keduanya sinkron.

## 4. Referensi Path

Mapping dan heuristik menunjuk field profil lewat **string path bertitik**, bukan struktur bersarang:

```
personal.firstName
links.linkedin
work.0.company          ← indeks 0 = pekerjaan terbaru
education.0.school
preferences.willingToRelocate
skills                  ← array, jadi "Python, SQL, React"
```

Dibaca lewat `getPath(profile, path)` di `src/schema.js`. Aturan konversi ke string:

| Nilai | Hasil |
|---|---|
| `null` / `undefined` / path tidak ada | `""` |
| array | digabung `", "` |
| boolean | `"Yes"` / `"No"` |
| lainnya | `String(value)` |

Path tidak valid mengembalikan `""`, tidak melempar error. Konsekuensinya: salah ketik di `mappings.json` tidak merusak halaman, tapi juga tidak terlihat — makanya laporan diagnostik ([TDD §10](../TDD.md#10-logging--diagnostik)) mencatat field yang tidak terisi.

`"Yes"`/`"No"` dipilih karena mayoritas ATS berbahasa Inggris. Untuk dropdown `<select>`, pencocokan opsi memang berjenjang (value → teks persis → teks mengandung), jadi "Yes" tetap ketemu di opsi "Yes, I do".

## 5. Settings

```jsonc
{
  "overwriteFilled": false,   // true = field yang sudah ada isinya ikut ditimpa
  "autoDetect": true,         // set badge saat form terdeteksi
  "highlightColor": "#22c55e"
}
```

`overwriteFilled` default `false`: ATS sering pre-fill sebagian field (mis. email dari akun yang sedang login), dan menimpanya diam-diam adalah cara tercepat mengirim data salah.

## 6. Menambah Field Baru

1. Tambah ke `emptyProfile()` di `src/schema.js` dengan nilai default
2. Naikkan `SCHEMA_VERSION` **hanya kalau bentuknya berubah**, bukan kalau cuma menambah field — `fillDefaults()` sudah menambal key yang hilang di profil lama secara otomatis
3. Tambah input di `options.html`
4. Tambah entri di `data/keywords.json` supaya heuristik bisa menemukannya
5. Tambah selector per platform di `data/mappings.json` kalau relevan

Naikkan `SCHEMA_VERSION` + tulis fungsi migrasi kalau: field di-*rename*, tipe berubah, atau struktur bersarang berubah. Migrasi berjalan berurutan dan tidak bisa dilewat; kunci di `MIGRATIONS` adalah versi **asal**.

## 7. Ekspor / Impor

Options page menyediakan ekspor ke file `.json` dan impor kembali — isinya persis objek `satset` di atas. Ini yang menggantikan sync lintas device di MVP ([TDD §11](../TDD.md#11-keputusan-yang-menutup-prd-11)).

File ekspor berisi data pribadi lengkap **dan resume dalam base64, tanpa enkripsi**. UI ekspor wajib menyebut ini saat tombolnya ditekan.

Impor menjalankan `migrate()` yang sama, jadi file lama dari versi extension sebelumnya tetap bisa dibaca — dan file dari versi yang lebih baru ditolak, bukan dipaksa masuk.
