// Popup: scan halaman aktif, tampilkan preview, isi kalau user menekan tombol.
//
// Popup yang membaca profil, bukan content script - jadi data pribadi baru
// masuk halaman ATS pada detik user menekan "Isi", dan hanya path yang memang
// cocok di halaman itu (TDD.md bagian 5).

import { STORAGE_KEY, migrate, getPath } from './schema.js';

const body = document.getElementById('body');
document.getElementById('version').textContent =
  'v' + chrome.runtime.getManifest().version;

const MARK = { mapping: '✓', heuristic: '~', skip: '⊘' };

let state = null;
let tabId = null;
let hostname = '';

/* ---------- util ---------- */

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) node.append(child);
  return node;
}

const render = (nodes) => body.replaceChildren(...nodes);

function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

/** Content script tidak ada di halaman ini -> null, bukan lemparan error. */
async function send(message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

const isEmptyProfile = (p) =>
  !p.personal.firstName && !p.personal.fullName && !p.personal.email;

/** Nilai siap tampil untuk satu path. String kosong berarti belum ada di profil. */
function valueFor(path) {
  if (path.startsWith('documents.')) {
    const doc = state.profile.documents[path.split('.')[1]];
    return doc ? doc.name : '';
  }
  return getPath(state.profile, path);
}

/* ---------- tampilan ---------- */

function fieldRow(field, value) {
  const ready = Boolean(value);
  const mark = ready ? MARK[field.source] : MARK.skip;

  return el('div', { className: 'frow' }, [
    el('span', { className: 'mark ' + (ready ? field.source : 'skip'), textContent: mark }),
    el('span', { className: 'flabel', textContent: field.label || field.path }),
    el('span', {
      className: 'fvalue' + (ready ? '' : ' muted'),
      textContent: ready ? value : '(kosong di profil)',
    }),
  ]);
}

function renderScan(scan) {
  const rows = scan.fields.map((f) => ({ field: f, value: valueFor(f.path) }));
  const ready = rows.filter((r) => r.value);
  const empty = rows.filter((r) => !r.value);

  const header = el('div', { className: 'small muted' }, [
    el('div', { textContent: hostname }),
    el('div', {
      textContent: scan.platform
        ? `${scan.platform.label} · mapping tersedia`
        : 'Tanpa mapping khusus · hasil heuristik',
    }),
  ]);

  const summary = el('p', {
    className: 'small',
    textContent: `${ready.length} kolom siap diisi`
      + (empty.length ? `, ${empty.length} dilewati` : ''),
  });

  const list = el('div', { className: 'flist' },
    [...ready, ...empty].map((r) => fieldRow(r.field, r.value)));

  const fillBtn = el('button', {
    className: 'primary wide',
    textContent: `Isi ${ready.length} kolom`,
    disabled: ready.length === 0,
    onclick: () => doFill(ready.map((r) => r.field)),
  });

  render([header, summary, list, fillBtn, reportLink()]);
}

function renderResult(result) {
  const lines = [`${result.filled} kolom terisi`];
  if (result.skipped) lines.push(`${result.skipped} dilewati`);
  if (result.failed) lines.push(`${result.failed} gagal`);

  const nodes = [el('p', { className: 'notice small', textContent: lines.join(' · ') })];

  if (result.failed) {
    nodes.push(el('p', {
      className: 'notice warn small',
      textContent: 'Isi manual: ' + result.failedLabels.join(', '),
    }));
  }

  nodes.push(el('p', { className: 'small muted', textContent:
    'Periksa kolom bertanda ~ sebelum submit. Satset tidak menekan submit.' }));

  nodes.push(el('div', { className: 'row' }, [
    el('button', { textContent: 'Undo', onclick: doUndo }),
    el('button', { textContent: 'Scan lagi', onclick: start }),
  ]));

  render(nodes);
}

const reportLink = () => el('button', {
  className: 'linky small',
  textContent: 'Salin laporan kolom',
  onclick: copyReport,
});

function renderMessage(text, withOptions = true) {
  const nodes = [el('p', { className: 'small muted', textContent: text })];
  if (withOptions) {
    nodes.push(el('button', { textContent: 'Buka pengaturan', onclick: openOptions }));
  }
  render(nodes);
}

/* ---------- aksi ---------- */

async function doFill(fields) {
  const values = {};
  for (const f of fields) {
    if (!f.path.startsWith('documents.')) values[f.path] = getPath(state.profile, f.path);
  }

  const result = await send({
    type: 'fill',
    payload: { values, documents: state.profile.documents },
  });

  if (result) renderResult(result);
  else renderMessage('Halaman berubah. Buka ulang popup untuk scan lagi.', false);
}

async function doUndo() {
  const res = await send({ type: 'undo' });
  renderMessage(
    res
      ? `${res.restored} kolom dikembalikan. Berkas yang sudah diunggah tidak ikut dibatalkan.`
      : 'Tidak ada yang bisa dikembalikan.',
    false
  );
}

async function copyReport() {
  const report = await send({ type: 'report' });
  if (!report) return;

  await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  render([el('p', { className: 'notice small', textContent:
    `Laporan ${report.unmatched.length} kolom disalin. Isinya label dan atribut kolom saja, `
    + 'tanpa nilai kolom dan tanpa isi profil.' })]);
}

/* ---------- start ---------- */

async function start() {
  const scan = await send({
    type: 'scan',
    options: { overwriteFilled: state.settings.overwriteFilled },
  });

  if (!scan) {
    renderMessage('Satset belum aktif di halaman ini. Sejauh ini baru mendukung Lever.');
    return;
  }
  if (scan.error) {
    renderMessage('Scan gagal: ' + scan.error, false);
    return;
  }
  if (!scan.fields.length) {
    render([
      el('p', { className: 'small muted', textContent:
        'Tidak ada kolom yang cocok di halaman ini.' }),
      reportLink(),
    ]);
    return;
  }

  renderScan(scan);
}

try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;
  hostname = tab.url ? new URL(tab.url).hostname : '';

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  state = migrate(stored[STORAGE_KEY]);

  if (isEmptyProfile(state.profile)) {
    render([
      el('p', { className: 'small muted', textContent:
        'Profil masih kosong. Isi sekali, lalu bisa dipakai di semua form lamaran.' }),
      el('button', { className: 'primary', textContent: 'Isi profil', onclick: openOptions }),
    ]);
  } else {
    await start();
  }
} catch (err) {
  // Paling mungkin: data dari extension versi lebih baru. Jangan sentuh datanya.
  renderMessage(err.message);
}
