// Menyusun rencana pengisian: kolom mana di halaman ini dipetakan ke path
// profil mana. Dua lapis - mapping khusus platform dulu, sisanya heuristik.
//
// PENTING: berkas ini tidak pernah menyentuh profil. Keluarannya cuma daftar
// path, tanpa nilai. Data pribadi baru masuk halaman saat user menekan tombol
// isi di popup (TDD.md bagian 5).

const MAPPING_SCORE = 9;   // di atas skor heuristik mana pun, cuma untuk pengurutan

async function loadMatchData() {
  const read = (path) => fetch(chrome.runtime.getURL(path)).then((r) => r.json());
  const [mappings, keywords] = await Promise.all([
    read('data/mappings.json'),
    read('data/keywords.json'),
  ]);
  return { mappings, keywords };
}

/** Glob sederhana: hanya `*.` di awal yang didukung, sisanya cocok persis. */
function hostMatches(hostname, pattern) {
  if (!pattern.startsWith('*.')) return hostname === pattern;
  const bare = pattern.slice(2);
  return hostname === bare || hostname.endsWith('.' + bare);
}

function findPlatform(hostname, mappings) {
  return mappings.platforms
    .find((p) => p.match.some((m) => hostMatches(hostname, m))) ?? null;
}

function collectCandidates() {
  return [...document.querySelectorAll('input, select, textarea')].filter(isFillable);
}

/**
 * @param {{mappings: object, keywords: object}} data
 * @param {{overwriteFilled?: boolean}} options
 * @returns {{platform: object|null, fields: Array<{el: Element, path: string,
 *           source: 'mapping'|'heuristic', score: number, label: string}>}}
 */
function scanFields(data, options = {}) {
  const { overwriteFilled = false } = options;
  const platform = findPlatform(location.hostname, data.mappings);

  const claimedEls = new Set();
  const claimedPaths = new Set();
  const fields = [];

  const skip = (el) => claimedEls.has(el) || !isFillable(el)
    || (!overwriteFilled && hasValue(el));

  // Lapis 1 - selector khusus platform. Keyakinan tertinggi.
  for (const entry of platform?.fields ?? []) {
    let el;
    try {
      el = document.querySelector(entry.selector);
    } catch {
      continue;   // selector rusak di data, jangan sampai menghentikan scan
    }
    if (!el || skip(el)) continue;

    claimedEls.add(el);
    claimedPaths.add(entry.path);
    fields.push({
      el, path: entry.path, source: 'mapping',
      score: MAPPING_SCORE, label: displayLabel(el),
    });
  }

  // Lapis 2 - heuristik untuk kolom yang belum diklaim.
  for (const el of collectCandidates()) {
    if (skip(el)) continue;

    const hit = pickField(fieldInfoFor(el), data.keywords);
    // Satu path profil hanya boleh dipakai satu kolom per halaman. Yang duluan
    // menang, dan lapis 1 selalu duluan.
    if (!hit || claimedPaths.has(hit.path)) continue;

    claimedEls.add(el);
    claimedPaths.add(hit.path);
    fields.push({
      el, path: hit.path, source: 'heuristic',
      score: hit.score, label: displayLabel(el),
    });
  }

  return { platform, fields };
}

/**
 * Kolom yang tidak dikenali sama sekali. Bahan laporan diagnostik untuk
 * memperbaiki mapping - tanpa nilai kolom, tanpa isi profil (TDD.md bagian 10).
 */
function unmatchedFields(matched) {
  const claimed = new Set(matched.map((f) => f.el));
  return collectCandidates()
    .filter((el) => !claimed.has(el))
    .map((el) => ({ ...fieldInfoFor(el), type: el.type || el.tagName.toLowerCase() }));
}
