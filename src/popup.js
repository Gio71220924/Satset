// Popup M1: baca profil, tampilkan ringkasan, buka options page.
// Deteksi form dan autofill belum ada - itu M2 (docs/roadmap.md).

import { STORAGE_KEY, migrate } from './schema.js';

const body = document.getElementById('body');
document.getElementById('version').textContent =
  'v' + chrome.runtime.getManifest().version;

/** Profil dianggap kosong kalau tidak ada satu pun cara mengenali orangnya. */
function isEmpty(p) {
  const { firstName, fullName, email } = p.personal;
  return !firstName && !fullName && !email;
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) node.append(child);
  return node;
}

function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function render(nodes) {
  body.replaceChildren(...nodes);
}

function renderEmpty() {
  render([
    el('p', { className: 'small muted', textContent:
      'Profil masih kosong. Isi sekali, lalu bisa dipakai di semua form lamaran.' }),
    el('button', { className: 'primary', textContent: 'Isi profil', onclick: openOptions }),
  ]);
}

function renderReady(profile) {
  const name = profile.personal.fullName
    || [profile.personal.firstName, profile.personal.lastName].filter(Boolean).join(' ')
    || profile.personal.email;

  const counts = [
    `${profile.work.length} pengalaman`,
    `${profile.education.length} pendidikan`,
    profile.documents.resume ? 'resume tersimpan' : 'belum ada resume',
  ].join(' · ');

  render([
    el('div', { className: 'card' }, [
      el('strong', { textContent: name }),
      el('div', { className: 'small muted', textContent: counts }),
    ]),
    el('p', { className: 'notice small', textContent:
      'Pengisian form otomatis belum aktif di versi ini.' }),
    el('button', { textContent: 'Buka pengaturan', onclick: openOptions }),
  ]);
}

function renderError(message) {
  render([
    el('p', { className: 'notice warn small', textContent: message }),
    el('button', { textContent: 'Buka pengaturan', onclick: openOptions }),
  ]);
}

try {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const { profile } = migrate(stored[STORAGE_KEY]);
  isEmpty(profile) ? renderEmpty() : renderReady(profile);
} catch (err) {
  // Paling mungkin: data dari extension versi lebih baru. Jangan sentuh datanya.
  renderError(err.message);
}
