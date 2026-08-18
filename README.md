# PDFedits Studio — Offline PDF Editor

**Current version: v0.4.0** — see [CHANGELOG.md](./CHANGELOG.md) for full release history. This README and the changelog are updated with every release.

Free, offline, desktop PDF editor. Tauri + React + TypeScript frontend, `pdf.js` for rendering and reading existing text, `pdf-lib` for writing edits back into the PDF, `lucide-react` for icons.

## Feature status

The goal is for **all core PDF viewing and editing to be free (Phase 1)**. A few things are intentionally sequenced across releases rather than rushed — some because they're genuinely bigger engineering lifts (see "Why" column), others just haven't been built yet. This table is kept accurate every release so it's always clear what's actually there vs. still coming, rather than a vague feature list.

### Viewing & navigation
| Feature | Status |
|---|---|
| Open PDF, drag & drop, page thumbnails, page nav, zoom in/out | ✅ Shipped |
| Go to specific page, First/Last page | ✅ 0.3.0 |
| Fit Width / Fit Page / Actual Size / custom zoom % | ✅ 0.3.0 |
| Full-screen viewing | ✅ Shipped |
| Search, next/prev navigation + counter, case-sensitive/whole-word, on-page highlight | ✅ 0.3.0 |
| Basic document info | ✅ Shipped |
| Page rotation (viewing) | ✅ **0.4.0** — see Page management below |
| Continuous scrolling (currently single-page view) | 🔜 Queued, 0.4.1 — biggest architectural item on the whole list (renders every page at once instead of one at a time) |
| Multiple PDF tabs / multiple open documents | 🔜 Queued, 0.5.0 |

### Editing
| Feature | Status |
|---|---|
| Add/edit/move/resize/delete text, images | ✅ Shipped |
| Bold, italic, font size/family, text color | ✅ Shipped |
| Underline, text alignment (left/center/right) | ✅ 0.3.0 |
| Rectangles, ellipses, lines | ✅ Shipped |
| Object selection, move, resize | ✅ Shipped |
| Object rotation | ✅ 0.3.0 (all shape/text/image/signature elements; not lines, whose diagonal already covers direction) |
| Object layering (bring to front / send to back) | ✅ 0.3.0 |
| Copy / Cut / Paste / Duplicate | ✅ 0.3.0 — Ctrl+C/X/V/D |
| Basic eraser | ✅ Shipped (visual patch only — see Known limitations) |
| Basic freehand drawing | 🔜 Queued, 0.4.1 — path capture is a different interaction model from the click-drag shape tools |

### Annotations
| Feature | Status |
|---|---|
| Shapes with color | ✅ Shipped |
| Highlight | ✅ **0.4.0** — click an existing line of text to highlight exactly that run, or click-drag anywhere for a freeform highlight |
| Underline / strike-through as dedicated annotation marks (distinct from text-formatting properties) | ✅ **0.4.0** — same click-existing-text-or-drag interaction as Highlight |
| Sticky notes / comments | ✅ **0.4.0** — see "On sticky notes" below for how these actually export |

### Page management
| Feature | Status |
|---|---|
| Delete page | ✅ Shipped |
| Add blank page | ✅ **0.4.0** |
| Duplicate page (including any edits already on it) | ✅ **0.4.0** |
| Insert pages from another PDF | ✅ **0.4.0** |
| Extract selected pages (multi-select, export as new PDF) | ✅ **0.4.0** |
| Reorder pages (drag thumbnails) | ✅ **0.4.0** |
| Rotate page | ✅ **0.4.0** — 90° per click, cumulative. Existing edits on that page are remapped to match (position, size, and their own rotation all update), verified against a live pdf-lib test before shipping rather than just reasoned about. |

### File management
| Feature | Status |
|---|---|
| Open, Save, Save As, Export, Close | ✅ Shipped |
| Native OS file dialogs, file-overwrite confirmation | ✅ Shipped |
| Drag & drop | ✅ Shipped |
| Recent documents | 🔜 Queued, 0.5.0 |

### Undo/redo & shortcuts
| Feature | Status |
|---|---|
| Undo/redo | ✅ Shipped |
| Copy/Paste/Cut/Duplicate | ✅ 0.3.0 |
| Keyboard shortcuts | ✅ Shipped, expanded in 0.3.0 and **0.4.0** |

### Printing
| Feature | Status |
|---|---|
| Print PDF via system dialog | 🔜 Queued, 0.5.0 — planned approach: export current edits to a temp PDF and hand off to the OS's default PDF viewer, so page range/copies/print dialog all come from a viewer that already does this well, rather than us reimplementing a print pipeline |

### Offline
| Feature | Status |
|---|---|
| 100% offline core editing, no account, no cloud | ✅ Shipped |
| Fully offline including first launch | ✅ 0.3.1 — fonts bundled locally in `public/fonts/`, no CDN dependency anywhere in the app |

