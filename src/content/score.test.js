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
const { pickField, scoreField, normalizeText, adaptDateValue } = sandbox;

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

test('kolom tanggal pendidikan dan kerja tidak saling merebut', () => {
  assert.equal(pathOf({ label: 'Graduation Year' }), 'education.0.endDate');
  assert.equal(pathOf({ label: 'Tahun lulus' }), 'education.0.endDate');
  assert.equal(pathOf({ label: 'To (Actual or Expected)' }), 'education.0.endDate');
  assert.equal(pathOf({ label: 'Employment Start' }), 'work.0.startDate');
  assert.equal(pathOf({ label: 'Last Day' }), 'work.0.endDate');

  // Entri tanggal baru tidak boleh merusak yang sudah benar
  assert.equal(pathOf({ label: 'Start Date' }), 'preferences.availableFrom');
  assert.equal(pathOf({ label: 'Date of Birth' }), 'personal.dateOfBirth');
  assert.equal(pathOf({ label: 'Notice Period' }), 'preferences.noticePeriod');

  // "From" / "To" telanjang memang ambigu - kerja dan pendidikan sama-sama
  // punya, jadi dilewati alih-alih ditebak. Butuh atribut name/id asli.
  assert.equal(pathOf({ label: 'From' }), null);
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

// Profil menyimpan "YYYY-MM". Mengirimnya apa adanya ke kolom yang cuma muat
// 4 digit (Workday: placeholder "YYYY", maxlength 4) sama saja dengan gagal.
test('adaptDateValue: bentuk tanggal mengikuti yang diminta kolom', () => {
  const at = (props, value = '2018-08') =>
    adaptDateValue({ label: '', placeholder: '', ariaLabel: '', type: 'text', maxLength: 0, ...props }, value);

  // Workday: kotak 4 digit berlabel From / To (Actual or Expected)
  assert.equal(at({ placeholder: 'YYYY', maxLength: 4 }), '2018');
  assert.equal(at({ maxLength: 4 }), '2018');
  assert.equal(at({ label: 'Graduation Year (YYYY)' }), '2018');

  // Pola gabungan harus menang atas "yyyy" sendirian
  assert.equal(at({ placeholder: 'MM/YYYY' }), '08/2018');
  assert.equal(at({ placeholder: 'MM-YYYY' }), '08/2018');
  assert.equal(at({ placeholder: 'YYYY-MM' }), '2018-08');

  // Kolom tanggal native
  assert.equal(at({ type: 'month' }), '2018-08');
  assert.equal(at({ type: 'date' }), '2018-08-01');

  // Tanpa petunjuk, jangan menebak - kirim apa adanya
  assert.equal(at({}), '2018-08');

  // Nilai yang bukan YYYY-MM tidak boleh disentuh
  assert.equal(at({ maxLength: 4 }, 'Universitas Contoh'), 'Universitas Contoh');
  assert.equal(at({ placeholder: 'YYYY' }, '3.74'), '3.74');
  assert.equal(at({ type: 'date' }, '1999-04-17'), '1999-04-17');
  assert.equal(at({ placeholder: 'YYYY' }, ''), '');
});

test('tiap path di kamus mengarah ke section yang ada di skema', async () => {
  const { emptyProfile } = await import('../schema.js');
  const profile = emptyProfile();

  for (const entry of keywords.entries) {
    const [head] = entry.path.split('.');
    assert.ok(head in profile, `path "${entry.path}" tidak ada di skema profil`);
  }
});
