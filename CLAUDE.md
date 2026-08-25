# CLAUDE.md

Guidance for Claude (via Claude Code, Cowork, or any other agentic session) working on this repository. Read this before making changes — it covers the architecture, conventions, and gotchas that aren't obvious from the code alone.

## What this is

**PDFedits Studio** — a free, offline, desktop PDF editor. Tauri v2 (Rust shell) + React + TypeScript frontend. `pdf.js` renders pages and reads existing text; `pdf-lib` writes edits back into the PDF at export time. No backend, no accounts, no network calls except font/dependency installs during development.

Current version and full feature status: see [FEATURES.md](./FEATURES.md) (feature status tables) and [CHANGELOG.md](./CHANGELOG.md) (release history). README.md is a lean, consumer-facing page (download links, badges, highlights) — **always check FEATURES.md's tables before assuming something is or isn't built**, it's kept accurate every release. README.md and CLAUDE.md's dev setup section replace what used to be a "Setup" section directly in the README.

## Core architectural decision: overlay-based editing, not content-stream editing

This is the single most important thing to understand. The app does **not** parse or rewrite a PDF's internal content stream. Instead:

- Existing PDF content is rendered as a flat image (`pdf.js` → `<canvas>`).
- Every user edit — new text, images, signatures, shapes, highlights, notes, freehand strokes, and even "edits" to existing text — is stored as a separate `EditorElement` object (see `src/lib/types.ts`) positioned on top of that canvas.
- At export time (`flattenToPdf` in `src/lib/pdfEngine.ts`), every element is drawn onto the real PDF via `pdf-lib`, on top of the original content.
- "Editing existing text" is a patch trick: click an existing text run → retype it → the app draws an opaque rectangle over the original run's bounding box (color-sampled from the background) and draws the new text in the same spot. It is not true in-place text replacement.

**Do not attempt to add real PDF content-stream parsing/editing** (e.g. "just edit the text object directly") without discussing it first — it was deliberately rejected early on because most production PDFs subset their embedded fonts (only the glyphs actually used are embedded), so extracting and reusing the real font breaks the moment someone types a character that wasn't in the original document. See the README's "On font matching" section for the full reasoning. If this is ever revisited, it needs per-glyph fallback logic, not a naive extraction.

Similarly, the erase tool is **visual only** — it patches over content, it does not remove the underlying data. This is called out explicitly in the README's "Known limitations" and should stay that way unless someone explicitly asks for true redaction (a documented Phase 2/premium candidate).

## Coordinate system (read this before touching PdfCanvas or pdfEngine)

Every `EditorElement`'s `x/y/width/height` is stored in **screen pixels at whatever `renderScale` is currently active** — not PDF points, not normalized 0–1 coordinates (the one exception is `FreehandElement.points`, which *are* normalized 0–1 relative to the element's own bbox specifically so resizing scales the stroke for free).

- `renderScale` is a single global value (`zoom` in `App.tsx`), shared across every page and every element in the document.
- `pdfEngine.ts`'s `flattenToPdf` converts screen-px → PDF points by dividing by `renderScale`, and flips the Y axis (screen Y grows down; PDF Y grows up from the bottom of the page).
- This means: if you ever add a feature that changes `renderScale` after elements already exist (e.g. a per-page zoom, or reloading a project at a different scale), existing elements' positions will NOT auto-rescale — they'll visually drift. This is a known latent characteristic of the current design, not something actively guarded against. Be careful here.
- Page rotation (`handleRotatePage` in `App.tsx`) is the one place that already does manual coordinate remapping — it's a good reference for how to reason about this correctly if you need to do something similar. The math was verified with a live Node.js test before shipping (see CHANGELOG 0.4.0) — do the same for any similarly fiddly geometry change.

## Where things live

```
src/
  App.tsx                 — nearly all state and business logic lives here (single large component).
                             History (undo/redo), all file I/O handlers, all element CRUD, keyboard shortcuts.
  lib/
    types.ts              — EditorElement union + all the per-kind interfaces. Start here when adding a new element kind.
    pdfEngine.ts           — render, text/font extraction, search, export (flattenToPdf), page management
                             (add/duplicate/insert/extract/reorder/rotate), base64 helpers. Pure functions, no React.
    nativeIO.ts            — Tauri dialog + fs wrappers (Save vs Save As), with a browser-download fallback for
                             plain `npm run dev` (no Tauri shell). Errors propagate — do not swallow them here;
                             App.tsx's callers show the real error message to the user.
  components/
    PdfCanvas.tsx           — the biggest/most complex file. Top-level `PdfCanvas` owns the shared scroll container
                             and switches between single-page and continuous-scroll layout. `PageBlock` is the
                             actual per-page renderer + interaction handler (canvas, overlay elements, existing-text
                             edit layer, shape/freehand drawing, drag/resize). In continuous mode, one `PageBlock`
                             instance exists per page, each with its own independent local interaction state —
                             this is intentional, not an oversight.
    Toolbar.tsx             — HeaderBar (top row: file actions, search, settings) + ToolsBar (second row: tool
                             icons, page nav, zoom).
    SidePanel.tsx           — Properties panel. One function per element kind (TextProps, ShapeProps, etc.).
    PagesPanel.tsx          — left Pages panel: thumbnails, add/duplicate/rotate/delete, drag-to-reorder, extract-select.
    SignaturePad.tsx, AboutModal.tsx, SearchPanel.tsx, StatusBar.tsx — smaller, self-contained.
  styles/global.css         — all design tokens (colors, spacing, fonts) as CSS custom properties. No other
                             global stylesheet exists; every component's styles are scoped in a <style> tag
                             within that component.
public/fonts/               — bundled Manrope + IBM Plex Mono (OFL-licensed), loaded via @font-face in global.css.
                             No CDN font loading — this was fixed in 0.3.1 specifically to guarantee zero network
                             calls. Don't reintroduce a Google Fonts / CDN link in index.html.
src-tauri/
  capabilities/default.json — Tauri v2 permission grants. Deliberately broad fs scope ("**") — this is a
                             single-user offline desktop app, and narrower per-folder scoping was the cause of a
                             real bug (0.1.4/0.4.0 — "Couldn't open project file" for files outside a couple of
                             default OS folders). Don't narrow this without a good reason.
```

