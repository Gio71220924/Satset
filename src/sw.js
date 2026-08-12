// Service worker. Tiga tugas kecil, dan tidak satu pun menyentuh profil -
// popup yang membaca storage sendiri (TDD.md bagian 5).
//
//   1. angka badge di ikon
//   2. mengantar data mapping ke content script
//   3. mendaftarkan content script di semua situs, kalau user mengizinkan

const CONTENT = chrome.runtime.getManifest().content_scripts[0];
const ALL_SITES = { origins: ['<all_urls>'] };
const ALL_SITES_ID = 'satset-all-sites';

/* ---------- data mapping ---------- */

let cache = null;

/**
 * Content script tidak mengambil data/*.json sendiri, karena itu menuntut
 * web_accessible_resources - dan berkas yang web-accessible bisa di-fetch situs
 * mana pun untuk mendeteksi extension apa yang terpasang. Untuk alat pencari
 * kerja itu bocor yang nyata: situs karier bisa tahu pelamarnya memakai
 * autofill. Lewat service worker, tidak ada yang terekspos ke halaman.
 */
async function matchData() {
  cache ??= await Promise.all([
    fetch(chrome.runtime.getURL('data/mappings.json')).then((r) => r.json()),
    fetch(chrome.runtime.getURL('data/keywords.json')).then((r) => r.json()),
  ]).then(([mappings, keywords]) => ({ mappings, keywords }));
  return cache;
}

/* ---------- deteksi di semua situs (opsional) ---------- */

/**
 * Izin `<all_urls>` saja tidak membuat content script jalan di mana-mana -
 * skrip deklaratif hanya jalan di `matches` yang tertulis di manifest. Jadi
 * saat user menyalakannya, skrip didaftarkan ulang secara dinamis.
 *
 * excludeMatches memakai daftar vendor dari manifest supaya di domain yang
 * sudah tercakup skrip tidak dimuat dua kali (deklarasi `const` yang sama
 * dijalankan dua kali akan melempar).
 */
async function syncAllSites() {
  const granted = await chrome.permissions.contains(ALL_SITES);
  const existing = await chrome.scripting
    .getRegisteredContentScripts({ ids: [ALL_SITES_ID] })
    .catch(() => []);

  if (granted && existing.length === 0) {
    await chrome.scripting.registerContentScripts([{
      id: ALL_SITES_ID,
      matches: ['<all_urls>'],
      excludeMatches: CONTENT.matches,
      js: CONTENT.js,
      runAt: 'document_idle',
      allFrames: true,
    }]);
  } else if (!granted && existing.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [ALL_SITES_ID] });
  }
}

chrome.runtime.onStartup.addListener(syncAllSites);
chrome.permissions.onAdded.addListener(syncAllSites);
chrome.permissions.onRemoved.addListener(syncAllSites);

chrome.runtime.onInstalled.addListener((details) => {
  syncAllSites();
  // Profil kosong tidak ada gunanya, jadi antar user ke editor sejak awal.
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

/* ---------- pesan ---------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg?.type) {
    case 'detected': {
      const tabId = sender.tab?.id;
      if (tabId == null) return false;
      chrome.action.setBadgeText({ tabId, text: msg.count > 0 ? String(msg.count) : '' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#2f6f4e' });
      return false;
    }

    case 'getMatchData':
      matchData()
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;   // jawaban menyusul, jangan tutup kanalnya

    default:
      return false;
  }
});
