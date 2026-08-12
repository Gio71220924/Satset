// Editor profil. Binding generik: tiap input membawa data-path, tidak ada
// kode per field. Kartu berulang, dokumen, dan ekspor/impor menyusul.

import { STORAGE_KEY, migrate, getPath, setPath } from './schema.js';

const saveState = document.getElementById('saveState');

let state = null;       // { schemaVersion, profile, settings }
let saveTimer = null;

/* ---------- baca/tulis satu elemen ---------- */

function readValue(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.type === 'csv') {
    return el.value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return el.value;
}

function writeValue(el, value) {
  if (el.type === 'checkbox') el.checked = Boolean(value);
  else el.value = value;
}

/* ---------- form <-> state ---------- */

function writeForm() {
  for (const el of document.querySelectorAll('[data-path]')) {
    // getPath sudah mengurus null, array, dan boolean jadi teks.
    const raw = getPath(state.profile, el.dataset.path);
    writeValue(el, el.type === 'checkbox' ? raw === 'Yes' : raw);
  }
  for (const el of document.querySelectorAll('[data-setting]')) {
    writeValue(el, state.settings[el.dataset.setting]);
  }
}

/* ---------- simpan ---------- */

async function flush() {
  try {
    state.profile.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    setStatus('Tersimpan');
  } catch (err) {
    // Paling mungkin: kuota penuh. Jangan diam - user harus tahu isiannya hilang.
    setStatus('Gagal menyimpan: ' + err.message, true);
  }
}

/** Auto-save, tanpa tombol Simpan. Debounce supaya mengetik cepat tidak menulis tiap huruf. */
function scheduleSave() {
  setStatus('Menyimpan…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

function setStatus(text, isError = false) {
  saveState.textContent = text;
  saveState.classList.toggle('warn-text', isError);
}

/* ---------- event ---------- */

function onFieldChange(ev) {
  const el = ev.target;
  if (!state) return;

  if (el.dataset.path) {
    setPath(state.profile, el.dataset.path, readValue(el));
    scheduleSave();
  } else if (el.dataset.setting) {
    state.settings[el.dataset.setting] = readValue(el);
    scheduleSave();
  }
}

/** Kontrol yang belum tersambung. Diaktifkan satu per satu di langkah berikutnya. */
function disableUnwired() {
  const selectors = [
    '[data-add]', '[data-clear-doc]', 'input[type="file"]',
    '#exportBtn', '#importBtn', '#resetBtn',
  ];
  for (const el of document.querySelectorAll(selectors.join(','))) {
    el.disabled = true;
    el.title = 'Belum tersedia di versi ini';
  }
}

/* ---------- start ---------- */

function lockForm(message) {
  for (const el of document.querySelectorAll('input, select, textarea, button')) {
    el.disabled = true;
  }
  const banner = document.createElement('p');
  banner.className = 'notice warn small';
  banner.textContent = message;
  document.querySelector('main').prepend(banner);
}

try {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  state = migrate(stored[STORAGE_KEY]);
  writeForm();
  disableUnwired();

  // change = sudah blur dan nilainya berubah. Persis auto-save saat blur.
  document.addEventListener('change', onFieldChange);
  setStatus(state.profile.updatedAt ? 'Tersimpan' : 'Belum ada data');
} catch (err) {
  // Data dari extension versi lebih baru. Read-only, jangan sampai tertimpa.
  setStatus('Tidak bisa dibuka', true);
  lockForm(err.message);
}