## Conventions to follow

**Undo/redo:** every mutating change to `elements` should go through the `commit()` helper in `App.tsx`, which pushes the previous state onto `pastRef` before applying the change. Live drag/resize updates (`updateElement`) deliberately bypass this — they'd flood the history stack on every mousemove. Only the *start* of a drag and its *committed result* should touch undo history, and currently even the committed result of a drag isn't tracked (documented known limitation). Match this pattern for new mutating actions.

**Click-to-select vs click-to-place:** every interactive element in `PdfCanvas.tsx` calls `e.stopPropagation()` on **both** `onMouseDown` and `onClick`. This is not redundant — stopping propagation on `mousedown` does not stop the separate `click` event that follows it. Forgetting the `onClick` stop was a real shipped bug (see CHANGELOG 0.4.0 — "properties panel not showing / duplicate elements") caused by exactly this. If you add a new interactive overlay element, it needs both.

**Adding a new element kind** (e.g. a new annotation type) touches, in order:
1. `types.ts` — new interface extending `BaseElement`, add to the `EditorElement` union.
2. `pdfEngine.ts` — add an `else if (el.kind === "...")` branch in `flattenToPdf`.
3. `PdfCanvas.tsx` — add rendering in `OverlayElement`, and wire whatever interaction creates it (click-to-place like `note`, click-drag like the shape tools, or click-on-existing-text like the mark tools).
4. `SidePanel.tsx` — add a `*Props` component for its property panel, and a line in the main `SidePanel` function's conditional rendering.
5. `Toolbar.tsx` — add to the `TOOLS` array if it's a distinct tool (icon from `lucide-react`).
6. `App.tsx` — add a keyboard shortcut letter to the `shortcuts` map if appropriate (check for collisions first — see the full current map before picking a letter).
7. Update the PNG/JPG export path in `App.tsx`'s `handleExportImage` (separate from `flattenToPdf`, since PNG/JPG export composites onto a `<canvas>` via 2D context calls, not `pdf-lib`) — easy to forget this second export path exists.

**Verify pdf-lib API assumptions before shipping.** Several past changes were verified by writing a throwaway Node.js script that actually calls the `pdf-lib` API against a real in-memory PDF, rather than trusting type definitions or reasoning alone (e.g. the page-rotation coordinate remap in 0.4.0, the page-duplication-within-same-document pattern, freehand normalization edge cases in 0.4.1). Do this for anything touching `pdf-lib`'s lower-level APIs or any new geometry math — it's cheap and has caught real issues.

**Every release gets a CHANGELOG.md entry**, including version bumps in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and the `APP_VERSION` constant in `App.tsx` (shown in the About modal). Keep FEATURES.md's feature-status tables accurate — that's the authoritative source of truth for what's built vs. queued, not a marketing feature list; README.md only needs updating for its own highlights/badges when something release-worthy changes. If something is deliberately simplified or has a known gap, say so explicitly in both the CHANGELOG entry and FEATURES.md — this project's documentation style favors "here's exactly what's true and why" over vague feature claims.

## Build/verify commands

```bash
npm install
npx tsc --noEmit          # must be clean before considering a change done
npm run build              # full Vite build; must succeed
npm run tauri dev          # real native window — required to test Tauri-specific features
                            # (native save/open dialogs, filesystem access, printing)
```

`npm run dev` (no `tauri` prefix) runs a plain browser preview with no Rust shell — file save/open falls back to browser download / `<input type="file">`, and any Tauri-plugin-only feature (native dialogs, filesystem, shell) won't work at all. Don't rely on this mode to validate anything Tauri-specific.

## Known gaps worth knowing about before extending nearby code

- Dragging/resizing an element isn't in undo history (only add/delete/text-edit commits are).
- Continuous scroll doesn't track "current page" from scroll position — only explicit navigation updates it (deliberate, see README).
- Element rotation pivots around the bottom-left corner, not the visual center (deliberate, keeps editor preview and exported PDF pixel-consistent — see README "Known limitations").
- No error boundary around the editor — an unexpected React render error currently blanks the whole window. This bit us once already (CHANGELOG 0.4.0 — the width-drag-handle contentEditable crash). Worth adding if you're touching error handling broadly.
