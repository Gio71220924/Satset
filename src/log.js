// Riwayat lamaran. Catatan, bukan CRM - tanpa status, tanpa tahapan, tanpa
// pengingat. Begitu ada kolom "status" dan "catatan", itu produk kedua yang
// harus dirawat.
//
// Key-nya terpisah dari profil supaya menulis riwayat tidak ikut menulis ulang
// resume base64, dan supaya riwayat bisa dihapus tanpa menyentuh profil.

export const LOG_KEY = 'satset_log';

/** Entri lama dibuang diam-diam. Riwayat lamaran bukan data yang tak tergantikan. */
const LIMIT = 200;

/**
 * @typedef {Object} LogEntry
 * @property {string} at        ISO 8601
 * @property {string} host      mis. "jobs.lever.co"
 * @property {string} platform  label vendor, atau "" kalau lewat heuristik saja
 * @property {string} title     judul halaman lowongan
 * @property {number} filled    jumlah kolom terisi
 * @property {string} profile   nama profil yang dipakai
 */

/** @returns {Promise<LogEntry[]>} terbaru dulu */
export async function readLog() {
  const stored = await chrome.storage.local.get(LOG_KEY);
  return Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
}

/** @param {LogEntry} entry */
export async function appendLog(entry) {
  const entries = [entry, ...await readLog()].slice(0, LIMIT);
  await chrome.storage.local.set({ [LOG_KEY]: entries });
}

export async function clearLog() {
  await chrome.storage.local.remove(LOG_KEY);
}
