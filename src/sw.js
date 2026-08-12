// Service worker. Tugasnya cuma satu: menaruh angka di ikon toolbar.
//
// Sengaja tidak menyimpan state dan tidak pernah menyentuh profil - popup baca
// storage sendiri (TDD.md bagian 5). Kalau suatu saat badge tidak dipakai lagi,
// berkas ini bisa dihapus utuh tanpa mengubah apa pun.

chrome.runtime.onInstalled.addListener((details) => {
  // Profil kosong tidak ada gunanya, jadi antar user ke editor sejak awal.
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'detected') return;

  const tabId = sender.tab?.id;
  if (tabId == null) return;

  chrome.action.setBadgeText({ tabId, text: msg.count > 0 ? String(msg.count) : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#2f6f4e' });
});
