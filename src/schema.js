// Satset — sumber kebenaran tunggal untuk bentuk profil.
// Dipakai oleh options.js (editor), popup.js (baca sebelum fill),
// dan sebagai acuan `path` di data/mappings.json + data/keywords.json.
// Penjelasan konvensi: docs/profile-schema.md

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'satset';

/**
 * Profil kosong yang valid. Fungsi ini yang mendefinisikan bentuknya - kalau
 * dokumen dan kode berbeda, kode yang benar. Konvensi lengkap dan alasannya:
 * docs/profile-schema.md
 *
 * Semua teks default "" (bukan null) supaya options page bisa bind langsung
 * ke <input> tanpa cek null di tiap kolom. `null` hanya dipakai di dua tempat
 * yang artinya memang beda: endDate dan documents.
 *
 * @returns {object}
 */
export function emptyProfile() {
  return {
    personal: {
      firstName: '', lastName: '',
      fullName: '',      // disimpan terpisah, bukan turunan - sebagian orang
                         // punya satu nama, sebagian punya nama tengah
      email: '',
      phone: '',         // E.164, mis. "+6281234567890" - sebagian ATS memvalidasi
      dateOfBirth: '',   // "YYYY-MM-DD" atau ""
      addressLine: '', city: '', province: '', postalCode: '',
      country: '',       // nama negara dalam bahasa Inggris, mis. "Indonesia"
      nationality: '',
    },
    // URL lengkap dengan skema ("https://..."), ATS sering memvalidasi formatnya
    links: { linkedin: '', github: '', portfolio: '', website: '' },

    // Urut terbaru dulu - indeks 0 yang dipakai untuk "current company".
    // {company, title, location, startDate, endDate, current, description}
    //   startDate/endDate "YYYY-MM"; endDate null = masih berjalan
    //   current redundan dengan endDate===null, tapi ATS punya checkbox sendiri
    work: [],
    // {school, degree, fieldOfStudy, location, startDate, endDate, gpa}
    //   gpa string, bukan number - "3.450" harus terisi persis seperti ditulis
    education: [],
    skills: [],      // string[]
    languages: [],   // {name, proficiency: native|fluent|professional|basic}[]

    // StoredFile: {name, mime, size, data} - data base64 tanpa prefix data-URI
    documents: { resume: null, coverLetter: null },

    preferences: {
      desiredSalary: '', noticePeriod: '',
      availableFrom: '',   // "YYYY-MM-DD" atau ""
      workAuthorization: '', requiresSponsorship: false,
      willingToRelocate: false,
    },
    updatedAt: '',   // ISO 8601, diisi saat simpan
  };
}

export function defaultSettings() {
  return {
    overwriteFilled: false,  // true = field yang sudah ada isinya ikut ditimpa
  };
}

/**
 * Migrasi berurutan dari versi tersimpan ke SCHEMA_VERSION.
 * Tambah entri tiap kali SCHEMA_VERSION naik; kunci = versi ASAL.
 * @type {Record<number, (data: object) => object>}
 */
const MIGRATIONS = {
  // 1 -> 2: satu profil jadi daftar profil. Profil lama dibungkus apa adanya,
  // nol field hilang - kalau langkah ini salah, profil orang lenyap.
  1: (data) => {
    const only = { id: newProfileId(), name: 'Utama', data: data.profile ?? emptyProfile() };
    return { profiles: [only], activeId: only.id, settings: data.settings };
  },
};

/** crypto.randomUUID ada di Chrome dan Node modern. Tanpa pustaka id. */
const newProfileId = () => crypto.randomUUID();

/** Profil yang sedang dipakai. Selalu mengembalikan sesuatu selama profiles tidak kosong. */
export function activeProfile(state) {
  return state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0];
}

function freshState() {
  const only = { id: newProfileId(), name: 'Utama', data: emptyProfile() };
  return {
    schemaVersion: SCHEMA_VERSION,
    profiles: [only],
    activeId: only.id,
    settings: defaultSettings(),
  };
}

/**
 * @param {object|undefined} stored isi chrome.storage.local[STORAGE_KEY]
 * @returns {{schemaVersion: number, profile: object, settings: object}}
 * @throws {Error} kalau data berasal dari versi extension yang lebih baru
 */
