// Lapisan DOM. Tidak tahu apa-apa soal profil atau mapping - hanya cara
// membaca dan menulis elemen form di halaman orang lain.
//
// Content script MV3 tidak mendukung `import`. Berkas di content_scripts[].js
// dimuat berurutan dan berbagi scope global, jadi dipakai `function` (bukan
// const arrow) supaya terlihat dari match.js dan fill.js.

const SKIP_TYPES = new Set([
  'password', 'hidden', 'submit', 'button', 'image', 'reset', 'checkbox', 'radio',
]);

function isVisible(el) {
  const rect = el.getBoundingClientRect();

  // Kolom perangkap bot (honeypot). Diverifikasi di form Workday asli:
  //   name="website"  label="Enter website. This input is for robots only"
  //   rect 1x0 px, clip-path: polygon(0 0, 0 0, 0 0, 0 0)
  // checkVisibility() mengembalikan TRUE untuk kolom itu dan offsetParent-nya
  // tidak null, jadi dua pemeriksaan di bawah tidak cukup sendirian. Mengisinya
  // menandai lamaran sebagai robot - kegagalan yang tidak terlihat sama sekali.
  if (rect.width < 2 || rect.height < 2) return false;
  if (rect.right < 0 || rect.bottom < 0) return false;   // digeser ke luar layar

  // checkVisibility() menangani content-visibility dan visibility:hidden;
  // offsetParent untuk Chrome lama dan elemen di dalam wadah position:fixed.
  return typeof el.checkVisibility === 'function'
    ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : el.offsetParent !== null;
}

/**
 * Kolom yang boleh disentuh sama sekali. Checkbox dan radio sengaja ditolak
 * di sini: mencentang persetujuan atas nama user adalah kegagalan termahal
 * di seluruh proyek (docs/test-plan.md T5.5).
 */
function isFillable(el) {
  if (el.disabled || el.readOnly) return false;
  if (el.tagName === 'INPUT' && SKIP_TYPES.has(el.type)) return false;
  return isVisible(el);
}

/** Sudah ada isinya? File input dianggap terisi kalau sudah ada berkasnya. */
function hasValue(el) {
  return el.type === 'file' ? el.files.length > 0 : el.value.trim() !== '';
}

/** Teks label kolom. Urutan dari yang paling bisa dipercaya. */
function labelFor(el) {
  if (el.labels?.length) return el.labels[0].textContent;

  const wrapping = el.closest('label');
  if (wrapping) return wrapping.textContent;

  const ariaId = el.getAttribute('aria-labelledby');
  if (ariaId) {
    const target = document.getElementById(ariaId);
    if (target) return target.textContent;
  }

  // Terakhir: teks tepat sebelum kolom, mis. <div>Email</div><input>
  const prev = el.previousElementSibling;
  return prev && !prev.querySelector('input, select, textarea') ? prev.textContent : '';
}

const cleanText = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Petunjuk tentang satu kolom, tetap terpisah per sumber. Sengaja bukan satu
 * string gabungan: skoring memberi nilai berbeda untuk name/id, label, dan
 * placeholder, jadi asal-usulnya tidak boleh hilang.
 *
 * Bentuk ini yang diterima pickField() di score.js.
 */
function fieldInfoFor(el) {
  return {
    label: cleanText(labelFor(el)),
    name: el.name ?? '',
    id: el.id ?? '',
    placeholder: el.placeholder ?? '',
    ariaLabel: el.getAttribute('aria-label') ?? '',
  };
}

/** Nama kolom untuk ditampilkan di popup. Dipotong supaya baris tidak melar. */
function displayLabel(el) {
  const info = fieldInfoFor(el);
  const text = info.label || info.ariaLabel || info.placeholder || info.name || info.id;
  return cleanText(text).slice(0, 60);
}

/**
 * INTI SELURUH EXTENSION.
 *
 * `el.value = x` mengubah tampilan tapi TIDAK terbaca React/Vue: keduanya
 * melacak nilai lewat setter internal, jadi state mereka tetap kosong dan
 * kolom terkirim kosong walau di layar terlihat terisi. Greenhouse dan Lever
 * versi baru pakai React.
 *
 * Jalan keluarnya memanggil setter asli prototype lalu melepas event DOM
 * sungguhan yang bubbling - bukan simulasi keyboard, bukan execCommand.
 *
 * Diuji manual lewat T3.1 di docs/test-plan.md: isi, lalu submit tanpa
 * menyentuh kolom apa pun. Kalau ATS bilang kolom wajib masih kosong,
 * fungsi ini gagal dan semua kerjaan sesudahnya sia-sia.
 */
function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;

  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;   // ponytail: elemen tak lazim, tetap dicoba

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Dropdown. Cocokkan value persis, lalu teks persis, lalu teks yang mengandung.
 * Gagal ketiganya = tidak diisi. Menebak opsi dropdown adalah cara halus
 * mengirim jawaban yang salah.
 * @returns {boolean} berhasil atau tidak
 */
function selectOption(el, value) {
  const want = String(value).trim().toLowerCase();
  if (!want) return false;

  const options = [...el.options];
  const match =
    options.find((o) => o.value.toLowerCase() === want)
    || options.find((o) => o.text.trim().toLowerCase() === want)
    || options.find((o) => o.text.trim().toLowerCase().includes(want));

  if (!match) return false;

  el.value = match.value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function base64ToBlob(base64, mime) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Pasang berkas ke input[type=file] lewat DataTransfer. Bekerja walau content
 * script berjalan di isolated world, karena akses DOM-nya penuh.
 *
 * Sebagian ATS (Greenhouse) mengunggah lewat widget sendiri ke S3 dan mungkin
 * tidak bereaksi. Pemanggil wajib menangani `false` dengan pesan ke user,
 * bukan diam - lihat docs/test-plan.md T6.3.
 * @returns {boolean}
 */
function setFileValue(el, doc) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(new File([base64ToBlob(doc.data, doc.mime)], doc.name, {
      type: doc.mime,
    }));
    el.files = transfer.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.files.length > 0;
  } catch {
    return false;
  }
}
