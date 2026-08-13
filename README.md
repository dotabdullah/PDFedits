# PDFedits — Offline PDF Editor

**Current version: v0.1.1** — see [CHANGELOG.md](./CHANGELOG.md) for release history.

Free, offline, desktop PDF editor. Tauri + React + TypeScript frontend, `pdf.js` for rendering and reading existing text, `pdf-lib` for writing edits back into the PDF.

## What it does

- Open a PDF, view/scroll/zoom pages, jump between pages via a thumbnail strip
- **Edit existing PDF text in place** — click any text on the page (Select tool) and retype it; font family, bold, and italic are auto-detected from the original text and can be corrected in the properties panel if the guess is off
- Add new text boxes (font size, family, bold/italic, color) — click to place, click to edit
- Add images (PNG/JPG) — click to place, drag to reposition, resize via panel
- Add a hand-drawn e-signature (canvas pad) — click to place on the page
- **Erase tool** — click your own added text/image/signature to delete it outright; click over original PDF content to patch it with an opaque rectangle. Width and thickness are adjustable while the tool is active.
- **Reset edits** — clears every edit on the current PDF back to the original, in one click (with a confirmation)
- **Close** — closes the current PDF (prompts if you have unsaved edits)
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z) for add/delete/text-edit actions
- Keyboard shortcuts: `V` select, `T` text, `I` image, `S` signature, `E` erase, `Delete` removes the selected element, `Esc` deselects
- Drag-and-drop a PDF (or a saved project) straight onto the window to open it
- **Save/open project (`.pdfedits`)** — bundles the original PDF + all your edits into one file, using native OS save/open dialogs, so you can close the app and resume editing later
- Export as: edited PDF (all pages, all edits flattened), or PNG/JPG (current page)

## How editing existing text works

pdf.js exposes each run of real text on a page (string, position, and an internal font identifier that usually still carries the subset tag + real font name, e.g. `g_d0_f1+ArialMT-Bold`). v1 uses that to place an invisible click target over every text run. Click one and it becomes directly editable; on blur, if you changed it, the app:

1. Samples the page's background color right next to that text, so the patch blends in
2. Draws an opaque patch over the original run's exact bounding box
3. Draws your new text in the same position, using an embedded standard font whose family/weight/style (serif vs. sans vs. mono, bold, italic) is guessed from that font identifier

This mirrors how lightweight PDF editors like PDFaid handle text edits — patch-and-replace, rather than rewriting the PDF's internal content stream (fragile across the huge variety of PDF producers, and would need a full content-stream + embedded-font-program parser to do reliably).

**On font matching:** the app does not extract and re-embed the PDF's actual embedded font program — only 12 standard PDF fonts (Helvetica/Times/Courier × regular/bold/italic/bold-italic) are used as replacements. The bold/italic/family guess is usually right for body text, but an unusual or heavily custom font won't be reproduced pixel-for-pixel. If the auto-detected style ever looks wrong, the newly edited text becomes a normal, reselectable text element — click it again and correct the font/bold/italic/color from the properties panel on the right.

## Project structure

```
pdf-editor/
├── src/                     # React frontend
│   ├── components/
│   │   ├── Toolbar.tsx      # icon rail + top bar (open/close/undo/reset/zoom/export + erase size controls)
│   │   ├── PdfCanvas.tsx    # pdf.js render + overlay elements + existing-text edit layer + page gauge
│   │   ├── ThumbnailStrip.tsx
│   │   ├── SidePanel.tsx    # contextual properties (font, bold/italic, color, position)
│   │   └── SignaturePad.tsx
│   ├── lib/
│   │   ├── pdfEngine.ts     # render, text/font extraction, flatten/export (pdf-lib), base64 helpers
│   │   ├── nativeIO.ts      # Tauri dialog + fs wrappers (native save/open), with browser-download fallback
│   │   └── types.ts
│   ├── styles/global.css    # design tokens
│   └── App.tsx              # state, undo/redo history, shortcuts, drag-drop, project save/load
├── src-tauri/                # Rust shell (Tauri v2)
│   ├── src/main.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json   # grants the dialog + fs permissions the app needs
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

Earlier builds saved/opened `.pdfedits` files via a browser-style `<a download>` link and `<input type="file">`. That's unreliable inside a Tauri webview — WebKitGTK on Linux in particular doesn't consistently support triggered downloads, which is why reopening a saved project could silently fail. This is now fixed: save and open both go through Tauri's native dialog + filesystem plugins (`@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`), which is why `src-tauri/capabilities/default.json` grants those permissions. Running via plain `npm run dev` (no Rust shell) falls back to the old browser download for save, and file operations for "Open project" won't work at all outside the Tauri shell — use `npm run tauri dev` for anything file-related.

If you ever see a permission-denied style error on save/open, it's almost always the capabilities file — check `src-tauri/capabilities/default.json` against the Tauri v2 filesystem/dialog permission docs (v2.tauri.app/plugin/file-system), since exact permission identifiers have shifted between Tauri versions.

## Known limitations (by design, not bugs)

- Dragging/resizing an element isn't tracked in undo history (only add/delete/text-edit are) — flooding the history stack on every mouse-move wasn't worth it for v1
- Replacement text uses the 12 standard PDF fonts, not the document's original embedded font program (see "On font matching" above)
- Text color on edited existing text defaults to near-black; pdf.js's text layer doesn't reliably expose the original fill color
- Background-color sampling for patches is a single-pixel sample, so it can miss gradients or busy backgrounds
- The erase tool's "click to delete your own element" hit-tests the topmost element at that point — if two of your elements overlap, it deletes whichever is on top (most recently added)

## Roadmap

- Multi-select, copy/paste, and duplicate for overlay elements
- Page thumbnail drag-to-reorder / delete / rotate pages
- Custom font embedding (load a .ttf via pdf-lib's `embedFont` + fontkit) for closer visual matches, and — as a stretch goal — extracting/re-embedding the PDF's actual font program for exact matches
- Track drag/resize in undo history with debounced snapshots instead of per-move
- PDF merge/split, watermarking, password protection
