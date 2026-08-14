import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ToolRail, TopBar } from "./components/Toolbar";
import { PdfCanvas } from "./components/PdfCanvas";
import { SidePanel } from "./components/SidePanel";
import { SignaturePad } from "./components/SignaturePad";
import { ThumbnailStrip } from "./components/ThumbnailStrip";
import { base64ToBytes, bytesToBase64, canvasToImageBytes, flattenToPdf, loadPdfDocument } from "./lib/pdfEngine";
import {
  openBinaryFileDialog,
  openTextFileDialog,
  saveBinaryFileAs,
  saveTextFileAs,
  writeBinaryToPath,
  writeTextToPath,
} from "./lib/nativeIO";
import type { EditorElement, ExistingTextItem, ProjectFile, ToolId } from "./lib/types";

const RENDER_SCALE_BASE = 1.4;
const HISTORY_LIMIT = 50;

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomStep, setZoomStep] = useState(1);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [eraseWidth, setEraseWidth] = useState(120);
  const [eraseThickness, setEraseThickness] = useState(24);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const [savedProjectPath, setSavedProjectPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // Undo/redo history. Position drags are intentionally excluded (would flood
  // the stack on every mousemove) — add/delete/text-edit actions are tracked.
  const pastRef = useRef<EditorElement[][]>([]);
  const futureRef = useRef<EditorElement[][]>([]);
  const [, setHistoryTick] = useState(0);

  const renderScale = RENDER_SCALE_BASE * zoomStep;

  const openFile = useCallback(async (bytes: Uint8Array, name: string, restoredElements: EditorElement[] = []) => {
    const doc = await loadPdfDocument(bytes);
    setPdfBytes(bytes);
    setPdfDoc(doc);
    setFileName(name);
    setNumPages(doc.numPages);
    setCurrentPage(0);
    setElements(restoredElements);
    setSelectedId(null);
    setSavedPdfPath(null);
    setSavedProjectPath(null);
    pastRef.current = [];
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }, []);

  function closeDocument() {
    if (elements.length > 0 && !window.confirm("Close this PDF? Any unsaved edits will be lost.")) return;
    setPdfBytes(null);
    setPdfDoc(null);
    setFileName(null);
    setNumPages(0);
    setCurrentPage(0);
    setElements([]);
    setSelectedId(null);
    setSavedPdfPath(null);
    setSavedProjectPath(null);
    pastRef.current = [];
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }

  function resetAllEdits() {
    if (elements.length === 0) return;
    if (!window.confirm("Reset all edits on this PDF? This removes every text, image, signature, and erase change you've made.")) return;
    commit(() => []);
    setSelectedId(null);
  }

  function commit(mutator: (prev: EditorElement[]) => EditorElement[]) {
    setElements((prev) => {
      pastRef.current.push(prev);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      futureRef.current = [];
      setHistoryTick((t) => t + 1);
      return mutator(prev);
    });
  }

  function undo() {
    if (pastRef.current.length === 0) return;
    setElements((prev) => {
      const previous = pastRef.current.pop()!;
      futureRef.current.push(prev);
      setHistoryTick((t) => t + 1);
      return previous;
    });
    setSelectedId(null);
  }

  function redo() {
    if (futureRef.current.length === 0) return;
    setElements((prev) => {
      const next = futureRef.current.pop()!;
      pastRef.current.push(prev);
      setHistoryTick((t) => t + 1);
      return next;
    });
    setSelectedId(null);
  }

  async function handleOpenClick() {
    try {
      const native = await openBinaryFileDialog([{ name: "PDF", extensions: ["pdf"] }]);
      if (native) {
        await openFile(native.bytes, native.name);
        return;
      }
    } catch (err) {
      window.alert(`Couldn't open that PDF.\n\n${errorMessage(err)}`);
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    await openFile(buf, file.name);
    e.target.value = "";
  }

  function handleToolSelect(tool: ToolId) {
    setActiveTool(tool);
    setSelectedId(null);
    if (tool === "signature") {
      setShowSigPad(true);
    } else if (tool === "image") {
      imageInputRef.current?.click();
    }
  }

  async function handleImageChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleSignatureConfirm(dataUrl: string) {
    setPendingImage(dataUrl);
    setShowSigPad(false);
  }

  function addElement(el: EditorElement) {
    commit((prev) => [...prev, el]);
  }

  function updateElement(id: string, patch: Partial<EditorElement>) {
    // Live drag/resize/property edits — not pushed to history (see note above).
    setElements((prev) => prev.map((el) => (el.id === id ? ({ ...el, ...patch } as EditorElement) : el)));
  }

  function deleteElement(id: string) {
    commit((prev) => prev.filter((el) => el.id !== id));
    setSelectedId(null);
  }

  function commitExistingTextEdit(item: ExistingTextItem, newText: string, backgroundColor: string, width: number) {
    const textId = `${item.id}-text`;
    commit((prev) => [
      ...prev,
      {
        id: `${item.id}-erase`,
        kind: "erase",
        page: item.page,
        x: item.x - 1,
        y: item.y - 1,
        width: width + 2,
        height: item.height + 2,
        color: backgroundColor,
      },
      {
        id: textId,
        kind: "text",
        page: item.page,
        x: item.x,
        y: item.y,
        width: Math.max(width, 40),
        height: item.height,
        content: newText,
        fontSize: item.fontSize,
        color: "#14171f",
        fontFamily: item.fontFamily,
        bold: item.bold,
        italic: item.italic,
      },
    ]);
    // So the properties panel shows font/color controls right away, letting
    // the user correct the auto-detected font family/weight if it's off.
    setSelectedId(textId);
  }

  async function buildEditedPdfBytes(): Promise<Uint8Array | null> {
    if (!pdfBytes) return null;
    return flattenToPdf(pdfBytes, elements, renderScale);
  }

  /** "Save": reuse the path from the last save in this session if we have one, else behave like Save As. */
  async function handleSavePdf() {
    const outBytes = await buildEditedPdfBytes();
    if (!outBytes) return;
    try {
      if (savedPdfPath) {
        await writeBinaryToPath(savedPdfPath, outBytes);
        return;
      }
      await handleSavePdfAs();
    } catch (err) {
      window.alert(`Couldn't save the PDF.\n\n${errorMessage(err)}`);
    }
  }

  /** "Save As": always prompts for a location, and remembers it for the next quick Save. */
  async function handleSavePdfAs() {
    const outBytes = await buildEditedPdfBytes();
    if (!outBytes) return;
    const baseName = (fileName ?? "document.pdf").replace(/\.pdf$/i, "");
    try {
      const path = await saveBinaryFileAs(outBytes, `${baseName}-edited.pdf`, [{ name: "PDF", extensions: ["pdf"] }]);
      if (path) setSavedPdfPath(path);
    } catch (err) {
      window.alert(`Couldn't save the PDF.\n\n${errorMessage(err)}`);
    }
  }

  async function handleExportImage(format: "png" | "jpg") {
    if (!pdfBytes) return;
    const baseName = (fileName ?? "document.pdf").replace(/\.pdf$/i, "");

    const canvas = document.querySelector(".pdf-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const composite = document.createElement("canvas");
    composite.width = canvas.width;
    composite.height = canvas.height;
    const ctx = composite.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
    for (const el of elements.filter((e) => e.page === currentPage)) {
      if (el.kind === "erase") {
        ctx.fillStyle = el.color;
        ctx.fillRect(el.x, el.y, el.width, el.height);
      } else if (el.kind === "text") {
        ctx.fillStyle = el.color;
        const weight = el.bold ? "bold " : "";
        const style = el.italic ? "italic " : "";
        ctx.font = `${style}${weight}${el.fontSize}px sans-serif`;
        ctx.fillText(el.content, el.x, el.y + el.fontSize);
      } else if (el.kind === "image" || el.kind === "signature") {
        const img = new Image();
        img.src = el.dataUrl;
        await new Promise((r) => (img.onload = r));
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      }
    }
    const blob = await canvasToImageBytes(composite, format);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    try {
      await saveBinaryFileAs(bytes, `${baseName}-page${currentPage + 1}.${format}`, [
        { name: format.toUpperCase(), extensions: [format] },
      ]);
    } catch (err) {
      window.alert(`Couldn't save the ${format.toUpperCase()}.\n\n${errorMessage(err)}`);
    }
  }

  function buildProjectJson(): string {
    const project: ProjectFile = {
      format: "pdfedits-project",
      version: 1,
      fileName: fileName ?? "document.pdf",
      pdfBase64: bytesToBase64(pdfBytes!),
      elements,
    };
    return JSON.stringify(project);
  }

  async function handleSaveProject() {
    if (!pdfBytes) return;
    try {
      if (savedProjectPath) {
        await writeTextToPath(savedProjectPath, buildProjectJson());
        return;
      }
      await handleSaveProjectAs();
    } catch (err) {
      window.alert(`Couldn't save the project.\n\n${errorMessage(err)}`);
    }
  }

  async function handleSaveProjectAs() {
    if (!pdfBytes) return;
    const baseName = (fileName ?? "document.pdf").replace(/\.pdf$/i, "");
    try {
      const path = await saveTextFileAs(buildProjectJson(), `${baseName}.pdfedits`, [
        { name: "PDFedits Project", extensions: ["pdfedits"] },
      ]);
      if (path) setSavedProjectPath(path);
    } catch (err) {
      window.alert(`Couldn't save the project.\n\n${errorMessage(err)}`);
    }
  }

  async function loadProjectFromText(text: string, path: string | null) {
    let project: ProjectFile;
    try {
      project = JSON.parse(text) as ProjectFile;
    } catch {
      throw new Error("The file isn't valid JSON — it may be corrupted, or isn't actually a .pdfedits file.");
    }
    if (project.format !== "pdfedits-project") {
      throw new Error(
        `The file's "format" field was ${JSON.stringify(project.format ?? "(missing)")}, expected "pdfedits-project". This isn't a PDFedits project file.`
      );
    }
    if (!project.pdfBase64) {
      throw new Error("The project file has no embedded PDF data (pdfBase64 is missing).");
    }
    const bytes = base64ToBytes(project.pdfBase64);
    await openFile(bytes, project.fileName, project.elements ?? []);
    setSavedProjectPath(path);
  }

  async function handleOpenProjectClick() {
    try {
      const native = await openTextFileDialog([{ name: "PDFedits Project", extensions: ["pdfedits"] }]);
      if (native) {
        await loadProjectFromText(native.text, native.path);
        return;
      }
    } catch (err) {
      window.alert(`Couldn't open that project file.\n\n${errorMessage(err)}`);
      return;
    }
    projectInputRef.current?.click();
  }

  async function handleProjectChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await loadProjectFromText(text, null);
    } catch (err) {
      window.alert(`Couldn't open that project file.\n\n${errorMessage(err)}`);
    }
    e.target.value = "";
  }

  // Drag-and-drop a PDF (or a .pdfedits project) straight onto the window.
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".pdfedits")) {
      file.text().then(async (text) => {
        try {
          await loadProjectFromText(text, null);
        } catch (err) {
          window.alert(`Couldn't open that project file.\n\n${errorMessage(err)}`);
        }
      });
    } else if (file.type === "application/pdf") {
      file.arrayBuffer().then((buf) => openFile(new Uint8Array(buf), file.name));
    }
  }

  // Keyboard shortcuts: tool switching, undo/redo, delete, escape.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (isTyping) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteElement(selectedId);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      const shortcuts: Record<string, ToolId> = { v: "select", t: "text", i: "image", s: "signature", e: "erase" };
      const tool = shortcuts[e.key.toLowerCase()];
      if (tool && pdfDoc) handleToolSelect(tool);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, pdfDoc]);

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
    >
      <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileChosen} />
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handleImageChosen} />
      <input ref={projectInputRef} type="file" accept=".pdfedits,application/json" style={{ display: "none" }} onChange={handleProjectChosen} />

      <ToolRail activeTool={activeTool} onSelectTool={handleToolSelect} />
      <TopBar
        fileName={fileName}
        zoom={zoomStep}
        currentPage={currentPage}
        numPages={numPages}
        canUndo={pastRef.current.length > 0}
        canRedo={futureRef.current.length > 0}
        canReset={elements.length > 0}
        activeTool={activeTool}
        eraseWidth={eraseWidth}
        eraseThickness={eraseThickness}
        onEraseWidthChange={setEraseWidth}
        onEraseThicknessChange={setEraseThickness}
        onOpen={handleOpenClick}
        onClose={closeDocument}
        onReset={resetAllEdits}
        onZoom={setZoomStep}
        onPage={setCurrentPage}
        onSavePdf={handleSavePdf}
        onSavePdfAs={handleSavePdfAs}
        onExportImage={handleExportImage}
        onUndo={undo}
        onRedo={redo}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProjectClick}
      />

      {pdfDoc ? (
        <>
          {numPages > 1 && (
            <ThumbnailStrip pdfDoc={pdfDoc} numPages={numPages} currentPage={currentPage} onSelectPage={setCurrentPage} />
          )}
          <PdfCanvas
            pdfDoc={pdfDoc}
            pageIndex={currentPage}
            zoom={renderScale}
            activeTool={activeTool}
            elements={elements}
            eraseWidth={eraseWidth}
            eraseThickness={eraseThickness}
            onAddElement={addElement}
            onUpdateElement={updateElement}
            onDeleteElement={deleteElement}
            onSelectElement={setSelectedId}
            selectedId={selectedId}
            pendingImage={pendingImage}
            onConsumePendingImage={() => setPendingImage(null)}
            onCommitTextEdit={commitExistingTextEdit}
          />
        </>
      ) : (
        <EmptyState onOpen={handleOpenClick} onOpenProject={handleOpenProjectClick} />
      )}

      <SidePanel selected={selectedElement} onUpdate={updateElement} onDelete={deleteElement} />

      {showSigPad && <SignaturePad onConfirm={handleSignatureConfirm} onClose={() => setShowSigPad(false)} />}

      {isDraggingFile && (
        <div className="drop-veil">
          <p>Drop a PDF or .pdfedits project to open</p>
        </div>
      )}

      <style>{`
        .drop-veil {
          position: fixed;
          inset: 0;
          background: rgba(217, 137, 54, 0.14);
          border: 3px dashed var(--accent-amber);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          pointer-events: none;
        }
        .drop-veil p {
          font-family: var(--font-display);
          font-size: 22px;
          color: var(--paper-100);
          background: var(--ink-900);
          padding: 16px 28px;
          border-radius: var(--radius-md);
        }
      `}</style>
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function EmptyState({ onOpen, onOpenProject }: { onOpen: () => void; onOpenProject: () => void }) {
  return (
    <div className="empty-state">
      <p className="empty-eyebrow">PDFEDITS</p>
      <h1>Open a PDF to start editing</h1>
      <p className="empty-sub">
        Edit existing text in place, add new text, images, and signatures — all offline, saved back to PDF, PNG, or JPG.
      </p>
      <div className="empty-actions">
        <button className="btn-primary" onClick={onOpen}>
          Open PDF
        </button>
        <button className="btn-ghost" onClick={onOpenProject}>
          Open project (.pdfedits)
        </button>
      </div>
      <p className="empty-hint">or drag a file anywhere onto this window</p>
      <style>{`
        .empty-state {
          grid-area: canvas;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: var(--ink-800);
          color: var(--text-on-ink);
          padding: 40px;
        }
        .empty-eyebrow {
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.12em;
          color: var(--accent-amber);
          margin-bottom: 10px;
        }
        .empty-state h1 {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 600;
          margin: 0 0 10px;
        }
        .empty-sub {
          color: var(--text-on-ink-dim);
          max-width: 400px;
          margin: 0 0 24px;
        }
        .empty-actions {
          display: flex;
          gap: 10px;
        }
        .empty-hint {
          margin-top: 14px;
          font-size: 12px;
          color: var(--text-on-ink-dim);
        }
      `}</style>
    </div>
  );
}
