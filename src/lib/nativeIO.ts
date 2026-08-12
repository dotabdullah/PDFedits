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

export async function saveBinaryFile(bytes: Uint8Array, suggestedName: string, filters: FileFilter[]): Promise<boolean> {
  if (isTauriRuntime()) {
    const path = await save({ defaultPath: suggestedName, filters });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }
  downloadInBrowser(new Blob([bytes.slice().buffer]), suggestedName);
  return true;
}

export async function saveTextFile(text: string, suggestedName: string, filters: FileFilter[]): Promise<boolean> {
  if (isTauriRuntime()) {
    const path = await save({ defaultPath: suggestedName, filters });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  downloadInBrowser(new Blob([text], { type: "application/json" }), suggestedName);
  return true;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Returns null if the user cancelled, or if not running in Tauri (caller should fall back to an <input type="file">). */
export async function openBinaryFileDialog(filters: FileFilter[]): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({ multiple: false, directory: false, filters });
  if (!selected || Array.isArray(selected)) return null;
  const bytes = await readFile(selected);
  return { name: fileNameFromPath(selected), bytes };
}

export async function openTextFileDialog(filters: FileFilter[]): Promise<{ name: string; text: string } | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({ multiple: false, directory: false, filters });
  if (!selected || Array.isArray(selected)) return null;
  const text = await readTextFile(selected);
  return { name: fileNameFromPath(selected), text };
}

export { isTauriRuntime };
