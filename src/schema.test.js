// Jalankan dari root repo: node --test
// ponytail: cuma menutup logic yang bisa diam-diam salah — migrate() dan getPath().
// Field getter/setter biasa tidak dites.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, emptyProfile, migrate, activeProfile, parseImport, getPath, setPath,
} from './schema.js';

/** Profil aktif dari hasil migrate(). */
const dataOf = (stored) => activeProfile(migrate(stored)).data;

test('storage kosong -> satu profil default yang valid', () => {
  const state = migrate(undefined);
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.activeId, state.profiles[0].id);
  assert.equal(state.settings.overwriteFilled, false);

  const profile = activeProfile(state).data;
  assert.equal(profile.personal.email, '');
  assert.deepEqual(profile.work, []);
});

// Migrasi 1 -> 2 adalah jalur kehilangan data. Kalau salah, profil orang lenyap.
test('migrasi v1: profil tunggal dibungkus jadi daftar, isinya utuh', () => {
  const state = migrate({
    schemaVersion: 1,
    profile: { personal: { firstName: 'Ana', email: 'ana@contoh.id' } },
    settings: { overwriteFilled: true },
  });

  assert.equal(state.schemaVersion, 2);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].name, 'Utama');
  assert.ok(state.profiles[0].id);
  assert.equal(state.activeId, state.profiles[0].id);

  const profile = activeProfile(state).data;
  assert.equal(profile.personal.firstName, 'Ana');
  assert.equal(profile.personal.email, 'ana@contoh.id');
  assert.equal(state.settings.overwriteFilled, true);
});

test('profil lama yang kekurangan key baru diisi default, nilai lama dipertahankan', () => {
  const profile = dataOf({
    schemaVersion: 1,
    profile: { personal: { firstName: 'Ana' } },  // tanpa links/work/dst
  });
  assert.equal(profile.personal.firstName, 'Ana');
  // field lain di section yang sama harus tetap "" — bukan undefined
  assert.equal(profile.personal.email, '');
  assert.equal(profile.personal.nationality, '');
  assert.deepEqual(profile.links, emptyProfile().links);
  assert.deepEqual(profile.skills, []);
});

test('array di profil tersimpan diganti utuh, tidak digabung dengan default', () => {
  const profile = dataOf({
    schemaVersion: 1,
    profile: { work: [{ company: 'Contoh', startDate: '2023-08', endDate: null }] },
  });
  assert.equal(profile.work.length, 1);
  assert.equal(profile.work[0].company, 'Contoh');
});

test('beberapa profil dipertahankan; activeId ngawur jatuh ke yang pertama', () => {
  const state = migrate({
    schemaVersion: 2,
    profiles: [
      { id: 'a', name: 'Data Analyst', data: { personal: { firstName: 'Ana' } } },
      { id: 'b', name: 'ML Engineer', data: { personal: { firstName: 'Ana' } } },
    ],
    activeId: 'sudah-dihapus',
  });

  assert.equal(state.profiles.length, 2);
  assert.deepEqual(state.profiles.map((p) => p.name), ['Data Analyst', 'ML Engineer']);
  assert.equal(state.activeId, 'a');
  assert.equal(activeProfile(state).name, 'Data Analyst');
});

test('daftar profil kosong tidak pernah lolos - selalu ada satu profil', () => {
  for (const stored of [
    { schemaVersion: 2, profiles: [] },
    { schemaVersion: 2, profiles: 'bukan array' },
    { schemaVersion: 2 },
  ]) {
    const state = migrate(stored);
    assert.equal(state.profiles.length, 1, `gagal untuk: ${JSON.stringify(stored)}`);
    assert.ok(activeProfile(state).data.personal);
  }
});

test('data dari extension versi lebih baru ditolak, bukan ditimpa', () => {
  assert.throws(
    () => migrate({ schemaVersion: SCHEMA_VERSION + 1, profile: {} }),
    /versi lebih baru/
  );
});

test('getPath: nested, indeks array, dan path tidak ada', () => {
  const profile = {
    personal: { firstName: 'Ana' },
    work: [{ company: 'Contoh', startDate: '2023-08', endDate: null }],
  };
  assert.equal(getPath(profile, 'personal.firstName'), 'Ana');
  assert.equal(getPath(profile, 'work.0.company'), 'Contoh');
  assert.equal(getPath(profile, 'work.0.startDate'), '2023-08');
  assert.equal(getPath(profile, 'work.0.endDate'), '');      // null -> ""
  assert.equal(getPath(profile, 'work.9.company'), '');      // indeks kosong, bukan throw
  assert.equal(getPath(profile, 'tidak.ada.sama.sekali'), '');
});

