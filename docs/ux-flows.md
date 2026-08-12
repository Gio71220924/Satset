# UX Flow & Wireframe

Sketsa low-fidelity, sengaja ASCII bukan Figma: di tahap ini yang perlu disepakati adalah *urutan langkah dan isi tiap layar*, bukan spasi dan warna. ASCII ikut ter-diff di git dan bisa diedit sambil menulis kode.

Tiga layar: **popup**, **options page**, **indikator di halaman**.

---

## 1. Alur Utama

```
     ┌──────────────────────────────────────────────────────┐
     │  SEKALI DI AWAL                                      │
     │                                                      │
     │  Install ──► Options page terbuka otomatis           │
     │              ──► isi profil ──► Simpan               │
     └──────────────────────────────────────────────────────┘
                              │
                              ▼
     ┌──────────────────────────────────────────────────────┐
     │  TIAP LAMARAN                                        │
     │                                                      │
     │  Buka halaman apply                                  │
     │        │                                             │
     │        ├── domain ada mapping ──► badge muncul       │
     │        │                          otomatis           │
     │        └── domain lain ──────────► tidak ada tanda   │
     │                                                      │
     │  Klik ikon ──► popup: daftar field yang cocok        │
     │        │                                             │
     │        ▼                                             │
     │  Klik "Isi 9 field" ──► field terisi + ter-highlight │
     │        │                                             │
     │        ├── ada yang salah? ──► Undo ATAU edit manual │
     │        │                                             │
     │        ▼                                             │
     │  Review halaman ──► SUBMIT (manual, oleh user)       │
     └──────────────────────────────────────────────────────┘
```

Satset **tidak pernah** menekan submit. Ini keputusan produk, bukan keterbatasan teknis.

## 2. Popup

Lebar tetap 360 px. Tiga state.

### 2a. Form terdeteksi (state normal)

```
┌────────────────────────────────────────┐
│  Satset                          ⚙     │
├────────────────────────────────────────┤
│  jobs.lever.co                         │
│  Lever · mapping tersedia              │
│                                        │
│  9 field cocok, 2 dilewati             │
│                                        │
│  ✓ Full Name        Ana Wijaya         │
│  ✓ Email            ana@contoh.id      │
│  ✓ Phone            +6281234567890     │
│  ✓ Current company  PT Contoh          │
│  ✓ LinkedIn         linkedin.com/in/…  │
│  ✓ Resume           CV_Ana.pdf         │
│  ~ Location         Bandung            │
│                                  ⌄ 2   │
│  ────────────────────────────────────  │
│  ⊘ Cover letter     (kosong di profil) │
│  ⊘ How did you hear about us?          │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │        Isi 9 field               │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Salin laporan field                   │
└────────────────────────────────────────┘
```

| Tanda | Arti |
|---|---|
| `✓` | Cocok lewat mapping platform — keyakinan tinggi |
| `~` | Cocok lewat heuristik — periksa lagi setelah terisi |
| `⊘` | Dilewati. Alasannya ditulis, tidak dibiarkan hilang begitu saja |

Preview nilai ditampilkan **sebelum** mengisi. Ini inti dari "review sebelum submit" di PRD: lebih cepat menyadari email salah di daftar 7 baris daripada menyusurinya lagi di form.

`⊘` sengaja tetap terlihat. Kalau field yang dilewati tidak ditampilkan, user tidak punya cara tahu ada yang perlu diisi manual.

### 2b. Setelah mengisi

```
┌────────────────────────────────────────┐
│  Satset                          ⚙     │
├────────────────────────────────────────┤
│  ✓ 9 field terisi                      │
│                                        │
│  Periksa yang bertanda ~ sebelum       │
│  submit. Satset tidak menekan submit.  │
│                                        │
│  ┌────────────┐  ┌──────────────────┐  │
│  │   Undo     │  │   Isi lagi       │  │
│  └────────────┘  └──────────────────┘  │
└────────────────────────────────────────┘
```

"Isi lagi" untuk form multi-step: user maju ke langkah berikutnya, buka popup, scan ulang.

### 2c. Tidak ada form / profil kosong

```
┌────────────────────────────────────────┐
│  Satset                          ⚙     │
├────────────────────────────────────────┤
│  Tidak ada field yang cocok di         │
│  halaman ini.                          │
│                                        │
│  Kalau ini memang halaman lamaran,     │
│  kirim laporan field supaya            │
│  dukungannya bisa ditambah.            │
│                                        │
│  Salin laporan field                   │
└────────────────────────────────────────┘
```

Profil masih kosong → tombol utama berubah jadi **"Isi profil dulu"** yang membuka options page. Tidak ada scan, tidak ada pesan error.

## 3. Options Page — Editor Profil

Satu halaman, navigasi section di kiri. Bukan wizard bertahap: user mengisi ini sekali dan sesekali menyunting satu field — wizard justru memaksa melewati semua langkah tiap kali.

