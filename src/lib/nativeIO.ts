import { open, save } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join, tempDir } from "@tauri-apps/api/path";
import { open as shellOpen } from "@tauri-apps/plugin-shell";

export interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * True when running inside the Tauri shell. In plain `npm run dev` (no Rust
 * shell attached) these APIs aren't injected, so callers fall back to
 * browser-native download/upload — good enough for UI iteration, but real
 * save/open reliability is what `npm run tauri dev` gives you.
 */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function downloadInBrowser(blob: Blob, suggestedName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * "Save As" semantics: always opens the native dialog. Returns the chosen
 * path so the caller can remember it for a quick re-save later, or null if
 * the user cancelled (or we're outside Tauri, where there's no path concept
 * — the browser just downloads it and the caller should not treat that as
 * a reusable path).
 *
 * Errors from the underlying dialog/fs calls are intentionally NOT caught
 * here — they propagate to the caller so a real permission/IO error can be
 * shown instead of masked behind a generic message.
 */
export async function saveBinaryFileAs(bytes: Uint8Array, suggestedName: string, filters: FileFilter[]): Promise<string | null> {
  if (isTauriRuntime()) {
    const path = await save({ defaultPath: suggestedName, filters });
    if (!path) return null;
    await writeFile(path, bytes);
    return path;
  }
  downloadInBrowser(new Blob([bytes.slice().buffer]), suggestedName);
  return null;
}

export async function saveTextFileAs(text: string, suggestedName: string, filters: FileFilter[]): Promise<string | null> {
  if (isTauriRuntime()) {
    const path = await save({ defaultPath: suggestedName, filters });
    if (!path) return null;
    await writeTextFile(path, text);
    return path;
  }
  downloadInBrowser(new Blob([text], { type: "application/json" }), suggestedName);
  return null;
}

/** Quick re-save to an already-known path — no dialog. Tauri-only; throws if called outside Tauri. */
export async function writeBinaryToPath(path: string, bytes: Uint8Array): Promise<void> {
  await writeFile(path, bytes);
}

export async function writeTextToPath(path: string, text: string): Promise<void> {
  await writeTextFile(path, text);
}

/** Returns null if the user cancelled, or if not running in Tauri (caller should fall back to an <input type="file">). */
export async function openBinaryFileDialog(filters: FileFilter[]): Promise<{ name: string; path: string; bytes: Uint8Array } | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({ multiple: false, directory: false, filters });
  if (!selected || Array.isArray(selected)) return null;
  const bytes = await readFile(selected);
  return { name: fileNameFromPath(selected), path: selected, bytes };
}

export async function openTextFileDialog(filters: FileFilter[]): Promise<{ name: string; path: string; text: string } | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({ multiple: false, directory: false, filters });
  if (!selected || Array.isArray(selected)) return null;
  const text = await readTextFile(selected);
  return { name: fileNameFromPath(selected), path: selected, text };
}

/** Reads a known path directly (no dialog) — used for opening a Recent Document. Returns null outside Tauri. */
export async function readBinaryFileAtPath(path: string): Promise<Uint8Array | null> {
  if (!isTauriRuntime()) return null;
  return readFile(path);
}

export async function readTextFileAtPath(path: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return readTextFile(path);
}

// --- Recent documents -------------------------------------------------
// Small JSON file in the app's own data directory, e.g.
// ~/.local/share/com.abdullah.pdfedits/recent-documents.json on Linux.

export interface RecentDocumentEntry {
  path: string;
  name: string;
  kind: "pdf" | "project";
  openedAt: number; // Date.now()
}

const RECENT_DOCS_FILE = "recent-documents.json";
const RECENT_DOCS_LIMIT = 15;

async function recentDocsPath(): Promise<string> {
  const dir = await appDataDir();
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  return join(dir, RECENT_DOCS_FILE);
}

/** Returns [] outside Tauri, on first run, or if the file is corrupted — never throws. */
export async function loadRecentDocuments(): Promise<RecentDocumentEntry[]> {
  if (!isTauriRuntime()) return [];
  try {
    const path = await recentDocsPath();
    if (!(await exists(path))) return [];
    const text = await readTextFile(path);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Adds/moves an entry to the front, de-duplicated by path, capped at RECENT_DOCS_LIMIT. Silently no-ops outside Tauri or on write failure — this is a nice-to-have, not something that should ever block opening a file. */
export async function addRecentDocument(entry: Omit<RecentDocumentEntry, "openedAt">): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const current = await loadRecentDocuments();
    const next = [{ ...entry, openedAt: Date.now() }, ...current.filter((e) => e.path !== entry.path)].slice(0, RECENT_DOCS_LIMIT);
    const path = await recentDocsPath();
    await writeTextFile(path, JSON.stringify(next));
  } catch {
    // best-effort only
  }
}

export async function removeRecentDocument(path: string): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const current = await loadRecentDocuments();
    const next = current.filter((e) => e.path !== path);
    const filePath = await recentDocsPath();
    await writeTextFile(filePath, JSON.stringify(next));
  } catch {
    // best-effort only
  }
}

export async function clearRecentDocuments(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const filePath = await recentDocsPath();
    await writeTextFile(filePath, JSON.stringify([]));
  } catch {
    // best-effort only
  }
}

// --- Printing -----------------------------------------------------------
// No custom print pipeline: write the current edits to a temp PDF and hand
// off to the OS's default PDF viewer, whose own print dialog already does
// page range/copies/printer selection well. Returns false if printing isn't
// available (outside Tauri).

export async function printPdfBytes(bytes: Uint8Array, suggestedName: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const dir = await tempDir();
  const safeName = suggestedName.replace(/[\\/:*?"<>|]/g, "_");
  const path = await join(dir, `pdfedits-print-${Date.now()}-${safeName}`);
  await writeFile(path, bytes);
  await shellOpen(path);
  return true;
}

export { isTauriRuntime };
