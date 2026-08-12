# Rules

Dimuat otomatis tiap sesi lewat `CLAUDE.md`. Berlaku juga setelah conversation di-compact.

---

## Code

- Write clean, readable code
- CI/CD-ready — no broken builds, no debug artifacts
- Edit step by step, one change at a time — never bulk-edit everything at once
- **Never push to GitHub** — let me push manually

## Commit Messages

Format: `type: short description`

| Type | Kapan |
|---|---|
| `feat` | fitur baru |
| `fix` | bug fix |
| `refactor` | restruktur tanpa ubah behavior |
| `style` | visual/CSS only |
| `chore` | config, deps, non-code |
| `docs` | dokumentasi |
| `perf` | optimasi performa |

**Rules:**

- Lowercase semua
- Jangan pakai em dash (`-` saja kalau perlu)
- Imperative tense: `add` bukan `added`, `fix` bukan `fixed`
- Scope opsional: `feat(auth): add token refresh`
- Breaking change: `feat!: replace ticker with SSE marquee`
- Pendek dan padat — **no `Co-authored-by`**

**Contoh:**

```
feat: add stock marquee with SSE real-time prices
fix: dark mode border-radius mismatch
refactor: extract board detection to separate function
style: reduce green glow intensity in dark mode
chore: update server port in env config
perf: debounce stock search input to 300ms
```

---

## UI/UX

### Konsistensi

- Keep the style consistent
- Stay consistent across screens

### Warna

- Avoid pure black and pure white
- Avoid pure/fully saturated colors in the UI
- Limit color saturation, especially in dark mode
- Fewer colors, better design
- Add contrast with an overlay to make text visible on images

### Tipografi & Teks

- Choose simple, familiar, readable fonts
- Prioritize important information
- If text runs 4 or more lines, align it
- Add a "read more" button for long text

### Layout & Spacing

- Use horizontal alignment in forms
- Adjust spacing so related groups feel connected
- Use consistent gaps to enhance interface grids
- Decrease the shape (radius) of the inner element for a better nested look

### Form & Input

- Limit the number of fields in a form
- Use boxes in form fields, not underlines
- Don't use placeholders as labels in text fields
- Use input masks to guide users
- Align fields with the type of information being asked
- Radio buttons for single choice, checkboxes for multiple
- Display all options when the user picks from only 2–3 values
- Use toggle tokens for large lists
- Use sliders in filters to speed up the process
- Use placeholders as hints in the search bar
- Let users both type a search and scroll the results

### Button & CTA

- Make clickable elements look clickable
- One primary button per action
- Make button text clear and actionable
- Use words that push users to act
- Use icons **with** labels to give context
- Design thumb-friendly tap areas
- Keep the CTA near the thumb area

### Feedback & State

- Use skeleton loading instead of classic spinners
- Show the progress of a process
