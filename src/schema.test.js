// Jalankan dari root repo: node --test
// ponytail: cuma menutup logic yang bisa diam-diam salah — migrate() dan getPath().
// Field getter/setter biasa tidak dites.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, emptyProfile, migrate, getPath, setPath } from './schema.js';

test('storage kosong -> profil default yang valid', () => {
  const { schemaVersion, profile, settings } = migrate(undefined);
  assert.equal(schemaVersion, SCHEMA_VERSION);
  assert.equal(profile.personal.email, '');
  assert.deepEqual(profile.work, []);
  assert.equal(settings.overwriteFilled, false);
});

test('profil lama yang kekurangan key baru diisi default, nilai lama dipertahankan', () => {
  const stored = {
    schemaVersion: 1,
    profile: { personal: { firstName: 'Ana' } },  // tanpa links/work/dst
  };
  const { profile } = migrate(stored);
  assert.equal(profile.personal.firstName, 'Ana');
  // field lain di section yang sama harus tetap "" — bukan undefined
  assert.equal(profile.personal.email, '');
  assert.equal(profile.personal.nationality, '');
  assert.deepEqual(profile.links, emptyProfile().links);
  assert.deepEqual(profile.skills, []);
});

test('array di profil tersimpan diganti utuh, tidak digabung dengan default', () => {
  const stored = {
    schemaVersion: 1,
    profile: { work: [{ company: 'Contoh', startDate: '2023-08', endDate: null }] },
  };
  const { profile } = migrate(stored);
  assert.equal(profile.work.length, 1);
  assert.equal(profile.work[0].company, 'Contoh');
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