### Not planned as free (Phase 2 / premium candidates)
These need either real engineering most users won't need day-to-day, or are a natural free/paid line:

| Feature | Why premium |
|---|---|
| True redaction (removes text from the PDF itself) | Current erase is a *visual* patch only — see "Known limitations" |
| Crop tool | New tool surface + mediabox trimming |
| Original-PDF-font embedding | Needs per-glyph fallback logic to be safe — see "On font matching" below |
| PDF merge/split, watermarking, password protection | |

## What it does today

- Open a PDF, view/scroll/zoom/pan pages, jump between pages via the **Pages panel** on the left (with thumbnails and page count)
- **Edit existing PDF text in place** — click any text (Select tool) and retype it; drag the width handle to force one line or let it wrap; font family, bold, and italic are auto-detected from the original text and correctable in the Properties panel
- Add new text boxes (bold/italic/underline/alignment/color), images (PNG/JPG), and hand-drawn e-signatures — click to place, drag to reposition/resize/rotate
- **Draw shapes** — Rectangle, Ellipse, Line — click-drag to size, with stroke color/width and optional fill
- **Annotate** — Highlight, Underline, Strikethrough: click an existing line of text to mark exactly that run, or click-drag anywhere for freeform placement. **Sticky notes** — click to place a marker, write the comment in the Properties panel (see "On sticky notes" below).
- **Pan tool** — drag to scroll around a zoomed page
- **Erase tool** — click your own added element to delete it outright; click over original PDF content to patch it with an opaque rectangle. Width/thickness adjustable while active.
- **Find in document** — next/prev navigation, match counter, case-sensitive/whole-word options, on-page highlight
- **Zoom** — Fit Width, Fit Page, Actual Size, or custom %
- **Object arrange** — rotate, bring to front/send to back, duplicate, copy/cut/paste (Ctrl+C/X/V/D)
- **Page management** — add blank page, duplicate page, insert pages from another PDF, extract selected pages to a new PDF, reorder pages by dragging thumbnails, rotate a page 90° at a time. Every operation correctly shifts or remaps any existing edits so nothing ends up on the wrong page or misaligned after a rotation.
- **Reset edits**, **Close** (with unsaved-changes confirmation), **Fullscreen** toggle
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z) for add/delete/text-edit actions
- Keyboard shortcuts: `V` select, `H` pan, `T` text, `I` image, `S` signature, `R` rectangle, `O` ellipse, `L` line, `G` highlight, `U` underline mark, `K` strikethrough, `N` note, `E` erase, `Ctrl+O` open, `Ctrl+F` search, `Ctrl+C/X/V/D` copy/cut/paste/duplicate, `Delete` removes selection, `Esc` deselects/closes search
- Drag-and-drop a PDF (or a saved project) onto the window to open it
- **Save vs. Save As** — Save reuses the location from your last save this session; Save As always prompts and remembers the new location. Same for the project file.
- **Save/open project (`.pdfedits`)** — bundles the PDF + all edits into one file for resuming later
- Export as edited PDF, or PNG/JPG (current page)

## How editing existing text works

pdf.js exposes each run of real text on a page (string, position, and an internal font identifier that usually still carries the subset tag + real font name, e.g. `g_d0_f1+ArialMT-Bold`). The app places an invisible click target over every text run; click one and it becomes directly editable, with a drag handle to control line width. On blur, if changed, the app samples the background color next to that text, patches over the original run's bounding box, and draws the new text in the same spot using an embedded standard font whose family/weight/style is guessed from that font identifier.

This mirrors how lightweight PDF editors handle text edits — patch-and-replace, rather than rewriting the PDF's internal content stream, which is fragile across the huge variety of PDF producers.

## On sticky notes

Notes are a small colored marker plus whatever text you type into the Properties panel. This is **not** a real interactive PDF comment/annotation object — when exported, the marker and its text are drawn permanently onto the page as regular content, the same way every other element in this app works (text, shapes, highlights — everything gets flattened into visible pixels/vectors at export time, nothing is a separate interactive layer). That means a note's text will show up as small permanent text on the page in any PDF viewer, not as a hoverable comment bubble like Adobe Acrobat's comment tool. If you need genuine interactive PDF comments, this isn't that yet — it's a lightweight, honest approximation, not a re-implementation of the PDF annotation spec.

