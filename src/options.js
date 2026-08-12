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

/* ---------- kartu berulang ----------
   DOM yang jadi sumber kebenaran untuk list: tiap perubahan, seluruh list
   dibaca ulang dari kartu-kartunya. Hapus dan tambah tidak perlu menomori
   ulang indeks, dan tidak ada state bayangan yang bisa melenceng. */

const BLANK = {
  work: () => ({
    company: '', title: '', location: '',
    startDate: '', endDate: null, current: false, description: '',
  }),
  education: () => ({
    school: '', degree: '', fieldOfStudy: '', location: '',
    startDate: '', endDate: null, gpa: '',
  }),
  languages: () => ({ name: '', proficiency: 'professional' }),
};

const listNameOf = (card) => card.parentElement.id.replace(/List$/, '');

function buildCard(name, item) {
  const card = document.getElementById('tpl-' + name)
    .content.firstElementChild.cloneNode(true);

  for (const el of card.querySelectorAll('[data-field]')) {
    writeValue(el, item[el.dataset.field] ?? '');   // null jangan jadi teks "null"
  }

  const title = card.querySelector('[data-title]');
  if (title) title.dataset.blank = title.textContent;

  syncCard(card);
  return card;
}

function renderList(name) {
  const items = state.profile[name];
  document.getElementById(name + 'List')
    .replaceChildren(...items.map((item) => buildCard(name, item)));
  document.getElementById(name + 'Empty').hidden = items.length > 0;
}

function readList(name) {
  const cards = document.getElementById(name + 'List').querySelectorAll('[data-item]');
  return [...cards].map((card) => {
    const item = {};
    for (const el of card.querySelectorAll('[data-field]')) {
      item[el.dataset.field] = readValue(el);
    }
    // Masih berjalan disimpan sebagai null, bukan string kosong.
    if ('endDate' in item) item.endDate = item.current ? null : (item.endDate || null);
    return item;
  });
}

/** Judul kartu dan kunci tanggal selesai. Dipanggil tanpa render ulang supaya fokus tidak lompat. */
function syncCard(card) {
  const current = card.querySelector('[data-field="current"]');
  const endDate = card.querySelector('[data-field="endDate"]');
  if (current && endDate) {
    endDate.disabled = current.checked;
    if (current.checked) endDate.value = '';
  }

  const title = card.querySelector('[data-title]');
  if (!title) return;
  const filled = [...card.querySelectorAll('[data-field]')]
    .filter((el) => el.type !== 'checkbox' && el.value.trim())
    // dropdown pakai teks opsinya, bukan value mentah ("Professional", bukan "professional")
    .map((el) => (el.tagName === 'SELECT' ? el.selectedOptions[0].text : el.value.trim()));
  title.textContent = filled.slice(0, 2).join(' — ') || title.dataset.blank;
}

function onClick(ev) {
  if (!state) return;

  const add = ev.target.closest('[data-add]');
  if (add) {
    const name = add.dataset.add;
    state.profile[name].push(BLANK[name]());
    renderList(name);
    scheduleSave();
    return;
  }

  const remove = ev.target.closest('[data-remove]');
  if (remove) {
    const card = remove.closest('[data-item]');
    const name = listNameOf(card);
    card.remove();
    state.profile[name] = readList(name);
    document.getElementById(name + 'Empty').hidden = state.profile[name].length > 0;
    scheduleSave();
    return;
  }

  const clear = ev.target.closest('[data-clear-doc]');
  if (clear) {
    const kind = clear.dataset.clearDoc;
    state.profile.documents[kind] = null;
    document.getElementById(kind + 'Input').value = '';
    renderDoc(kind);
    scheduleSave();
  }
}

/* ---------- dokumen ---------- */

const MAX_DOC_BYTES = 2 * 1024 * 1024;

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? Math.round(bytes / 1024) + ' KB'
    : (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function setDocMeta(kind, text, isError = false) {
  const meta = document.getElementById(kind + 'Meta');
  meta.textContent = text;
  meta.classList.toggle('warn-text', isError);
}

function renderDoc(kind) {
  const doc = state.profile.documents[kind];
  setDocMeta(kind, doc ? `${doc.name} · ${formatSize(doc.size)}` : 'Belum ada');
}

/** base64 lewat FileReader, bukan btoa manual - btoa meledak di berkas besar. */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Berkas tidak bisa dibaca'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

async function onDocChange(el) {
  const kind = el.dataset.doc;
  const file = el.files[0];
  if (!file) return;                       // user membatalkan dialog

  if (file.size > MAX_DOC_BYTES) {
    el.value = '';                         // dokumen lama sengaja dipertahankan
    setDocMeta(kind, `Ditolak: ${formatSize(file.size)}, maksimal 2 MB`, true);
    return;
  }

  try {
    state.profile.documents[kind] = {
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      data: await fileToBase64(file),
    };
    renderDoc(kind);
    scheduleSave();
  } catch (err) {
    setDocMeta(kind, err.message, true);
  }
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

  // Duluan: input file tidak boleh jatuh ke jalur readValue (nilainya cuma path palsu).
  if (el.dataset.doc) {
    onDocChange(el);
    return;
  }

  const card = el.closest('[data-item]');
  if (card) {
    const name = listNameOf(card);
    syncCard(card);
    state.profile[name] = readList(name);
    scheduleSave();
  } else if (el.dataset.path) {
    setPath(state.profile, el.dataset.path, readValue(el));
    scheduleSave();
  } else if (el.dataset.setting) {
    state.settings[el.dataset.setting] = readValue(el);
    scheduleSave();
  }
}

/** Kontrol yang belum tersambung. Diaktifkan satu per satu di langkah berikutnya. */
function disableUnwired() {
  const selectors = ['#exportBtn', '#importBtn', '#importInput', '#resetBtn'];
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
  for (const name of Object.keys(BLANK)) renderList(name);
  for (const kind of ['resume', 'coverLetter']) renderDoc(kind);
  disableUnwired();

  // change = sudah blur dan nilainya berubah. Persis auto-save saat blur.
  document.addEventListener('change', onFieldChange);
  document.addEventListener('click', onClick);
  setStatus(state.profile.updatedAt ? 'Tersimpan' : 'Belum ada data');
} catch (err) {
  // Data dari extension versi lebih baru. Read-only, jangan sampai tertimpa.
  setStatus('Tidak bisa dibuka', true);
  lockForm(err.message);
}
