# Kebijakan Privasi — Satset

**Berlaku sejak:** _(isi tanggal publikasi)_
**Versi extension:** _(isi versi rilis)_
**Kontak:** _(isi alamat email)_

> **Belum siap dipublikasikan.** Tiga isian di atas harus diisi, dan dokumen ini harus di-host di URL publik yang stabil sebelum submit ke Chrome Web Store. Lihat catatan di bagian paling bawah.

---

## Ringkasan

Satset menyimpan data profil lamaran kerja Anda **di browser Anda sendiri**. Tidak ada server milik Satset. Tidak ada akun. Tidak ada data yang dikirim ke pengembang atau pihak ketiga mana pun.

Satu hal yang perlu Anda tahu sejak awal: **data disimpan tanpa enkripsi tambahan.** Penjelasannya di §4.

## 1. Data yang Disimpan

Semua bersifat opsional — Satset hanya menyimpan apa yang Anda ketik atau unggah sendiri.

| Kategori | Isi |
|---|---|
| Data diri | Nama, email, nomor telepon, tanggal lahir, alamat, kota, provinsi, kode pos, negara, kewarganegaraan |
| Tautan | LinkedIn, GitHub, portofolio, website pribadi |
| Riwayat kerja | Nama perusahaan, jabatan, lokasi, periode, deskripsi |
| Riwayat pendidikan | Institusi, jenjang, jurusan, periode, IPK |
| Skill & bahasa | Daftar keahlian dan kemampuan bahasa |
| Dokumen | Berkas CV/resume dan surat lamaran yang Anda unggah |
| Preferensi | Ekspektasi gaji, notice period, izin kerja, kesediaan relokasi |
| Pengaturan | Preferensi tampilan dan perilaku pengisian |

**Tempat penyimpanan:** `chrome.storage.local` — area penyimpanan milik extension di browser Anda, di perangkat Anda.

**Yang tidak disimpan:** riwayat browsing, isi halaman yang Anda buka, daftar lowongan yang Anda lihat, statistik penggunaan, pengenal perangkat, dan alamat IP.

## 2. Cara Data Digunakan

Hanya satu: mengisi kolom form lamaran kerja di halaman yang sedang Anda buka, saat Anda menekan tombol isi di popup Satset.

Data Anda tidak dijual, tidak dibagikan, tidak dianalisis, dan tidak dipakai untuk iklan atau pelatihan model AI.

## 3. Data Tidak Meninggalkan Perangkat Anda

Satset tidak punya server. Tidak ada endpoint yang dihubungi, tidak ada telemetri, tidak ada analytics, tidak ada crash reporting.

Data Anda hanya keluar dari perangkat lewat tindakan yang Anda lakukan sendiri:

1. **Mengisi form.** Data profil masuk ke kolom form situs lamaran. Data itu terkirim ke perusahaan atau penyedia ATS **hanya setelah Anda sendiri menekan tombol submit di situs tersebut.** Satset tidak pernah menekan submit
2. **Ekspor profil.** Menghasilkan file `.json` di folder unduhan Anda. Lihat peringatan di §4

Ke mana data pergi setelah Anda submit lamaran diatur oleh kebijakan privasi perusahaan dan penyedia ATS tersebut, bukan oleh kebijakan ini.

## 4. Keamanan — Baca Bagian Ini

**Data disimpan dalam bentuk apa adanya, tanpa enkripsi tambahan dari Satset.**

Dasar perlindungannya adalah mekanisme browser: penyimpanan extension terisolasi dari situs web, dari extension lain, dan mengikuti perlindungan profil pengguna sistem operasi Anda.

Kami tidak menambahkan lapisan enkripsi sendiri karena kuncinya harus ikut tersimpan di tempat yang bisa dibaca extension — artinya kunci berada di sebelah datanya. Itu terlihat aman tanpa benar-benar menambah keamanan, dan kami memilih menyatakannya terus terang daripada memberi rasa aman yang keliru.

**Konsekuensi praktisnya:**

- Siapa pun yang punya akses ke akun pengguna komputer Anda berpotensi membaca data profil ini
- Program berbahaya yang berjalan dengan hak akses Anda berpotensi membacanya juga
- **File hasil ekspor tidak terenkripsi.** File itu berisi data pribadi lengkap beserta isi resume Anda. Perlakukan seperti dokumen berisi KTP: jangan taruh di folder yang tersinkron publik, jangan kirim lewat kanal yang tidak Anda percayai

