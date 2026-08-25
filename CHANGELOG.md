# Changelog

All notable changes to PDFedits are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) — during v1, expect `0.1.x` patch releases for fixes and small additions, with `0.x.0` reserved for larger feature drops.

## [0.5.3] — 2026-08-25

Documentation reorganization — no code changes.

### Changed
- **README.md rewritten** as a lean, consumer-facing page: badges (version, platform, price, offline, downloads), download links, a short feature highlight list, and a minimal CTA at the end. No more setup instructions in the README — the app ships as prebuilt installers via GitHub Releases, so build-from-source steps belong in CLAUDE.md (for contributors) rather than the main README (for end users).
- **New FEATURES.md** — holds everything the README used to carry: the detailed Phase 1/2 feature-status tables, "On font matching"/"On non-Latin text" explanations, known limitations, and the roadmap. This remains the authoritative source of truth for what's built vs. queued; CLAUDE.md's guidance on keeping documentation accurate now points here instead of README.md.
- CLAUDE.md updated to reflect the new file split.

### Note on badges
The GitHub-hosted badges (release version, downloads) use a placeholder repo path (`xpertswp/pdfedits-studio`) since the actual repository URL wasn't available when this was written — update the badge URLs in README.md if the real path differs. No LICENSE file exists yet either; the README states "Free to use — © XpertsWP" rather than asserting specific open-source license terms that haven't been decided.

## [0.5.2] — 2026-08-22

Fixes Save, Save As, and Print appearing to do nothing when clicked.

### Fixed
- **Save / Save As / Print silently failing.** Root cause was two-fold:
  1. In all three handlers, the step that actually builds the exported PDF bytes was called *outside* its try/catch block. If that step threw for any reason, the error was silently swallowed — no dialog, no console-visible feedback from the user's perspective, the button just appeared dead. All three (plus PNG/JPG export, which had the same pattern) now wrap the entire operation in a single try/catch, so any failure now shows an actual error message instead of doing nothing.
  2. The thing actually throwing: any text containing characters outside WinAnsi encoding — Arabic/Urdu script, most emoji, several typographic symbols — crashes `pdf-lib`'s standard-font text drawing outright. This is a near-certain real-world case, not an edge case, for anyone typing non-Latin text into a text box or note. Export now substitutes unsupported characters with `?` instead of failing the whole export, and shows a clear one-time note afterward telling you that happened (rather than silently mangling your text with no explanation). Verified with a live Node.js reproduction of the exact failure before and after the fix — the "before" case reliably threw `WinAnsi cannot encode "ا" (0x0627)`.

### Known limitation (unchanged, now surfaced honestly instead of crashing)
Non-Latin scripts (Arabic, Urdu, and similar) still aren't genuinely supported in exported PDF text — proper rendering needs both a font with those glyphs *and* right-to-left text shaping (correctly joining/reordering letters), which `pdf-lib`'s basic text drawing doesn't do. Full support is a real feature, not a quick fix; this release stops it from crashing the export and makes the limitation visible instead of silent. See the README's new "On non-Latin text" note.

## [0.5.1] — 2026-08-21

Company branding in the About panel.

