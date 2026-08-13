# Changelog

All notable changes to PDFedits are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) — during v1, expect `0.1.x` patch releases for fixes and small additions, with `0.x.0` reserved for larger feature drops.

## [0.1.3] — 2026-08-13

### Fixed
- **White screen crash when resizing existing-text edits.** The new width-drag handle from 0.1.2 was nested *inside* the contentEditable text box, alongside its live text content. Typing there causes the browser to mutate the DOM directly, and the next React re-render (e.g. while dragging the handle) could then conflict with that mutated DOM and throw an uncaught error — which blanks the entire app with no way to recover except restarting. The handle is now a separate sibling element positioned next to the text box instead of nested inside it, which avoids the conflict entirely. If you hit a white screen on 0.1.2, this is that bug — please update.

## [0.1.2] — 2026-08-13

### Fixed
- **No way to control text box width (one line vs. wrapped).** Both the existing-text edit box and every placed text/image/signature/erase element now have a drag handle — a right-edge grip while actively editing existing text, and a corner grip when any element is selected. Drag wider to force one line, narrower to wrap to 2–3 lines.
- **Clicking a placed element didn't always show its properties.** Previously, clicking an already-placed text/image/signature only selected it while the Select tool was active — clicking it with Text, Image, or Signature still active would silently stack a new element on top instead. Any click on an existing element now always selects it (or, with the Erase tool active, deletes it), regardless of which tool is currently on.

### Known limitation, not a bug (see below)
- Original PDF font family still can't be reproduced exactly — this is now written up in the README's "On font matching" section with the specific technical reason (font subsetting), rather than left as an open question.

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