Kalau Anda memakai komputer bersama atau perangkat kerja yang dikelola pihak lain, pertimbangkan hal ini sebelum menyimpan data sensitif di Satset.

## 5. Izin yang Diminta

| Izin | Untuk apa |
|---|---|
| `storage` | Menyimpan profil Anda di browser |
| `activeTab` | Membaca form **hanya di tab yang sedang aktif, dan hanya saat Anda mengklik ikon Satset** |
| `scripting` | Menjalankan kode pendeteksi form di tab tersebut setelah Anda mengklik |
| Akses ke `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co` | Mendeteksi form otomatis di situs lamaran yang sudah didukung |

Satset **tidak** meminta izin ke seluruh situs. Di luar domain yang terdaftar di atas, tidak ada kode Satset yang berjalan sampai Anda mengklik ikonnya.

## 6. Pihak Ketiga

Tidak ada. Satset tidak memuat pustaka eksternal, font eksternal, analytics, iklan, maupun layanan cloud.

Kalau ini berubah di versi mendatang — misalnya fitur pembuat cover letter yang memanggil layanan AI — perubahannya akan dinyatakan di kebijakan ini sebelum fiturnya aktif, dan fitur semacam itu bersifat memilih ikut (*opt-in*), tidak menyala dengan sendirinya.

## 7. Berapa Lama Data Disimpan

Sampai Anda menghapusnya. Tidak ada masa kedaluwarsa dan tidak ada pengiriman ke mana pun.

Cara menghapus:

- **Sebagian:** kosongkan field atau hapus dokumen di halaman pengaturan Satset
- **Seluruhnya:** hapus (uninstall) extension. Chrome menghapus seluruh penyimpanannya
- **Seluruhnya tanpa uninstall:** tombol "Hapus semua data" di halaman pengaturan

File hasil ekspor yang sudah terlanjur Anda simpan tidak ikut terhapus — file itu berada di luar kendali Satset.

## 8. Hak Anda

Karena data hanya ada di perangkat Anda dan pengembang tidak memilikinya:

- **Akses & koreksi:** buka halaman pengaturan kapan saja
- **Portabilitas:** ekspor ke file `.json`
- **Penghapusan:** lihat §7

Tidak ada permintaan yang perlu diajukan ke siapa pun — kami tidak menyimpan salinan apa pun untuk bisa dikirim atau dihapus.

## 9. Anak-anak

Satset ditujukan untuk pencari kerja dan tidak diperuntukkan bagi anak di bawah 13 tahun.

## 10. Perubahan Kebijakan

Perubahan akan diterbitkan di URL ini beserta tanggal berlakunya. Perubahan yang menyangkut cara data ditangani — misalnya penambahan layanan pihak ketiga — akan disampaikan lewat catatan rilis extension, bukan diam-diam lewat pembaruan dokumen.

---

## Catatan Sebelum Publikasi

Bagian ini **dihapus** dari versi yang dipublikasikan. Isinya daftar kerja, bukan bagian dari kebijakan.

- [ ] Isi tanggal berlaku, versi extension, dan alamat email kontak
- [ ] Host di URL publik yang stabil (GitHub Pages sudah cukup), cantumkan URL-nya di listing Chrome Web Store
- [ ] **Sediakan versi bahasa Inggris.** Reviewer Chrome Web Store membaca dalam bahasa Inggris; kebijakan yang hanya berbahasa Indonesia memperbesar peluang tertahan di review
- [ ] Isi form *Data Safety* di Developer Dashboard supaya **konsisten** dengan dokumen ini. Deklarasi: mengumpulkan PII + dokumen, tidak dikirim ke mana pun, tidak dijual, tidak dipakai untuk tujuan selain fungsi utama. Ketidakcocokan antara form dan dokumen ini adalah penyebab penolakan yang umum
- [ ] Tulis justifikasi tiap izin di kolom yang disediakan Dashboard — samakan kalimatnya dengan §5
- [ ] Sinkronkan ulang dokumen ini setiap kali izin, domain yang didukung, atau keputusan enkripsi berubah. §4 dan §5 adalah yang paling mudah menjadi usang
