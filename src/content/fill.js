// Eksekusi pengisian + pintu masuk pesan dari popup.
// Dimuat paling akhir: bergantung pada score.js, dom.js, match.js.

const HIGHLIGHT = {
  mapping: '#22c55e',    // dari selector platform - keyakinan tinggi
  heuristic: '#eab308',  // tebakan dari label - periksa lagi
};

let matchData = null;
let lastScan = { platform: null, fields: [] };

/** Nilai sebelum diisi, untuk undo. Map biasa karena perlu di-iterasi. */
const previous = new Map();

/* ---------- highlight ---------- */

function markFilled(el, source) {
  el.style.outline = `2px solid ${HIGHLIGHT[source]}`;
  el.style.outlineOffset = '1px';
  el.title = 'Diisi Satset';
  // Halaman kembali bersih begitu user selesai memeriksa kolomnya.
  el.addEventListener('blur', () => clearMark(el), { once: true });
}

function clearMark(el) {
  el.style.outline = '';
  el.style.outlineOffset = '';
  el.removeAttribute('title');
}

/* ---------- scan ---------- */

async function runScan(options) {
  matchData ??= await loadMatchData();
  lastScan = scanFields(matchData, options);

  return {
    platform: lastScan.platform
      ? { id: lastScan.platform.id, label: lastScan.platform.label }
      : null,
    fields: lastScan.fields.map((f, id) => ({
      id, label: f.label, path: f.path, source: f.source, score: f.score,
    })),
  };
}

/* ---------- isi ---------- */

function fillOne(field, payload) {
  const { el, path, source } = field;
  if (!el.isConnected) return 'failed';        // halaman berubah sejak scan

  if (path.startsWith('documents.')) {
    const doc = payload.documents?.[path.split('.')[1]];
    if (!doc) return 'skipped';
    if (!setFileValue(el, doc)) return 'failed';
    markFilled(el, source);
    return 'filled';
  }

  const raw = payload.values?.[path] ?? '';
  if (!raw) return 'skipped';                 // kosong di profil, jangan tulis ""

  // "2018-08" jadi "2018" kalau kolomnya cuma minta tahun.
  const value = adaptDateValue(fieldInfoFor(el), raw);

  if (!previous.has(el)) previous.set(el, el.value);

  if (el.tagName === 'SELECT') {
    if (!selectOption(el, value)) return 'failed';
  } else {
    setNativeValue(el, value);
  }

  markFilled(el, source);
  return 'filled';
}

function applyFill(payload) {
  const result = { filled: 0, skipped: 0, failed: 0, failedLabels: [] };

  for (const field of lastScan.fields) {
    const outcome = fillOne(field, payload);
    result[outcome] += 1;
    if (outcome === 'failed') result.failedLabels.push(field.label);
  }

  return result;
}

function undoFill() {
  let restored = 0;
  for (const [el, value] of previous) {
    if (!el.isConnected) continue;
    setNativeValue(el, value);
    clearMark(el);
    restored += 1;
  }
  previous.clear();
  // Berkas tidak ikut dikembalikan: input file tidak bisa dikosongkan lewat
  // DataTransfer tanpa memicu handler unggah lagi. Popup menyebutkannya.
  return { restored };
}

/* ---------- deteksi otomatis ---------- */

async function detect() {
  try {
    const { fields } = await runScan({});
    chrome.runtime.sendMessage({ type: 'detected', count: fields.length });
    return fields.length;
  } catch {
    return 0;   // halaman tanpa izin, atau extension baru saja di-reload
  }
}

/**
 * Form ATS sering di-mount React belakangan, jadi scan saat load bisa nihil.
 * Observer dilepas begitu ketemu, atau menyerah setelah 10 detik.
 *
 * ponytail: sengaja tidak memantau terus. Form multi-step ditangani user
 * dengan membuka popup lagi di langkah berikutnya (TDD.md bagian 12).
 */
async function watchForForm() {
  if (await detect()) return;

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (await detect()) stop();
    }, 400);
  });

  const stop = () => {
    clearTimeout(timer);
    observer.disconnect();
  };

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(stop, 10_000);
}

/* ---------- pesan ---------- */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'scan':
      runScan(msg.options ?? {})
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;    // jawaban menyusul, jangan tutup kanalnya

    case 'fill':
      sendResponse(applyFill(msg.payload ?? {}));
      return false;

    case 'undo':
      sendResponse(undoFill());
      return false;

    case 'report':
      // Label/name/id kolom yang tidak dikenali. Tanpa nilai kolom.
      sendResponse({
        hostname: location.hostname,
        platform: lastScan.platform?.id ?? null,
        unmatched: unmatchedFields(lastScan.fields),
      });
      return false;

    default:
      return false;
  }
});

watchForForm();