```
┌──────────────────────────────────────────────────────────────┐
│  Satset — Profil                     Tersimpan 2 menit lalu  │
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│ ▸ Data Diri   │   Data Diri                                  │
│   Tautan      │                                              │
│   Pengalaman  │   Nama depan      [ Ana                    ] │
│   Pendidikan  │   Nama belakang   [ Wijaya                 ] │
│   Skill       │   Nama lengkap    [ Ana Wijaya             ] │
│   Dokumen     │                   ⓘ Sebagian form minta     │
│   Preferensi  │                     satu field nama          │
│               │                                              │
│ ────────────  │   Email           [ ana@contoh.id          ] │
│   Pengaturan  │   No. HP          [ +6281234567890         ] │
│   Ekspor      │                   ⓘ Awali +62               │
│   Impor       │                                              │
│               │   Tanggal lahir   [ 1999-04-17          📅 ] │
│               │   Alamat          [ Jl. Contoh No. 1       ] │
│               │   Kota            [ Bandung                ] │
│               │   Provinsi        [ Jawa Barat             ] │
│               │   Kode pos        [ 40111                  ] │
│               │   Negara          [ Indonesia              ] │
│               │   Kewarganegaraan [ Indonesian             ] │
│               │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

**Auto-save saat blur.** Tidak ada tombol Simpan. Alasan: satu-satunya kegagalan yang mungkin adalah kuota storage penuh, dan itu bisa ditampilkan langsung. Tombol Simpan hanya menambah satu cara kehilangan data (tutup tab tanpa menekannya).

Section berulang (Pengalaman, Pendidikan) berbentuk kartu:

```
│   Pengalaman Kerja                          [ + Tambah ]     │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  PT Contoh — Data Analyst              ⌃  ✕        │    │
│   │  Ags 2023 – sekarang · Bandung                     │    │
│   ├────────────────────────────────────────────────────┤    │
│   │  Perusahaan  [ PT Contoh                        ]  │    │
│   │  Posisi      [ Data Analyst                     ]  │    │
│   │  Lokasi      [ Bandung                          ]  │    │
│   │  Mulai       [ 2023-08 ]   Selesai [         ]     │    │
│   │                            ☑ Masih bekerja di sini │    │
│   │  Deskripsi   [                                  ]  │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   ⓘ Yang paling atas dipakai untuk field "Current company"   │
```

Urutan kartu penting: `work.0` = yang teratas = yang dipakai mengisi "current company". Catatan itu ditulis di UI, bukan cuma di dokumen — kalau user tidak tahu, dia akan bingung kenapa perusahaan lama yang terisi.

Checkbox "Masih bekerja di sini" mengunci field Selesai dan menyimpan `endDate: null` + `current: true` ([skema §3](profile-schema.md#3-konvensi-tipe)).

**Dokumen:**

```
│   Resume / CV                                                │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  📄  CV_Ana.pdf                                     │    │
│   │      500 KB · diunggah 11 Agu 2026        Ganti  ✕ │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   ⓘ Disimpan di browser ini saja. Maks 2 MB.                │
```

**Ekspor** menampilkan konfirmasi sebelum mengunduh: file berisi data pribadi lengkap dan resume, tanpa enkripsi. Bukan dialog yang bisa dilewati — file itu keluar dari browser dan masuk ke folder Downloads.

## 4. Indikator di Halaman

**Tidak ada overlay, banner, atau tombol melayang.**

Satu-satunya perubahan visual di halaman: field yang terisi mendapat outline 2 px dan `title="Diisi Satset"`.

```
    Email *
    ┌────────────────────────────────────┐
    │ ana@contoh.id                      │   ← outline hijau
    └────────────────────────────────────┘

    Location
    ┌────────────────────────────────────┐
    │ Bandung                            │   ← outline kuning (heuristik)
    └────────────────────────────────────┘

    How did you hear about us? *
    ┌────────────────────────────────────┐
    │                                    │   ← tanpa outline, tidak diisi
    └────────────────────────────────────┘
```

Hijau = dari mapping. Kuning = dari heuristik, artinya "periksa yang ini". Outline hilang saat user meninggalkan field tersebut (`blur` pertama), jadi halaman kembali bersih setelah selesai review.

Alasan tidak ada overlay: elemen injeksi harus berkelahi dengan z-index, sticky header, dan CSS tiap situs, lalu perlu Shadow DOM supaya style-nya tidak bocor — banyak kode untuk informasi yang sudah muat di popup. Sinyal "ada form terdeteksi" cukup lewat badge di ikon toolbar:

```
     ┌─────┐
     │ 🅢 ⁹│   ← badge angka = jumlah field yang cocok
     └─────┘
```

Kalau ternyata badge terlalu mudah terlewat saat dipakai sungguhan, barulah pertimbangkan toast kecil. Jangan dibangun sebelum ada buktinya.

## 5. Penanganan Error

| Situasi | Yang dilihat user |
|---|---|
| Profil kosong | Popup: "Isi profil dulu" + tombol ke options page |
| Tidak ada field cocok | Popup 2c + ajakan kirim laporan field |
| Sebagian field gagal diisi | "7 dari 9 terisi" + daftar yang gagal beserta alasannya |
| Upload resume gagal | "Resume perlu diunggah manual" — pesan, bukan retry diam-diam |
| File resume >2 MB | Ditolak saat memilih file, sebelum diproses |
| Storage penuh | Banner di options page: "Perubahan tidak tersimpan" + saran menghapus dokumen |
| Data profil dari versi lebih baru | Options page read-only + pesan update extension. **Data tidak ditimpa** ([skema §6](profile-schema.md#6-menambah-field-baru)) |

Aturan yang berlaku di semua baris: kegagalan ditampilkan, tidak ditelan. Autofill yang diam-diam melewatkan satu field lebih berbahaya daripada autofill yang bilang gagal, karena user sudah terlanjur percaya form-nya lengkap.

## 6. Yang Sengaja Tidak Ada di MVP

| Tidak ada | Alasan |
|---|---|
| Onboarding bertahap | Options page sudah tersusun per section. Wizard hanya menunda saat user bisa mulai mengisi |
| Pemilih profil di popup | Multi-profil baru ada di Fase 2 — sampai itu ada, dropdown berisi satu item |
| Riwayat lamaran | Fitur terpisah (Fase 2), bukan bagian dari alur mengisi form |
| Dark mode | `prefers-color-scheme` + dua variabel CSS. Ditambahkan kalau sempat, bukan syarat rilis |
| Tombol melayang di halaman | Lihat §4 |
