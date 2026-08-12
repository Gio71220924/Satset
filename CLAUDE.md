# Satset

Chrome extension MV3 untuk auto-isi form lamaran kerja. Vanilla JS, tanpa build step, tanpa dependency runtime.

@rules.md

## Dokumen

| File | Isi |
|---|---|
| [PRD-JobAutofill-Extension.md](PRD-JobAutofill-Extension.md) | Produk, user story, metrik |
| [TDD.md](TDD.md) | Arsitektur, permission, algoritma matching, keputusan teknis |
| [docs/profile-schema.md](docs/profile-schema.md) | Konvensi skema — definisi resmi ada di `src/schema.js` |
| [docs/field-mapping.md](docs/field-mapping.md) | Selector per ATS — data resmi di `data/*.json` |
| [docs/ux-flows.md](docs/ux-flows.md) | Wireframe popup, options, indikator halaman |
| [docs/test-plan.md](docs/test-plan.md) | Skenario uji manual + otomatis |
| [docs/roadmap.md](docs/roadmap.md) | Milestone M1–M5 |
| [PRIVACY.md](PRIVACY.md) | Kebijakan privasi, wajib sinkron dengan `manifest.json` |

## Perintah

```
node --test        # dari root repo, bukan `node --test src/`
```
