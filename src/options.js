// Editor profil. Binding generik: tiap input membawa data-path, tidak ada
// kode per field. Kartu berulang, dokumen, dan ekspor/impor menyusul.

import { STORAGE_KEY, migrate, parseImport, getPath, setPath } from './schema.js';

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

  switch (ev.target.id) {
    case 'exportBtn': return exportProfile();
    case 'importBtn': return document.getElementById('importInput').click();
    case 'resetBtn':  return void resetAll();
  }

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

/* ---------- ekspor / impor / reset ---------- */

function exportProfile() {
  const ok = confirm(
    'Berkas ekspor memuat data pribadi lengkap beserta isi resume, tanpa enkripsi.\n\n' +
    'Simpan seperti dokumen berisi KTP: jangan taruh di folder yang tersinkron publik.\n\n' +
    'Lanjutkan?'
  );
  if (!ok) return;

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `satset-export-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

async function onImport(el) {
  const file = el.files[0];
  if (!file) return;

  try {
    // Validasi bentuk + versi ada di parseImport (schema.js), lengkap dengan test.
    const next = parseImport(await file.text());
    state = next;                    // baru diganti setelah semua validasi lolos
    renderAll();
    await flush();
    setStatus('Profil diimpor');
  } catch (err) {
    setStatus('Impor gagal: ' + err.message, true);
  } finally {
    el.value = '';                   // supaya berkas yang sama bisa dipilih lagi
  }
}

async function resetAll() {
  const ok = confirm(
    'Hapus seluruh profil, dokumen, dan pengaturan dari browser ini?\n\n' +
    'Tidak bisa dibatalkan. Ekspor dulu kalau masih dibutuhkan.'
  );
  if (!ok) return;

  await chrome.storage.local.remove(STORAGE_KEY);
  location.reload();
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

/* ---------- izin deteksi di semua situs ---------- */

const ALL_SITES = { origins: ['<all_urls>'] };

/**
 * Status toggle dibaca dari Chrome, bukan dari profil. Menyimpannya sendiri
 * berarti ada dua sumber kebenaran yang bisa melenceng - user bisa mencabut
 * izin lewat chrome://extensions tanpa membuka halaman ini.
 */
async function syncAllSitesToggle() {
  const granted = await chrome.permissions.contains(ALL_SITES);
  document.getElementById('allSitesToggle').checked = granted;
}

async function onAllSitesToggle(el) {
  // request() dan remove() wajib dipanggil dari gestur user - centang checkbox
  // memenuhi syarat itu. Kalau dialognya ditolak, checkbox dikembalikan.
  const ok = el.checked
    ? await chrome.permissions.request(ALL_SITES)
    : await chrome.permissions.remove(ALL_SITES);

  if (!ok) el.checked = !el.checked;
  setStatus(el.checked ? 'Deteksi semua situs aktif' : 'Deteksi terbatas portal dikenal');
}

/* ---------- event ---------- */

function onFieldChange(ev) {
  const el = ev.target;
  if (!state) return;

  if (el.id === 'allSitesToggle') {
    onAllSitesToggle(el);
    return;
  }

  // Duluan: input file tidak boleh jatuh ke jalur readValue (nilainya cuma path palsu).
  if (el.id === 'importInput') {
    onImport(el);
    return;
  }
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

/* ---------- start ---------- */

function renderAll() {
  writeForm();
  for (const name of Object.keys(BLANK)) renderList(name);
  for (const kind of ['resume', 'coverLetter']) renderDoc(kind);
}

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
  renderAll();
  await syncAllSitesToggle();

  // change = sudah blur dan nilainya berubah. Persis auto-save saat blur.
  document.addEventListener('change', onFieldChange);
  document.addEventListener('click', onClick);
  setStatus(state.profile.updatedAt ? 'Tersimpan' : 'Belum ada data');
} catch (err) {
  // Data dari extension versi lebih baru. Read-only, jangan sampai tertimpa.
  setStatus('Tidak bisa dibuka', true);
  lockForm(err.message);
}