**On font matching:** only 12 standard PDF fonts (Helvetica/Times/Courier × regular/bold/italic/bold-italic) are used — not the document's actual embedded font. This is deliberate: PDF producers almost always **subset** embedded fonts (the font file only contains glyphs actually used in the document), so re-embedding the exact original font would fail or crash on any new character you type that wasn't already in the original text. A correct fix needs per-character fallback logic (real font when it has the glyph, standard font when it doesn't) — real engineering, which is why it's a Phase 2 item rather than shipped half-working. Family/bold/italic are auto-detected and usually right for body text; correct them in the Properties panel when they're not.

## Project structure

```
pdf-editor/
├── src/
│   ├── components/
│   │   ├── Toolbar.tsx        # HeaderBar (row 1: file actions, search, settings) + ToolsBar (row 2: tools, page nav, zoom)
│   │   ├── PdfCanvas.tsx      # pdf.js render + overlay elements + resize handles + pan + shape drawing + existing-text edit layer
│   │   ├── PagesPanel.tsx     # left Pages panel (thumbnails, add/duplicate/rotate/delete, drag-reorder, extract-select)
│   │   ├── SidePanel.tsx      # Properties panel (doc info empty state, per-element properties incl. annotations)
│   │   ├── StatusBar.tsx      # bottom status bar
│   │   ├── AboutModal.tsx     # settings/about
│   │   ├── SearchPanel.tsx    # find-in-document dropdown
│   │   └── SignaturePad.tsx
│   ├── lib/
│   │   ├── pdfEngine.ts       # render, text/font extraction, search, flatten/export, page management (add/duplicate/insert/extract/reorder/rotate), base64 helpers
│   │   ├── nativeIO.ts        # Tauri dialog + fs wrappers (Save vs Save As), browser-download fallback
│   │   └── types.ts
│   ├── styles/global.css      # light "Studio" design tokens + local @font-face rules
│   └── App.tsx
├── public/fonts/               # bundled Manrope + IBM Plex Mono (OFL-licensed) — no CDN dependency
├── src-tauri/
│   ├── src/main.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json   # dialog + fs permissions (broad scope — single-user offline desktop app)
└── package.json
```

## Setup

Requires Node.js 18+ and Rust (for the Tauri shell).

```bash
# 1. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.org | sh

# 2. Install Tauri's system dependencies (Linux only — skip on macOS/Windows)
# https://v2.tauri.app/start/prerequisites/
sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential \
  curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# 3. Install JS dependencies
npm install

# 4. Run in dev mode (opens a native window — required for real save/open dialogs)
npm run tauri dev

# 5. Build an installer for your platform (.msi/.exe on Windows, .dmg/.app on macOS, .deb/.AppImage on Linux)
npm run tauri build
```

Icons in `src-tauri/icons/` are placeholders. Regenerate the full platform icon set (including `.ico`/`.icns`) from a source PNG with:

```bash
npx tauri icon path/to/your-logo.png
```

### About project save/open reliability

Save and open both go through Tauri's native dialog + filesystem plugins rather than browser-style downloads, which don't work reliably inside a Tauri webview. `src-tauri/capabilities/default.json` grants broad (`**`) fs scope — appropriate for a single-user offline desktop app, and specifically to avoid "Couldn't open project file" errors on files saved outside a couple of default OS folders. If a save or open ever fails, the error dialog shows the actual underlying error message.

Running via plain `npm run dev` (no Rust shell) falls back to browser download for save, and Open falls back to a standard `<input type="file">` picker — fine for UI iteration, but use `npm run tauri dev` for the real behavior described above.

## Known limitations (Phase 1, by design)

- The erase tool is **visual only** — it draws an opaque patch over content, it does not remove the underlying text from the PDF's internal structure, so the original text is technically still extractable by someone who goes looking. True redaction is a premium-candidate item; don't rely on erase for legally sensitive redaction (SSNs, medical records, etc.) yet.
- Dragging/resizing an element isn't tracked in undo history (only add/delete/text-edit are)
- Replacement text for edited existing text uses the 12 standard PDF fonts, not the document's original embedded font (see "On font matching" above)
- Background-color sampling for patches is a single-pixel sample, so it can miss gradients or busy backgrounds
- The erase tool's "click to delete your own element" hit-tests the topmost element at that point
- Element rotation pivots around the element's bottom-left corner, not its visual center — this was a deliberate choice to keep the editor preview and the exported PDF pixel-consistent with each other, at the cost of "rotate around center" being the more intuitive mental model. Might revisit if it's a common complaint.
- Center/right text alignment is computed against the full text string's width, not per-wrapped-line — exact for text that fits on one line, approximate once it wraps to 2+ lines
- Sticky notes are baked-in text, not real interactive PDF comment objects — see "On sticky notes" above
- Rotating a page remaps the *position, size, and rotation* of edits already on it, but does not re-flow or re-wrap text content to account for the new orientation — a wide text box on a page rotated to portrait will keep its original width rather than adjusting

## Roadmap

**Next up (see feature tables above for the authoritative status):**
- 0.4.1 — continuous scroll (single-page view is still all there is right now), freehand pencil drawing
- 0.5.0 — multiple open documents, recent documents, printing

**Not planned as free** — see the Phase 2 table above: true redaction, crop tool, original-font embedding, PDF merge/split, watermarking, password protection.
