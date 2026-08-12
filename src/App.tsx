import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ToolRail, TopBar } from "./components/Toolbar";
import { PdfCanvas } from "./components/PdfCanvas";
import { SidePanel } from "./components/SidePanel";
import { SignaturePad } from "./components/SignaturePad";
import { ThumbnailStrip } from "./components/ThumbnailStrip";
import {
  base64ToBytes,
  bytesToBase64,
  canvasToImageBytes,
  flattenToPdf,
  loadPdfDocument,
} from "./lib/pdfEngine";
import type { EditorElement, ExistingTextItem, ProjectFile, ToolId } from "./lib/types";

const RENDER_SCALE_BASE = 1.4;
const HISTORY_LIMIT = 50;

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomStep, setZoomStep] = useState(1); // multiplier on top of RENDER_SCALE_BASE
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

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
    pastRef.current = [];
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }, []);

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

  function commitExistingTextEdit(item: ExistingTextItem, newText: string, backgroundColor: string) {
    commit((prev) => [
      ...prev,
      {
        id: `${item.id}-erase`,
        kind: "erase",
        page: item.page,
        x: item.x - 1,
        y: item.y - 1,
        width: item.width + 2,
        height: item.height + 2,
        color: backgroundColor,
      },
      {
        id: `${item.id}-text`,
        kind: "text",
        page: item.page,
        x: item.x,
        y: item.y,
        width: Math.max(item.width, 40),
        height: item.height,
        content: newText,
        fontSize: item.fontSize,
        color: "#14171f",
        fontFamily: item.fontFamily,
      },
    ]);
  }

  async function handleExport(format: "pdf" | "png" | "jpg") {
    if (!pdfBytes) return;
    const baseName = (fileName ?? "document.pdf").replace(/\.pdf$/i, "");

    if (format === "pdf") {
      const outBytes = await flattenToPdf(pdfBytes, elements, renderScale);
      downloadBlob(new Blob([outBytes.slice().buffer], { type: "application/pdf" }), `${baseName}-edited.pdf`);
      return;
    }

    // PNG/JPG: export the currently visible page's canvas, overlays flattened via re-render.
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
        ctx.font = `${el.fontSize}px sans-serif`;
        ctx.fillText(el.content, el.x, el.y + el.fontSize);
      } else if (el.kind === "image" || el.kind === "signature") {
        const img = new Image();
        img.src = el.dataUrl;
        await new Promise((r) => (img.onload = r));
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      }
    }
    const blob = await canvasToImageBytes(composite, format);
    downloadBlob(blob, `${baseName}-page${currentPage + 1}.${format}`);
  }

  function handleSaveProject() {
    if (!pdfBytes) return;
    const baseName = (fileName ?? "document.pdf").replace(/\.pdf$/i, "");
    const project: ProjectFile = {
      format: "pdfedits-project",
      version: 1,
      fileName: fileName ?? "document.pdf",
      pdfBase64: bytesToBase64(pdfBytes),
      elements,
    };
    downloadBlob(new Blob([JSON.stringify(project)], { type: "application/json" }), `${baseName}.pdfedits`);
  }

  function handleOpenProjectClick() {
    projectInputRef.current?.click();
  }

  async function handleProjectChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const project = JSON.parse(text) as ProjectFile;
      if (project.format !== "pdfedits-project") throw new Error("Not a PDFedits project file");
      const bytes = base64ToBytes(project.pdfBase64);
      await openFile(bytes, project.fileName, project.elements);
    } catch (err) {
      alert("Couldn't open that project file. Make sure it's a .pdfedits file saved from this app.");
    }
    e.target.value = "";
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Drag-and-drop a PDF (or .pdfedits project) straight onto the window.
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".pdfedits")) {
      file.text().then(async (text) => {
        try {
          const project = JSON.parse(text) as ProjectFile;
          const bytes = base64ToBytes(project.pdfBase64);
          await openFile(bytes, project.fileName, project.elements);
        } catch {
          alert("Couldn't open that project file.");
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
        onOpen={handleOpenClick}
        onZoom={setZoomStep}
        onPage={setCurrentPage}
        onExport={handleExport}
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
            onAddElement={addElement}
            onUpdateElement={updateElement}
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
