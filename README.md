# PDFedits — Offline PDF Editor

**Current version: v0.1.4** — see [CHANGELOG.md](./CHANGELOG.md) for full release history. This README and the changelog are updated with every release.

Free, offline, desktop PDF editor. Tauri + React + TypeScript frontend, `pdf.js` for rendering and reading existing text, `pdf-lib` for writing edits back into the PDF.

## What it does

- Open a PDF, view/scroll/zoom pages, jump between pages via a thumbnail strip
- **Edit existing PDF text in place** — click any text on the page (Select tool) and retype it; drag the width handle to force one line or let it wrap to 2–3; font family, bold, and italic are auto-detected from the original text and can be corrected in the properties panel if the guess is off
- Add new text boxes (font size, family, bold/italic, color) — click to place, click to edit
- Add images (PNG/JPG) — click to place, drag to reposition, resize via the corner handle or the width/height fields in the properties panel
- Add a hand-drawn e-signature (canvas pad) — click to place, drag/resize the same as images
- **Every placed element** (text, image, signature, erase patch) is selectable and shows its properties on the right — click it any time, in any tool, to reselect it. A **hand cursor** (grab/grabbing) shows what's draggable.
- **Erase tool** — click your own added text/image/signature to delete it outright; click over original PDF content to patch it with an opaque rectangle. Width and thickness are adjustable while the tool is active.
- **Reset edits** — clears every edit on the current PDF back to the original, in one click (with a confirmation)
- **Close** — closes the current PDF (prompts if you have unsaved edits)
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z) for add/delete/text-edit actions
- Keyboard shortcuts: `V` select, `T` text, `I` image, `S` signature, `E` erase, `Delete` removes the selected element, `Esc` deselects
- Drag-and-drop a PDF (or a saved project) straight onto the window to open it
- **Save vs. Save As** — "Save" reuses the location from your last save this session; "Save As…" always prompts and remembers the new location for next time. Applies to both the edited PDF and the project file.
- **Save/open project (`.pdfedits`)** — bundles the original PDF + all your edits into one file, using native OS save/open dialogs, so you can close the app and resume editing later
- Export as: edited PDF (all pages, all edits flattened), or PNG/JPG (current page)

## How editing existing text works

pdf.js exposes each run of real text on a page (string, position, and an internal font identifier that usually still carries the subset tag + real font name, e.g. `g_d0_f1+ArialMT-Bold`). The app uses that to place an invisible click target over every text run. Click one and it becomes directly editable, with a drag handle on the right edge to control line width; on blur, if you changed it, the app:

1. Samples the page's background color right next to that text, so the patch blends in
2. Draws an opaque patch over the original run's bounding box (at the width you left it)
3. Draws your new text in the same position, using an embedded standard font whose family/weight/style (serif vs. sans vs. mono, bold, italic) is guessed from that font identifier

This mirrors how lightweight PDF editors like PDFaid handle text edits — patch-and-replace, rather than rewriting the PDF's internal content stream (fragile across the huge variety of PDF producers, and would need a full content-stream + embedded-font-program parser to do reliably).

**On font matching:** the app does not extract and re-embed the PDF's actual embedded font program — only 12 standard PDF fonts (Helvetica/Times/Courier × regular/bold/italic/bold-italic) are used as replacements. This was investigated and deliberately not built, for a concrete reason: PDF producers almost always **subset** embedded fonts, meaning the embedded font file only contains the glyphs actually used in the original document. If we extracted and re-embedded that exact font, typing any character that wasn't already present somewhere in the original PDF (a digit, a punctuation mark, a whole new word) would either fail to render or crash the export. A robust fix needs per-character fallback logic (use the real font when it has the glyph, fall back to a standard font when it doesn't), which is real engineering, not a quick patch — it's on the roadmap below rather than shipped half-working. In the meantime, family/bold/italic are auto-detected from the original text's font name and are usually right for body text; when they're not, click the edited text and correct them from the properties panel on the right.

## Project structure

```
pdf-editor/
├── src/                     # React frontend
│   ├── components/
│   │   ├── Toolbar.tsx      # icon rail + top bar (open/close/undo/reset/zoom/save+save-as + erase size controls)
│   │   ├── PdfCanvas.tsx    # pdf.js render + overlay elements + resize handles + existing-text edit layer + page gauge
│   │   ├── ThumbnailStrip.tsx
│   │   ├── SidePanel.tsx    # contextual properties (font, bold/italic, color, position, size)
│   │   └── SignaturePad.tsx
│   ├── lib/
│   │   ├── pdfEngine.ts     # render, text/font extraction, flatten/export (pdf-lib), base64 helpers
│   │   ├── nativeIO.ts      # Tauri dialog + fs wrappers (Save vs Save As, native open), browser-download fallback
│   │   └── types.ts
│   ├── styles/global.css    # design tokens
│   └── App.tsx              # state, undo/redo history, shortcuts, drag-drop, project save/load
├── src-tauri/                # Rust shell (Tauri v2)
│   ├── src/main.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json   # grants the dialog + fs permissions the app needs (broad scope — see below)
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

Save and open both go through Tauri's native dialog + filesystem plugins (`@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`) rather than browser-style downloads, which don't work reliably inside a Tauri webview. This requires `src-tauri/capabilities/default.json` to grant the right permissions — as of 0.1.4 that scope is intentionally broad (`**`, meaning "anywhere"), after narrower per-folder scoping turned out to be the likely cause of "Couldn't open project file" errors on files saved outside Documents/Downloads/Home. If a save or open ever fails now, the error dialog shows the actual underlying error message (not a generic one), which makes it possible to diagnose if something's still wrong.

Running via plain `npm run dev` (no Rust shell) falls back to the old browser download for save, and "Open project"/"Open PDF" fall back to a standard `<input type="file">` picker — fine for UI iteration, but use `npm run tauri dev` for the real Save/Save As/Open behavior described above.

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
- Error boundary around the editor so a future unexpected crash shows a recoverable error screen instead of a blank white window
