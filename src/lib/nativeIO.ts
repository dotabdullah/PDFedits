import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

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

export { isTauriRuntime };
