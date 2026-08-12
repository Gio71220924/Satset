// Jalankan dari root repo: node --test
//
// score.js adalah classic script (syarat content script MV3), jadi tidak bisa
// di-import. Dimuat lewat node:vm - tanpa build step, tanpa dual-module hack,
// dan yang diuji benar-benar berkas yang dikirim ke Chrome.
//
// Kamus yang dipakai juga data/keywords.json yang asli, bukan tiruan: gunanya
// justru menangkap saat menambah pola baru diam-diam merusak yang sudah benar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('./score.js', import.meta.url), 'utf8'), sandbox);
const { pickField, scoreField, normalizeText } = sandbox;

const keywords = JSON.parse(
  fs.readFileSync(new URL('../../data/keywords.json', import.meta.url), 'utf8')
);

/** Kolom form tiruan. Yang tidak disebut dianggap kosong. */
const field = (props) => ({ label: '', name: '', id: '', placeholder: '', ariaLabel: '', ...props });

const pathOf = (props) => pickField(field(props), keywords)?.path ?? null;

test('normalizeText: pemisah jadi spasi', () => {
  assert.equal(normalizeText('first_name'), 'first name');
  assert.equal(normalizeText('urls[LinkedIn]'), 'urls linkedin');
  assert.equal(normalizeText('  Full   Name  '), 'full name');
  assert.equal(normalizeText(null), '');
});

test('label yang jelas ketemu, dua bahasa', () => {
  assert.equal(pathOf({ label: 'First Name' }), 'personal.firstName');
  assert.equal(pathOf({ label: 'Nama depan' }), 'personal.firstName');
  assert.equal(pathOf({ label: 'Last Name' }), 'personal.lastName');
  assert.equal(pathOf({ label: 'LinkedIn Profile' }), 'links.linkedin');
  assert.equal(pathOf({ label: 'Current Company' }), 'work.0.company');
});

test('atribut name unggul dari label', () => {
  assert.equal(scoreField(field({ name: 'first_name' }), { patterns: ['first name'] }), 3);
  // kata utuh di dalam name, bentuk yang lazim di ATS
  assert.equal(scoreField(field({ name: 'job_application_first_name' }), { patterns: ['first name'] }), 2);
  assert.equal(scoreField(field({ label: 'First Name' }), { patterns: ['first name'] }), 2);
  assert.equal(scoreField(field({ placeholder: 'first name here' }), { patterns: ['first name'] }), 1);
  assert.equal(pathOf({ name: 'urls[LinkedIn]' }), 'links.linkedin');
});

// Inti dari seluruh berkas ini. Tiap baris di bawah, kalau lolos, mengisi
// kolom dengan data yang salah tanpa user sadar sampai lamaran terkirim.
test('pola negative menang: kolom mirip tapi bukan tetap dilewati', () => {
  assert.equal(pathOf({ label: 'Emergency Contact Phone' }), null);
  assert.equal(pathOf({ label: 'Current Salary' }), null);
  assert.equal(pathOf({ label: 'Company Website' }), null);
  assert.equal(pathOf({ label: 'Confirm Email' }), null);
  assert.equal(pathOf({ label: 'Position Applied For' }), null);
});

test('kolom yang benar tetap ketemu walau tetangganya punya pola negative', () => {
  assert.equal(pathOf({ label: 'Phone' }), 'personal.phone');
  assert.equal(pathOf({ label: 'Email' }), 'personal.email');
  assert.equal(pathOf({ label: 'Expected Salary' }), 'preferences.desiredSalary');
});

test('label ambigu dilewati, bukan ditebak', () => {
  assert.equal(pathOf({ label: 'Name' }), null);
  assert.equal(pathOf({ label: '' }), null);
  assert.equal(pathOf({ label: 'Additional Information' }), null);
  assert.equal(pathOf({ label: 'How did you hear about us?' }), null);
});

test('daftar terlarang dilewati berapa pun skornya', () => {
  assert.equal(pathOf({ label: 'Password', name: 'password' }), null);
  assert.equal(pathOf({ label: 'Gender' }), null);
  assert.equal(pathOf({ label: 'Race / Ethnicity' }), null);
  assert.equal(pathOf({ label: 'Veteran Status' }), null);
  assert.equal(pathOf({ label: 'Disability Status' }), null);
  // "Email" saja lolos, tapi begitu ada kata terlarang di kolom yang sama, batal
  assert.equal(pathOf({ label: 'Email', name: 'verification_code' }), null);
});

// Kolom asli dari form Workday tiket.com, diperiksa lewat DevTools:
//   name="website"  data-automation-id="beecatcher"
//   label="Enter website. This input is for robots only,"
// name-nya cocok MUTLAK dengan pola links.website (skor 3). Tanpa penahan
// _neverFill, kolom ini pasti terisi dan lamaran ditandai robot.
test('honeypot anti-bot tidak diisi walau name-nya cocok mutlak', () => {
  assert.equal(pathOf({
    name: 'website',
    label: 'Enter website. This input is for robots only,',
  }), null);

  // Varian honeypot yang lazim di form lain
  assert.equal(pathOf({ name: 'website', label: 'Leave this field blank' }), null);
  assert.equal(pathOf({ name: 'email', label: 'Do not fill this in' }), null);

  // Kolom website yang sah tetap ketemu - penahannya tidak kebablasan
  assert.equal(pathOf({ label: 'Personal Website', name: 'website' }), 'links.website');
});

test('tiap path di kamus mengarah ke section yang ada di skema', async () => {
  const { emptyProfile } = await import('../schema.js');
  const profile = emptyProfile();

  for (const entry of keywords.entries) {
    const [head] = entry.path.split('.');
    assert.ok(head in profile, `path "${entry.path}" tidak ada di skema profil`);
  }
});