export function migrate(stored) {
  if (!stored) return freshState();

  let v = stored.schemaVersion ?? 1;
  if (v > SCHEMA_VERSION) {
    throw new Error(
      `Data profil dibuat oleh Satset versi lebih baru (skema ${v}, ` +
      `extension ini mendukung ${SCHEMA_VERSION}). Update extension dulu — ` +
      `data tidak diubah.`
    );
  }

  let data = stored;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Migrasi skema ${v} -> ${v + 1} tidak ada`);
    data = step(data);
    v += 1;
  }

  // Daftar kosong atau rusak diganti profil baru, bukan dibiarkan - halaman
  // pengaturan tidak boleh menghadapi state tanpa profil sama sekali.
  const list = Array.isArray(data.profiles) && data.profiles.length
    ? data.profiles
    : freshState().profiles;

  const profiles = list.map((p) => ({
    id: p.id ?? newProfileId(),
    name: p.name || 'Tanpa nama',
    data: fillDefaults(emptyProfile(), p.data),
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    profiles,
    activeId: profiles.some((p) => p.id === data.activeId) ? data.activeId : profiles[0].id,
    settings: { ...defaultSettings(), ...data.settings },
  };
}

/**
 * Tambal key yang hilang dari `defaults` ke `stored`, dua level (root + section).
 * Array (work, education, skills) diganti utuh, bukan digabung.
 * Perlu dua level karena profil disimpan per section: profil lama yang belum punya
 * `personal.nationality` harus dapat "" — bukan undefined yang bocor ke <input>.
 */
function fillDefaults(defaults, stored) {
  if (!stored) return defaults;
  const out = { ...defaults };
  for (const [key, def] of Object.entries(defaults)) {
    const val = stored[key];
    if (val === undefined) continue;
    out[key] = (def && typeof def === 'object' && !Array.isArray(def))
      ? { ...def, ...val }
      : val;
  }
  return out;
}

/**
 * Baca berkas ekspor dari luar. Ini batas kepercayaan: migrate() dibuat untuk
 * data milik sendiri di storage, jadi bentuk berkas asing harus dicek DULU.
 * Tanpa cek ini, JSON sembarang lolos jadi profil kosong dan menimpa data asli
 * tanpa suara - kegagalan yang paling mahal karena tidak kelihatan.
 *
 * @param {string} text isi berkas .json
 * @returns {{schemaVersion: number, profile: object, settings: object}}
 * @throws {Error} JSON rusak, bentuk bukan ekspor Satset, atau versi lebih baru
 */
export function parseImport(text) {
  const parsed = JSON.parse(text);

  // Terima dua bentuk: ekspor v1 (satu `profile`) dan v2 (daftar `profiles`).
  // Yang v1 diangkat oleh MIGRATIONS, jadi berkas lama tetap bisa diimpor.
  const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const looksLikeExport = isPlainObject(parsed)
    && (isPlainObject(parsed.profile) || Array.isArray(parsed.profiles));
  if (!looksLikeExport) {
    throw new Error('Berkas ini bukan hasil ekspor Satset.');
  }

  return migrate(parsed);
}

/**
 * Ambil nilai lewat path bertitik seperti "personal.firstName" atau "work.0.company".
 * Dipakai mapping & heuristik untuk menunjuk field profil tanpa hardcode struktur.
 * @returns {string} string siap isi; "" kalau tidak ada / null / array kosong
 */
export function getPath(profile, path) {
  const value = path.split('.').reduce(
    (acc, key) => (acc == null ? undefined : acc[key]),
    profile
  );
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');  // mis. skills -> "React, SQL"
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/**
 * Pasangan getPath: simpan nilai ke path bertitik. Nilai disimpan apa adanya,
 * TIDAK dikonversi ke string - checkbox tetap boolean, array tetap array.
 * Konversi ke teks hanya terjadi saat mengisi form (getPath).
 *
 * Wadah yang belum ada dibuatkan: kunci angka jadi array, selain itu objek.
 * @returns {object} profile yang sama (dimutasi)
 */
export function setPath(profile, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = profile;

  for (const [i, key] of keys.entries()) {
    if (node[key] == null) {
      const nextKey = keys[i + 1] ?? last;
      node[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    node = node[key];
  }

  node[last] = value;
  return profile;
}