test('getPath: array jadi string koma, boolean jadi Yes/No', () => {
  const profile = {
    skills: ['React', 'SQL'],
    preferences: { willingToRelocate: true, requiresSponsorship: false },
  };
  assert.equal(getPath(profile, 'skills'), 'React, SQL');
  assert.equal(getPath(profile, 'preferences.willingToRelocate'), 'Yes');
  assert.equal(getPath(profile, 'preferences.requiresSponsorship'), 'No');
});

// Impor adalah satu-satunya jalur data dari luar. Tiap kasus di bawah, kalau
// lolos, akan menimpa profil asli dengan profil kosong tanpa suara.
test('parseImport: ekspor v2 diterima utuh', () => {
  const source = {
    schemaVersion: 2,
    profiles: [{
      id: 'a',
      name: 'Data Analyst',
      data: {
        personal: { firstName: 'Ana', email: 'ana@contoh.id' },
        work: [{ company: 'PT Contoh', startDate: '2023-08', endDate: null }],
      },
    }],
    activeId: 'a',
    settings: { overwriteFilled: true },
  };
  const state = parseImport(JSON.stringify(source));
  const profile = activeProfile(state).data;

  assert.equal(activeProfile(state).name, 'Data Analyst');
  assert.equal(profile.personal.firstName, 'Ana');
  assert.equal(profile.personal.nationality, '');   // key baru ditambal default
  assert.equal(profile.work[0].startDate, '2023-08');
  assert.equal(state.settings.overwriteFilled, true);
});

// Berkas ekspor lama harus tetap bisa diimpor setelah skema naik ke v2.
test('parseImport: ekspor v1 lama tetap terbaca lewat migrasi', () => {
  const source = {
    schemaVersion: 1,
    profile: { personal: { firstName: 'Ana', email: 'ana@contoh.id' } },
  };
  const state = parseImport(JSON.stringify(source));

  assert.equal(state.schemaVersion, 2);
  assert.equal(state.profiles.length, 1);
  assert.equal(activeProfile(state).name, 'Utama');
  assert.equal(activeProfile(state).data.personal.email, 'ana@contoh.id');
});

test('parseImport: bentuk yang bukan ekspor Satset ditolak, bukan jadi profil kosong', () => {
  for (const text of [
    'null',
    '42',
    '"ana"',
    '[]',
    '[{"profile":{}}]',
    '{}',                          // tanpa key profile
    '{"profile":null}',
    '{"profile":[]}',              // array bukan objek profil
    '{"profil":{}}',               // salah ketik key
  ]) {
    assert.throws(() => parseImport(text), /bukan hasil ekspor Satset/, `harus ditolak: ${text}`);
  }
});

test('parseImport: JSON rusak melempar, tidak mengembalikan apa pun', () => {
  assert.throws(() => parseImport('{ ini bukan json'), SyntaxError);
  assert.throws(() => parseImport(''), SyntaxError);
});

test('parseImport: berkas dari versi lebih baru tetap ditolak', () => {
  const text = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, profile: {} });
  assert.throws(() => parseImport(text), /versi lebih baru/);
});

test('setPath: tulis nested tanpa menyentuh key tetangga', () => {
  const profile = emptyProfile();
  setPath(profile, 'personal.firstName', 'Ana');
  setPath(profile, 'links.linkedin', 'https://linkedin.com/in/contoh');
  assert.equal(profile.personal.firstName, 'Ana');
  assert.equal(profile.personal.email, '');           // tetangga utuh
  assert.equal(profile.links.linkedin, 'https://linkedin.com/in/contoh');
  assert.equal(profile.links.github, '');
});

test('setPath: simpan tipe apa adanya, bukan string', () => {
  const profile = emptyProfile();
  setPath(profile, 'preferences.willingToRelocate', true);
  setPath(profile, 'skills', ['Python', 'SQL']);
  assert.equal(profile.preferences.willingToRelocate, true);   // boolean, bukan "Yes"
  assert.deepEqual(profile.skills, ['Python', 'SQL']);
  // konversi ke teks baru terjadi saat mengisi form
  assert.equal(getPath(profile, 'preferences.willingToRelocate'), 'Yes');
  assert.equal(getPath(profile, 'skills'), 'Python, SQL');
});

test('setPath: bikin wadah yang belum ada, angka jadi array', () => {
  const profile = emptyProfile();
  setPath(profile, 'work.0.company', 'PT Contoh');
  setPath(profile, 'work.0.startDate', '2023-08');
  setPath(profile, 'work.0.endDate', null);
  assert.ok(Array.isArray(profile.work));
  assert.equal(profile.work.length, 1);
  assert.equal(profile.work[0].company, 'PT Contoh');
  assert.equal(profile.work[0].startDate, '2023-08');
  assert.equal(profile.work[0].endDate, null);
  assert.equal(getPath(profile, 'work.0.startDate'), '2023-08');
});
