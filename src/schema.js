// Satset — sumber kebenaran tunggal untuk bentuk profil.
// Dipakai oleh options.js (editor), popup.js (baca sebelum fill),
// dan sebagai acuan `path` di data/mappings.json + data/keywords.json.
// Penjelasan konvensi: docs/profile-schema.md

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'satset';

/**
 * @typedef {Object} Personal
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} fullName      Disimpan terpisah, bukan turunan. Sebagian orang
 *                                  punya satu nama, sebagian punya nama tengah.
 * @property {string} email
 * @property {string} phone         Format E.164, mis. "+6281234567890"
 * @property {string} dateOfBirth   "YYYY-MM-DD" atau ""
 * @property {string} addressLine
 * @property {string} city
 * @property {string} province
 * @property {string} postalCode
 * @property {string} country       Nama negara dalam bahasa Inggris, mis. "Indonesia"
 * @property {string} nationality
 */

/**
 * @typedef {Object} Links
 * @property {string} linkedin
 * @property {string} github
 * @property {string} portfolio
 * @property {string} website
 * URL lengkap dengan skema ("https://..."). ATS sering memvalidasi format URL.
 */

/**
 * @typedef {Object} WorkItem
 * @property {string}      company
 * @property {string}      title
 * @property {string}      location
 * @property {string}      startDate   "YYYY-MM"
 * @property {string|null} endDate     "YYYY-MM", null = masih berjalan
 * @property {boolean}     current     Redundan dengan endDate===null, tapi ATS
 *                                     punya checkbox "I currently work here"
 * @property {string}      description
 */

/**
 * @typedef {Object} EducationItem
 * @property {string}      school
 * @property {string}      degree        mis. "S1", "Bachelor's Degree"
 * @property {string}      fieldOfStudy
 * @property {string}      location
 * @property {string}      startDate     "YYYY-MM"
 * @property {string|null} endDate       "YYYY-MM", null = masih kuliah
 * @property {string}      gpa           String, bukan number. "3.45" dan "3.450"
 *                                       harus terisi persis seperti ditulis user
 */

/**
 * @typedef {Object} LanguageItem
 * @property {string} name
 * @property {'native'|'fluent'|'professional'|'basic'} proficiency
 */

/**
 * @typedef {Object} StoredFile
 * @property {string} name   Nama file asli, mis. "CV_Gi_2026.pdf"
 * @property {string} mime   mis. "application/pdf"
 * @property {number} size   Byte, sebelum base64
 * @property {string} data   base64 tanpa prefix data-URI
 */

/**
 * @typedef {Object} Preferences
 * @property {string}  desiredSalary       Bebas format, mis. "Rp 12.000.000/bulan"
 * @property {string}  noticePeriod        mis. "1 bulan"
 * @property {string}  availableFrom       "YYYY-MM-DD" atau ""
 * @property {string}  workAuthorization   mis. "WNI"
 * @property {boolean} requiresSponsorship
 * @property {boolean} willingToRelocate
 */

/** @returns {object} profil kosong yang valid */
export function emptyProfile() {
  return {
    personal: {
      firstName: '', lastName: '', fullName: '', email: '', phone: '',
      dateOfBirth: '', addressLine: '', city: '', province: '',
      postalCode: '', country: '', nationality: '',
    },
    links: { linkedin: '', github: '', portfolio: '', website: '' },
    work: [],        // WorkItem[],      urut terbaru dulu
    education: [],   // EducationItem[], urut terbaru dulu
    skills: [],      // string[]
    languages: [],   // LanguageItem[]
    documents: { resume: null, coverLetter: null },  // StoredFile | null
    preferences: {
      desiredSalary: '', noticePeriod: '', availableFrom: '',
      workAuthorization: '', requiresSponsorship: false,
      willingToRelocate: false,
    },
    updatedAt: '',   // ISO 8601, diisi saat simpan
  };
}

export function defaultSettings() {
  return {
    overwriteFilled: false,  // true = field yang sudah ada isinya ikut ditimpa
    autoDetect: true,        // set badge saat form terdeteksi
    highlightColor: '#22c55e',
  };
}

/**
 * Migrasi berurutan dari versi tersimpan ke SCHEMA_VERSION.
 * Tambah entri tiap kali SCHEMA_VERSION naik; kunci = versi ASAL.
 * @type {Record<number, (data: object) => object>}
 */
const MIGRATIONS = {
  // 1: (data) => { ...ubah bentuk...; return data; },   // 1 -> 2
};

/**
 * @param {object|undefined} stored isi chrome.storage.local[STORAGE_KEY]
 * @returns {{schemaVersion: number, profile: object, settings: object}}
 * @throws {Error} kalau data berasal dari versi extension yang lebih baru
 */
export function migrate(stored) {
  if (!stored) {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: emptyProfile(),
      settings: defaultSettings(),
    };
  }

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

  return {
    schemaVersion: SCHEMA_VERSION,
    profile: fillDefaults(emptyProfile(), data.profile),
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
