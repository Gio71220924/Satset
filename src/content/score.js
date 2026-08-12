// Skoring heuristik. Sengaja tanpa DOM sama sekali: masuknya objek biasa,
// keluarnya angka. Itu yang bikin bagian ini bisa diuji di Node (score.test.js
// memuatnya lewat node:vm) padahal berkasnya tetap classic script untuk Chrome.
//
// Aturan skor ada di TDD.md bagian 6.3.

const MIN_SCORE = 2;      // di bawah ini tidak diisi
const MARGIN = 1;         // juara 1 harus unggul segini dari juara 2

function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[_\-[\]().]/g, ' ')   // urls[LinkedIn] -> urls linkedin
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWord(haystack, needle) {
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`).test(haystack);
}

/** Gabungan semua petunjuk satu kolom, sudah dinormalisasi. */
function flatten(field) {
  return [field.label, field.name, field.id, field.placeholder, field.ariaLabel]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

/**
 * Skor satu kolom terhadap satu entri kamus.
 * name/id persis = 3, kata utuh di label = 2, substring di placeholder = 1.
 * Ada pola negative = -4, cukup untuk menjatuhkan skor tertinggi ke bawah ambang.
 */
function scoreField(field, entry) {
  const label = normalizeText(field.label);
  const name = normalizeText(field.name);
  const id = normalizeText(field.id);
  const extra = `${normalizeText(field.placeholder)} ${normalizeText(field.ariaLabel)}`;

  let best = 0;
  for (const raw of entry.patterns) {
    const pattern = normalizeText(raw);
    let score = 0;
    if (name === pattern || id === pattern) score = 3;
    // Kata utuh DI DALAM name/id, mis. name="urls[LinkedIn]" atau
    // id="job_application_first_name". Bentuk ini justru yang lazim di ATS -
    // tanpa tingkat ini, kolom LinkedIn asli Lever tidak pernah ketemu.
    else if (hasWord(name, pattern) || hasWord(id, pattern)) score = 2;
    else if (hasWord(label, pattern)) score = 2;
    else if (extra.includes(pattern)) score = 1;
    if (score > best) best = score;
  }

  const all = flatten(field);
  const negated = (entry.negative ?? [])
    .some((neg) => all.includes(normalizeText(neg)));

  return negated ? best - 4 : best;
}

/**
 * Pilih path profil untuk satu kolom, atau null kalau tidak yakin.
 *
 * Tidak yakin lebih baik daripada salah: kolom kosong bisa diisi user dalam
 * 3 detik, kolom salah isi bisa lolos submit tanpa disadari.
 *
 * @returns {{path: string, score: number}|null}
 */
function pickField(field, keywords) {
  const all = flatten(field);

  // Daftar terlarang jalan di luar skoring - berapa pun skornya, tetap dilewati.
  const banned = keywords._neverFill?.patterns ?? [];
  if (banned.some((pattern) => all.includes(normalizeText(pattern)))) return null;

  const ranked = keywords.entries
    .map((entry) => ({ path: entry.path, score: scoreField(field, entry) }))
    .sort((a, b) => b.score - a.score);

  const [best, second] = ranked;
  if (!best || best.score < MIN_SCORE) return null;
  if (second && best.score - second.score < MARGIN) return null;   // ambigu

  return best;
}
