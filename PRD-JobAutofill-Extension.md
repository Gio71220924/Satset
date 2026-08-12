# PRD: JobAutofill — Chrome Extension untuk Auto-Isi Form Lamaran Kerja

**Versi:** 0.1 (Draft)
**Status:** Konsep awal
**Owner:** Gi

---

## 1. Latar Belakang & Masalah

Proses melamar kerja secara online melibatkan pengisian form berulang-ulang di berbagai platform (LinkedIn Easy Apply, Greenhouse, Lever, Workday, Kalibrr, JobStreet, career page perusahaan langsung). Data yang diisi sebagian besar sama di setiap form: nama, email, nomor HP, riwayat pendidikan, riwayat kerja, link portofolio, dll.

Pencari kerja aktif bisa melamar puluhan hingga ratusan posisi dalam satu periode pencarian kerja. Mengisi ulang data yang sama berkali-kali memakan waktu dan menurunkan motivasi untuk apply secara konsisten.

## 2. Tujuan Produk

- Mengurangi waktu pengisian form lamaran kerja dari beberapa menit menjadi beberapa detik per aplikasi
- Menyimpan satu sumber data profil yang bisa dipakai ulang di berbagai platform ATS (Applicant Tracking System)
- Meningkatkan jumlah aplikasi yang bisa dikirim per hari tanpa menambah beban manual

### Non-Goals (di luar cakupan MVP)

- Tidak mengotomatisasi keputusan melamar (user tetap yang klik submit)
- Tidak melakukan scraping massal lowongan kerja
- Tidak menjamin 100% kompatibilitas dengan semua ATS di rilis awal

## 3. Target Pengguna

Pencari kerja aktif yang melamar ke banyak posisi dalam waktu singkat, khususnya fresh graduate atau early-career profesional yang sedang dalam fase apply intensif ke banyak perusahaan.

## 4. User Stories

1. Sebagai pengguna, saya ingin mengisi profil saya sekali saja, supaya bisa dipakai ulang di form manapun.
2. Sebagai pengguna, saya ingin upload CV dan datanya otomatis ter-parse ke profil, supaya tidak perlu input manual dari nol.
3. Sebagai pengguna, saya ingin extension mendeteksi form lamaran di halaman aktif dan menawarkan untuk auto-isi.
4. Sebagai pengguna, saya ingin bisa review dan edit hasil auto-isi sebelum submit, supaya tidak ada data yang salah terkirim.
5. Sebagai pengguna, saya ingin punya beberapa versi profil (misal CV berbeda untuk role berbeda), supaya bisa pilih versi yang relevan per lamaran.
6. Sebagai pengguna, saya ingin melihat riwayat lamaran yang sudah di-autofill, supaya bisa tracking sudah apply ke mana saja.

## 5. Fitur MVP (Fase 1)

| Fitur | Deskripsi | Prioritas |
|---|---|---|
| Profil data terpusat | Form input untuk data pribadi, pendidikan, pengalaman kerja, skill, link (portofolio/LinkedIn/GitHub) | Must-have |
| Deteksi field otomatis | Content script membaca elemen form di halaman aktif dan mencocokkan dengan data profil | Must-have |
| Auto-fill dengan konfirmasi | Isi field yang cocok, tampilkan indikator field mana yang terisi otomatis, user review sebelum submit | Must-have |
| Import dari CV | Upload PDF/DOCX, extract data ke profil (nama, email, riwayat kerja, pendidikan) | Should-have |
| Dukungan multi-platform dasar | Mapping khusus untuk 3-4 ATS populer (LinkedIn Easy Apply, Greenhouse, Lever) sebagai baseline akurasi tinggi | Should-have |
| Fallback heuristik | Untuk platform yang belum ada mapping khusus, gunakan pencocokan berbasis label/placeholder/name attribute | Could-have |

## 6. Fitur Potensial (Fase 2+)

- Cover letter generator otomatis berbasis job description halaman aktif
- Application tracker (log tanggal apply, posisi, status, catatan)
- Multi-profil (versi CV berbeda per jenis role: ML Engineer, Data Analyst, dst)
- Dukungan platform lokal Indonesia (Kalibrr, JobStreet, Glints) sebagai diferensiasi dari kompetitor luar

## 7. Arsitektur Teknis (Ringkas)

**Platform:** Chrome Extension, Manifest V3

**Komponen utama:**
- **Content script** — berjalan di halaman target, membaca DOM form, melakukan pencocokan field, dan mengisi value
- **Background service worker** — mengelola state, komunikasi antar komponen, dan penyimpanan
- **Popup / options page** — UI untuk mengisi dan mengelola profil data
- **Storage** — `chrome.storage.local` untuk data profil (opsi sync ke akun jika mau lintas device)

**Strategi pencocokan field:**
1. Cek dulu apakah domain halaman termasuk daftar ATS yang sudah punya mapping manual (selector spesifik per platform) — akurasi tertinggi
2. Kalau tidak ada mapping, fallback ke heuristik: cocokkan label, `name`, `id`, `placeholder`, dan `aria-label` elemen terhadap kamus kata kunci (misal "first name", "nama depan" → field nama depan di profil)
3. (Opsional, fase lanjut) Kalau heuristik gagal atau confidence rendah, kirim struktur field ke API klasifikasi (misal LLM) untuk menebak maksud field tersebut — trade-off: butuh biaya API dan koneksi internet

**Parsing CV:** gunakan library parsing PDF/DOCX di sisi client atau via backend ringan kalau butuh akurasi lebih tinggi (regex saja biasanya kurang reliable untuk resume yang formatnya bervariasi)

## 8. Alur Penggunaan (User Flow)

1. Install extension, isi profil awal (manual atau import CV)
2. Buka halaman lowongan kerja dan mulai proses apply
3. Extension mendeteksi form, muncul ikon/notifikasi "Auto-fill tersedia"
4. User klik, field ter-isi otomatis dengan highlight visual pada field yang terisi
5. User review, edit field yang perlu disesuaikan (misal cover letter atau pertanyaan spesifik posisi)
6. User submit manual seperti biasa

## 9. Metrik Keberhasilan

- Rata-rata waktu pengisian form turun signifikan dibanding pengisian manual (target: di bawah 30 detik untuk platform yang sudah ada mapping)
- Tingkat akurasi field yang terisi benar tanpa perlu koreksi (target awal: di atas 80% untuk platform prioritas)
- Jumlah aplikasi yang berhasil di-submit per sesi penggunaan

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Struktur ATS berubah sewaktu-waktu, mapping jadi tidak valid | Bangun fallback heuristik supaya tidak total gagal, monitoring berkala pada platform prioritas |
| Data pribadi sensitif tersimpan di storage lokal | Enkripsi data di storage, tidak kirim data ke server kecuali fitur yang memang butuh (parsing CV via API) |
| Auto-fill mengisi data salah tanpa disadari user | Selalu ada tahap review sebelum submit, highlight visual pada field yang diisi otomatis |
| Beberapa ATS mendeteksi dan memblokir input yang di-generate script (bukan interaksi asli manusia) | Gunakan event dispatch yang menyerupai input asli (trigger `input`/`change` event dengan benar), uji di tiap platform prioritas |

## 11. Pertanyaan Terbuka

- Apakah perlu sinkronisasi profil lintas device (butuh backend) atau cukup local storage saja di MVP?
- Berapa banyak platform ATS yang realistis dicover di rilis pertama dengan effort solo builder?
- Apakah fitur cover letter generator masuk MVP atau memang didorong ke fase 2?
