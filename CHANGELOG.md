# Changelog

All notable changes to PDFedits are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) — during v1, expect `0.1.x` patch releases for fixes and small additions, with `0.x.0` reserved for larger feature drops.

## [0.1.1] — 2026-08-12

### Fixed
- **`.pdfedits` project files failing to reopen.** Save/open now go through Tauri's native dialog + filesystem plugins instead of a browser-style download link, which didn't reliably work inside the Tauri webview (especially on Linux/WebKitGTK). Added the `capabilities/default.json` permission grant this requires.
- **Properties panel not appearing after editing existing PDF text.** The newly edited text is now auto-selected the moment you finish typing, so font/color/style controls show immediately.
- **Edited text sometimes looking like a totally different font.** Font detection now also guesses bold/italic (not just serif/sans/mono) from the original text's font name, and the properties panel lets you correct the guess by hand if it's ever wrong.

### Added
- **Erase tool improvements:** adjustable Width/Thickness sliders while the tool is active; clicking your own added text/image/signature now deletes it directly instead of patching over it, while clicking original PDF content still patches it.
- **Reset edits** — clears every edit on the current PDF back to the original, with a confirmation prompt.
- **Close PDF** — closes the current document, prompting first if there are unsaved edits.
- Bold/Italic toggles in the text properties panel.

## [0.1.0] — 2026-08-11

Initial scaffold.

### Added
- Tauri v2 + React + TypeScript desktop shell (Windows/macOS/Linux)
- Open, view, scroll, and zoom PDFs (`pdf.js` rendering)
- **Edit existing PDF text in place** — click any text run to retype it; original is patched out, new text drawn in its place (`pdf-lib`)
- Add text boxes, images (PNG/JPG), and hand-drawn e-signatures
- Erase tool (opaque patch over existing content)
- Undo/redo, keyboard shortcuts (tool switching, delete, escape)
- Page thumbnail strip for multi-page navigation
- Drag-and-drop to open a PDF or project file
- Save project (`.pdfedits`) to resume editing later
- Export as edited PDF, PNG, or JPG
- Distinctive editor UI (ink/paper/amber palette, Fraunces/Manrope/IBM Plex Mono type, scroll-position "page gauge")