### Added
- About modal now shows the developer credit: **XpertsWP**, logo + clickable link to [xpertswp.com](https://xpertswp.com/)
- WhatsApp contact link, pre-filled with "I need help about PDFedits application.." so a tap goes straight to a support conversation
- Clickable support email (`support@xpertswp.com`, opens the user's default mail client)
- Logo bundled locally at `public/branding/xpertswp-logo.webp` — consistent with the rest of the app's zero-CDN-dependency approach (see 0.3.1)

## [0.5.0] — 2026-08-19

Multiple open documents, recent documents, and printing — the last items from the original feature request — plus a `CLAUDE.md` project guide for future agentic sessions (Claude Code/Cowork) working on this codebase.

### Added
- **CLAUDE.md** — architecture overview, the overlay-based-editing rationale, the coordinate system, file-by-file responsibilities, conventions (undo/redo, the double-stopPropagation click pattern, the "verify pdf-lib assumptions with a live Node script" habit), and known gaps. Read this first if you're an agent picking up this repo.
- **Multiple open documents** — a tab bar under the header. Opening a PDF while one is already open creates a new tab rather than replacing it; each tab keeps its own elements, undo/redo history, zoom, and view mode independently. Implemented as a "snapshot on switch" model — the active tab's live state is the source of truth; switching tabs snapshots it into a lightweight record and reloads the target tab's record — rather than keeping every tab's `pdf.js` document loaded simultaneously, to keep memory use reasonable with several tabs open.
- **Recent documents** — the last 15 opened PDFs/projects, shown on the empty-state screen, stored in a small JSON file in the app's own data directory (not visible-file-picker history — see below for why). Handles the file having moved or been deleted gracefully: offers to remove it from the list rather than failing silently.
- **Printing** — no custom print pipeline. Exports current edits to a temp PDF and opens it with the OS's default PDF viewer, so page range/copies/printer selection all come from a viewer that already does this well. Uses the new `@tauri-apps/plugin-shell` dependency (`shell:allow-open` permission, scoped to opening — not arbitrary command execution).

### Notes
- Recent documents storage was chosen over relying on OS-level "recent files" integration (e.g. Windows Jump Lists, macOS recent items) because that requires deeper per-platform native integration than the current Tauri setup does — this is a simpler, cross-platform, in-app equivalent. Might be worth revisiting for closer OS integration later.
- Switching away from a tab does not keep its `pdf.js` document instance loaded — reopening it re-parses from the stored bytes. This trades a small perf cost on tab-switch for materially lower memory use with multiple tabs open, which seemed like the right tradeoff for a desktop app.

## [0.4.1] — 2026-08-18

Continuous scroll and freehand drawing — the two items deliberately held back from 0.4.0 for being architecturally bigger and riskier than everything else on the list. Both are additive: single-page mode is still the default and works exactly as before.

### Added
- **Continuous scroll** — a new view-mode toggle in the tools bar switches between single-page view (default) and a scrollable stack of every page. Pages lazily render as they scroll near the viewport (via IntersectionObserver, ~800px look-ahead) rather than all rendering at once, so this stays reasonable on longer documents. Navigation — Pages panel clicks, go-to-page, First/Last, search results — all scroll the target page into view in continuous mode.
- **Freehand pencil drawing** — click-drag to draw; strokes are selectable, movable, resizable (the whole stroke scales with its bounding box), and colorable/adjustable-thickness from the Properties panel, same as every other element.

### Scoping notes (read before relying on these)
- **Continuous scroll does not auto-update "current page" as you scroll.** This was a deliberate choice: wiring scroll position back to `currentPage` needs IntersectionObserver-based tracking with real feedback-loop risk against the "scroll to page on navigation" behavior, for a feature whose main value (seeing many pages at once) doesn't actually depend on that tracking. The Pages panel won't highlight the page you're currently looking at while free-scrolling — only explicit navigation updates it. May revisit if this turns out to matter more than expected.
- **Fit Page zoom mode falls back to Fit Width's math in continuous mode** — "fit the current page to the viewport height" doesn't have a clean meaning when several pages are visible in a column at once.
- Very long documents (hundreds of pages) haven't been performance-tested against continuous mode — the lazy-render approach should hold up reasonably, but this wasn't validated against a large real-world PDF.

## [0.4.0] — 2026-08-16

Full page management and dedicated annotation tools. Continuous scroll and freehand drawing — the two riskiest, most architecturally different items from the original request — are deliberately not in this release; see "Not in this release" below for why, and 0.4.1 for when.

### Added — Page management
- **Add blank page** — from the Pages panel footer or per-thumbnail "+" button
- **Duplicate page** — including duplicating any edits already made on it, so what you see is what gets copied
- **Insert pages from another PDF** — opens a second PDF and inserts all its pages after the current one
- **Extract selected pages** — multi-select mode in the Pages panel (checkboxes), exports just those pages as a new PDF; doesn't touch the document you're currently editing
- **Reorder pages** — drag thumbnails in the Pages panel
- **Rotate page** — 90° per click, cumulative. This was deliberately held back in earlier releases because rotating a page out from under existing edits on it, without remapping their coordinates, would silently misplace them. That remapping is now implemented (verified against a live pdf-lib round-trip, not just reasoned about) — edits on a rotated page move and resize correctly along with it.

All of the above correctly shift the page index of every existing edit elsewhere in the document, so nothing ends up attached to the wrong page after a structural change.

### Added — Annotations
- **Highlight** tool — click an existing line of text to highlight exactly that run, or click-drag anywhere (including over images) for a freeform semi-transparent highlight
- **Underline** and **Strikethrough** annotation marks — same click-existing-text-or-drag interaction as Highlight. These are separate from the bold/italic/underline text-formatting properties on text you've added yourself; these are markup layered on top of existing or placed content.
- **Sticky notes** — click to place a small colored marker; write the comment in the Properties panel. Exported as a small marker + the comment text drawn permanently onto the page (not a real interactive PDF comment object — see README's "On sticky notes" note for why that's a deliberate simplification, not an oversight).

### Not in this release (queued, 0.4.1)
- **Continuous scroll** — still single-page view. This is the single biggest architectural item on the whole list: it means rendering every page in the document at once in a scrollable column instead of one page at a time, which touches how the canvas, overlay elements, and existing-text editing all work. Doing it properly (including keeping it performant on long documents) deserves its own release rather than being squeezed in alongside everything else here.
- **Freehand pencil drawing** — a genuinely different interaction model (continuous path capture) from the click/click-drag tools built so far.

## [0.3.1] — 2026-08-16

Small, focused release: closes the one real gap in the "100% offline" claim.

### Fixed
- **App fonts (Manrope, IBM Plex Mono) were loaded from Google Fonts' CDN on first launch.** They degraded gracefully to system fonts when offline, so nothing broke, but it wasn't a hard zero-network guarantee. Both fonts are now bundled locally in `public/fonts/` and loaded via `@font-face` — the app makes zero network requests at any point now, including first launch. OFL license files for both fonts are included alongside them (`public/fonts/OFL-*.txt`) per their license requirements.

## [0.3.0] — 2026-08-15

First installment of moving Phase-2-labeled features into free Phase 1, per user request. Not everything from the requested feature list is here yet — see the README's updated feature table for exactly what shipped this release vs. what's still queued and for which upcoming version, rather than a single vague "coming soon."

### Added
- **Zoom modes**: Fit Width, Fit Page, Actual Size (100%), plus the existing +/- step zoom, in a dropdown in the tools bar
- **Page navigation**: First page / Last page buttons, and a "go to page" number field
- **Search improvements**: Next/Previous match navigation with a "3 of 12" counter, case-sensitive and whole-word toggles, and the active match is now highlighted directly on the page (not just page-jump)
- **Object rotation** — a rotation slider (0–359°) for text, images, signatures, rectangles, and ellipses in the Properties panel (not lines — their diagonal direction already covers this)
- **Object layering** — Bring to Front / Send to Back buttons
- **Copy / Cut / Paste / Duplicate** for any selected element, with Ctrl+C/X/V/D shortcuts — paste drops the element on whichever page you're currently viewing
- **Text underline** and **text alignment** (left/center/right), alongside the existing bold/italic

### Known approximation
- Text alignment for **wrapped multi-line** text is computed against the single-line text width, not per-wrapped-line — center/right alignment is exact for text that fits on one line, and approximate once it wraps. Documented in the README.

## [0.2.0] — 2026-08-14

A full visual and structural redesign, adopting a cleaner "Studio" layout (inspired by a reference design) in place of the earlier dark ink/amber theme. This is a minor version bump (not a patch) because it changes the whole UI shell, not just fixes — some things you're used to have moved.

### Changed
- **Complete redesign**: light theme (white panels, blue accent, thin line icons via `lucide-react`) replacing the dark ink/amber/serif look from 0.1.x
- **New layout**: two-row header (file actions row + tools row), a persistent left **Pages panel** (was a floating strip that only appeared on hover before), and a bottom status bar — all matching a reference layout the user provided
- **Properties panel** now shows document info (filename, page count, current page) when nothing is selected, instead of a blank empty state
- Rebranded to **PDFedits Studio**

### Added (Phase 1 — free)
- **Hand/Pan tool** — drag to scroll around a zoomed page instead of using scrollbars
- **Shape tools**: Rectangle, Ellipse, and Line — click-drag to draw, with stroke color/width and optional fill, resizable and colorable from the properties panel like any other element
- **Fullscreen toggle**
- **In-document search** — find text across all pages, jump to a match
- **Settings/About panel** with version info
- **Delete page** from the Pages panel (with confirmation); page indices of existing edits on later pages shift down automatically so nothing misaligns

### Roadmap note — Phase 2 (premium, not built yet)
Given the scope of this redesign, this release also draws a clearer line for what's staying free vs. becoming a future paid tier: true content-stream redaction, page rotation (needs careful coordinate remapping so existing edits don't shift — deliberately not rushed), a crop tool, freehand pencil annotation, original-PDF-font embedding, and multi-select/copy-paste are all planned for a Phase 2 premium tier rather than free v1. See the Roadmap section in the README for the full list and reasoning.

## [0.1.4] — 2026-08-13

### Fixed
- **Selecting a placed element — or the properties panel showing up at all — was unreliable.** Root cause: `stopPropagation()` on a `mousedown` event does *not* stop the separate `click` event that follows it from bubbling. Every element's click handler now stops both, so clicking a text/image/signature/erase element always selects it instead of the click leaking through to the canvas and immediately deselecting it (or, worse, placing a duplicate element right on top). This was the real cause behind "no option to see properties of updated text" and "can't resize images" — both symptoms of the same underlying selection bug.
- **Wrapped multi-line text was getting clipped.** Text elements used a fixed height with `overflow: hidden`; if edited text wrapped to 2–3 lines, everything past the first line was invisible. Height is now automatic and content is never clipped.
- **`.pdfedits` project files failing to reopen, even freshly saved ones.** Two changes here: the fs capability scope was narrowed to specific OS folders (Documents/Downloads/Home) in 0.1.1, which is the likely culprit if your file lived somewhere else — it's now maximally permissive (`**`), appropriate for a single-user offline desktop app. Separately, error handling was swallowing the *real* error and always showing the same generic "couldn't open" message regardless of cause — every open/save failure now shows the actual underlying error, so if this happens again the message will actually say why.

### Added
- **Resize handles now work end-to-end** — the click-bubbling bug above was blocking them from being usable even though the code existed since 0.1.2.
- **Hand cursor** on every placed element (`grab` while idle, `grabbing` while dragging) so it's visually obvious what's draggable.
- **Save vs. Save As**, for both the PDF export and the project file: "Save" reuses the location from your last save this session (no dialog); "Save As…" always prompts and remembers the new location for the next quick Save.

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
