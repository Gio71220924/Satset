// Popup: scan halaman aktif, tampilkan preview, isi kalau user menekan tombol.
//
// Popup yang membaca profil, bukan content script - jadi data pribadi baru
// masuk halaman ATS pada detik user menekan "Isi", dan hanya path yang memang
// cocok di halaman itu (TDD.md bagian 5).

import { STORAGE_KEY, migrate, getPath } from './schema.js';
import { appendLog } from './log.js';

const body = document.getElementById('body');
document.getElementById('version').textContent =
  'v' + chrome.runtime.getManifest().version;

const MARK = { mapping: '✓', heuristic: '~', skip: '⊘' };

let state = null;
let tabId = null;
let hostname = '';
let pageTitle = '';
let platformLabel = '';

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
  const documents = {};

  for (const f of fields) {
    if (f.path.startsWith('documents.')) {
      // Hanya jenis yang benar-benar cocok di halaman ini. Mengirim keduanya
      // tiap kali berarti melempar resume base64 (bisa 2 MB) ke halaman ATS
      // walau tidak ada satu pun kolom unggah di sana.
      const kind = f.path.split('.')[1];
      documents[kind] = state.profile.documents[kind];
    } else {
      values[f.path] = getPath(state.profile, f.path);
    }
  }

  const result = await send({ type: 'fill', payload: { values, documents } });

  if (!result) {
    renderMessage('Halaman berubah. Buka ulang popup untuk scan lagi.', false);
    return;
  }

  if (result.filled > 0) {
    // Riwayat gagal ditulis tidak boleh menggagalkan pengisian yang sudah jalan.
    appendLog({
      at: new Date().toISOString(),
      host: hostname,
      platform: platformLabel,
      title: pageTitle,
      filled: result.filled,
      profile: 'Utama',
    }).catch(() => {});
  }

  renderResult(result);
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

/**
 * Suntik content script ke tab aktif. Berkasnya diambil dari manifest supaya
 * daftarnya tidak ditulis dua kali.
 *
 * Gagal di halaman yang memang tertutup untuk extension (chrome://, Web Store,
 * berkas PDF). Itu batasan Chrome, bukan bug - tampilkan apa adanya.
 */
async function injectHere() {
  const { js } = chrome.runtime.getManifest().content_scripts[0];
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: js });
  } catch (err) {
    renderMessage('Halaman ini tidak bisa dipindai: ' + err.message, false);
    return;
  }
  await start();
}

async function start() {
  const scan = await send({
    type: 'scan',
    options: { overwriteFilled: state.settings.overwriteFilled },
  });

  if (!scan) {
    // Belum ada content script di sini. Izin activeTab aktif begitu user
    // mengklik ikon, jadi bisa disuntik saat ini juga - portal mana pun,
    // tanpa izin permanen apa pun.
    render([
      el('p', { className: 'small muted', textContent:
        'Satset belum memindai halaman ini. Portal ini belum dikenali, '
        + 'tapi kolom formnya tetap bisa dicocokkan.' }),
      el('button', { className: 'primary wide', textContent: 'Pindai halaman ini',
        onclick: injectHere }),
    ]);
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

  platformLabel = scan.platform?.label ?? '';
  renderScan(scan);
}

try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;
  hostname = tab.url ? new URL(tab.url).hostname : '';
  pageTitle = tab.title ?? '';   // judul lowongan, tanpa perlu menyentuh halaman

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
