# PDFedits — Offline PDF Editor (v1 scaffold)

Free, offline, desktop PDF editor. Tauri + React + TypeScript frontend, `pdf.js` for rendering and reading existing text, `pdf-lib` for writing edits back into the PDF.

## What v1 does

- Open a PDF, view/scroll/zoom pages, jump between pages via a thumbnail strip
- **Edit existing PDF text in place** — click any text on the page (Select tool) and retype it directly; the original is patched out and your new text is drawn in its exact position
- Add new text boxes (font size, family, color) — click to place, click to edit
- Add images (PNG/JPG) — click to place, drag to reposition, resize via panel
- Add a hand-drawn e-signature (canvas pad) — click to place on the page
- Erase tool — patches over existing content with an opaque rectangle
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z) for add/delete/text-edit actions
- Keyboard shortcuts: `V` select, `T` text, `I` image, `S` signature, `E` erase, `Delete` removes the selected element, `Esc` deselects
- Drag-and-drop a PDF (or a saved project) straight onto the window to open it
- **Save project** — bundles the original PDF + all your edits into a single `.pdfedits` file so you can close the app and resume editing later, without re-doing anything
- Export as: edited PDF (all pages, all edits flattened), or PNG/JPG (current page)

## How editing existing text works

pdf.js exposes each text run on a page (string, position, approximate font). v1 uses that to place an invisible click target over every run of real text. Click one and it becomes directly editable; on blur, if you changed it, the app:

1. Samples the page's background color right next to that text (so the patch blends in, not just plain white)
2. Draws an opaque patch over the original run's exact bounding box
3. Draws your new text in the same position, using an embedded standard font

This mirrors how lightweight PDF editors like PDFaid handle text edits — patch-and-replace, rather than rewriting the PDF's internal content stream (which is fragile across the huge variety of PDF producers and would need a full content-stream parser to do reliably). Font matching is heuristic (serif/mono/sans, guessed from the original font's name) and only the three standard PDF font families are used for replacement text — an exact visual match to unusual fonts isn't guaranteed, but position and size are exact.

## Project structure

```
pdf-editor/
├── src/                     # React frontend
│   ├── components/
│   │   ├── Toolbar.tsx      # icon rail + top bar (open/undo/zoom/export)
│   │   ├── PdfCanvas.tsx    # pdf.js render + overlay elements + existing-text edit layer + page gauge
│   │   ├── ThumbnailStrip.tsx
│   │   ├── SidePanel.tsx    # contextual properties (font, color, position)
│   │   └── SignaturePad.tsx
│   ├── lib/
│   │   ├── pdfEngine.ts     # render, text extraction, flatten/export (pdf-lib), base64 helpers
│   │   └── types.ts
│   ├── styles/global.css    # design tokens
│   └── App.tsx              # state, undo/redo history, shortcuts, drag-drop, project save/load
├── src-tauri/                # Rust shell (Tauri v2)
│   ├── src/main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
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

# 4. Run in dev mode (opens a native window)
npm run tauri dev

# 5. Build an installer for your platform (.msi/.exe on Windows, .dmg/.app on macOS, .deb/.AppImage on Linux)
npm run tauri build
```

Icons in `src-tauri/icons/` are placeholders. Regenerate the full platform icon set (including `.ico`/`.icns`) from a source PNG with:

```bash
npx tauri icon path/to/your-logo.png
```

## Known v1 limitations (by design, not bugs)

- Dragging/resizing an element isn't tracked in undo history (only add/delete/text-edit are) — flooding the history stack on every mouse-move wasn't worth it for v1
- Replacement text uses the 3 standard PDF fonts (sans/serif/mono), not the document's original embedded font
- Text color on edited existing text defaults to near-black; the app can't reliably detect original text color from pdf.js's text layer
- Background-color sampling for patches is a single-pixel sample, so it can miss gradients or busy backgrounds

## Roadmap (post-v1)

- Multi-select, copy/paste, and duplicate for overlay elements
- Page thumbnail drag-to-reorder / delete / rotate pages
- Custom font embedding (load a .ttf via pdf-lib's `embedFont` + fontkit) for closer visual matches on existing-text edits
- Track drag/resize in undo history with debounced snapshots instead of per-move
- PDF merge/split, watermarking, password protection
