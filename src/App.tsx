import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { HeaderBar, ToolsBar } from "./components/Toolbar";
import { PdfCanvas } from "./components/PdfCanvas";
import { SidePanel } from "./components/SidePanel";
import { SignaturePad } from "./components/SignaturePad";
import { PagesPanel } from "./components/PagesPanel";
import { StatusBar } from "./components/StatusBar";
import { AboutModal } from "./components/AboutModal";
import { SearchPanel } from "./components/SearchPanel";
import {
  base64ToBytes,
  bytesToBase64,
  canvasToImageBytes,
  deletePageFromPdf,
  flattenToPdf,
  loadPdfDocument,
  searchDocument,
} from "./lib/pdfEngine";
import {
  openBinaryFileDialog,
  openTextFileDialog,
  saveBinaryFileAs,
  saveTextFileAs,
  writeBinaryToPath,
  writeTextToPath,
} from "./lib/nativeIO";
import type { EditorElement, ExistingTextItem, ProjectFile, SearchMatch, SearchOptions, ToolId, ZoomMode } from "./lib/types";

const APP_VERSION = "0.3.0";
const RENDER_SCALE_BASE = 1.4;
const HISTORY_LIMIT = 50;

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(RENDER_SCALE_BASE);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("custom");
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
  const [showAbout, setShowAbout] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const clipboardRef = useRef<EditorElement | null>(null);

  const pastRef = useRef<EditorElement[][]>([]);
  const futureRef = useRef<EditorElement[][]>([]);
  const [, setHistoryTick] = useState(0);

  const renderScale = zoom;

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  const openFile = useCallback(async (bytes: Uint8Array, name: string, restoredElements: EditorElement[] = []) => {
    const doc = await loadPdfDocument(bytes);
    setPdfBytes(bytes);
    setPdfDoc(doc);
    setFileName(name);
    setNumPages(doc.numPages);
    setCurrentPage((prev) => Math.min(prev, doc.numPages - 1) || 0);
    setElements(restoredElements);
    setSelectedId(null);
    setSavedPdfPath(null);
    setSavedProjectPath(null);
    pastRef.current = [];
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }, []);

  /** Full reset variant of openFile used for brand-new documents (always jumps to page 0). */
  async function openFreshFile(bytes: Uint8Array, name: string, restoredElements: EditorElement[] = []) {
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
  }

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
    if (!window.confirm("Reset all edits on this PDF? This removes every text, image, signature, shape, and erase change you've made.")) return;
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
        await openFreshFile(native.bytes, native.name);
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
    await openFreshFile(buf, file.name);
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
    setElements((prev) => prev.map((el) => (el.id === id ? ({ ...el, ...patch } as EditorElement) : el)));
  }

  function deleteElement(id: string) {
    commit((prev) => prev.filter((el) => el.id !== id));
    setSelectedId(null);
  }

  /** "Front" = last in array (renders on top); "back" = first. Z-order is just array order. */
  function bringToFront(id: string) {
    commit((prev) => {
      const el = prev.find((e) => e.id === id);
      if (!el) return prev;
      return [...prev.filter((e) => e.id !== id), el];
    });
  }

  function sendToBack(id: string) {
    commit((prev) => {
      const el = prev.find((e) => e.id === id);
      if (!el) return prev;
      return [el, ...prev.filter((e) => e.id !== id)];
    });
  }

  function duplicateElement(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    const copy: EditorElement = { ...el, id: crypto.randomUUID(), x: el.x + 16, y: el.y + 16 };
    commit((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }

  function copySelected() {
    const el = elements.find((e) => e.id === selectedId);
    if (el) clipboardRef.current = el;
  }

  function cutSelected() {
    if (!selectedId) return;
    copySelected();
    deleteElement(selectedId);
  }

  function pasteClipboard() {
    const clip = clipboardRef.current;
    if (!clip) return;
    const copy: EditorElement = { ...clip, id: crypto.randomUUID(), page: currentPage, x: clip.x + 16, y: clip.y + 16 };
    commit((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }

  function zoomStep(delta: number) {
    setZoomMode("custom");
    setZoom((z) => Math.max(0.25, Math.min(4, z + delta)));
  }

  function setCustomZoomPercent(percent: number) {
    if (!Number.isFinite(percent) || percent <= 0) return;
    setZoomMode("custom");
    setZoom(percent / 100);
  }

  function goToPage(pageNumberOneIndexed: number) {
    const clamped = Math.max(1, Math.min(numPages, Math.round(pageNumberOneIndexed)));
    setCurrentPage(clamped - 1);
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
    setSelectedId(textId);
  }

  async function handleDeletePage(pageIndex: number) {
    if (!pdfBytes) return;
    try {
      const newBytes = await deletePageFromPdf(pdfBytes, pageIndex);
      const remappedElements = elements
        .filter((el) => el.page !== pageIndex)
        .map((el) => (el.page > pageIndex ? { ...el, page: el.page - 1 } : el));
      const doc = await loadPdfDocument(newBytes);
      setPdfBytes(newBytes);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setElements(remappedElements);
      setSelectedId(null);
      setCurrentPage((prev) => Math.min(prev, doc.numPages - 1));
      setSavedPdfPath(null); // structure changed — treat as needing a fresh Save location
      pastRef.current = [];
      futureRef.current = [];
      setHistoryTick((t) => t + 1);
    } catch (err) {
      window.alert(`Couldn't delete that page.\n\n${errorMessage(err)}`);
    }
  }

  async function buildEditedPdfBytes(): Promise<Uint8Array | null> {
    if (!pdfBytes) return null;
    return flattenToPdf(pdfBytes, elements, renderScale);
  }

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
      } else if (el.kind === "rectangle" || el.kind === "ellipse") {
        ctx.lineWidth = el.strokeWidth;
        ctx.strokeStyle = el.strokeColor;
        if (el.fillColor) ctx.fillStyle = el.fillColor;
        ctx.beginPath();
        if (el.kind === "ellipse") {
          ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
        } else {
          ctx.rect(el.x, el.y, el.width, el.height);
        }
        if (el.fillColor) ctx.fill();
        ctx.stroke();
      } else if (el.kind === "line") {
        ctx.lineWidth = el.strokeWidth;
        ctx.strokeStyle = el.strokeColor;
        ctx.beginPath();
        if (el.descending) {
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x + el.width, el.y + el.height);
        } else {
          ctx.moveTo(el.x, el.y + el.height);
          ctx.lineTo(el.x + el.width, el.y);
        }
        ctx.stroke();
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
    await openFreshFile(bytes, project.fileName, project.elements ?? []);
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
      file.arrayBuffer().then((buf) => openFreshFile(new Uint8Array(buf), file.name));
    }
  }

  async function handleSearch(query: string) {
    if (!pdfDoc) return [];
    const matches = await searchDocument(pdfDoc, query, renderScale, searchOptions);
    setSearchMatches(matches);
    setActiveMatchIndex(0);
    if (matches.length > 0) setCurrentPage(matches[0].page);
    return matches;
  }

  function handleSearchJump(match: SearchMatch) {
    const idx = searchMatches.indexOf(match);
    if (idx >= 0) setActiveMatchIndex(idx);
    setCurrentPage(match.page);
  }

  function searchNext() {
    if (searchMatches.length === 0) return;
    const next = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(next);
    setCurrentPage(searchMatches[next].page);
  }

  function searchPrev() {
    if (searchMatches.length === 0) return;
    const prev = (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(prev);
    setCurrentPage(searchMatches[prev].page);
  }

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleOpenClick();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (pdfDoc) setShowSearch((s) => !s);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedId) {
        e.preventDefault();
        copySelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x" && selectedId) {
        e.preventDefault();
        cutSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && !isTyping) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedId && !isTyping) {
        e.preventDefault();
        duplicateElement(selectedId);
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
        setShowSearch(false);
        return;
      }
      const shortcuts: Record<string, ToolId> = {
        v: "select",
        h: "pan",
        t: "text",
        i: "image",
        s: "signature",
        r: "rectangle",
        o: "ellipse",
        l: "line",
        e: "erase",
      };
      const tool = shortcuts[e.key.toLowerCase()];
      if (tool && pdfDoc) handleToolSelect(tool);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, pdfDoc, elements, currentPage, searchMatches, activeMatchIndex]);

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;
  const docInfo = fileName ? { fileName, numPages, currentPage } : null;

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

      <HeaderBar
        fileName={fileName}
        numPages={numPages}
        canUndo={pastRef.current.length > 0}
        canRedo={futureRef.current.length > 0}
        onOpen={handleOpenClick}
        onOpenProject={handleOpenProjectClick}
        onClose={closeDocument}
        onSavePdf={handleSavePdf}
        onSavePdfAs={handleSavePdfAs}
        onSaveProject={handleSaveProject}
        onUndo={undo}
        onRedo={redo}
        onToggleSearch={() => setShowSearch((s) => !s)}
        onToggleSettings={() => setShowAbout(true)}
      />

      <ToolsBar
        activeTool={activeTool}
        onSelectTool={handleToolSelect}
        currentPage={currentPage}
        numPages={numPages}
        onPage={setCurrentPage}
        onGoToPage={goToPage}
        onFirstPage={() => setCurrentPage(0)}
        onLastPage={() => setCurrentPage(Math.max(0, numPages - 1))}
        zoom={zoom}
        zoomMode={zoomMode}
        onZoomStep={zoomStep}
        onZoomPercent={setCustomZoomPercent}
        onFitWidth={() => setZoomMode("fit-width")}
        onFitPage={() => setZoomMode("fit-page")}
        onActualSize={() => setZoomMode("actual")}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        eraseWidth={eraseWidth}
        eraseThickness={eraseThickness}
        onEraseWidthChange={setEraseWidth}
        onEraseThicknessChange={setEraseThickness}
        canReset={elements.length > 0}
        onReset={resetAllEdits}
      />

      <PagesPanel pdfDoc={pdfDoc} numPages={numPages} currentPage={currentPage} onSelectPage={setCurrentPage} onDeletePage={handleDeletePage} />

      {pdfDoc ? (
        <PdfCanvas
          pdfDoc={pdfDoc}
          pageIndex={currentPage}
          zoom={renderScale}
          zoomMode={zoomMode}
          onZoomChange={setZoom}
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
          highlightMatch={searchMatches[activeMatchIndex] ?? null}
        />
      ) : (
        <EmptyState onOpen={handleOpenClick} />
      )}

      <SidePanel
        selected={selectedElement}
        docInfo={docInfo}
        onUpdate={updateElement}
        onDelete={deleteElement}
        onDuplicate={duplicateElement}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
      />

      <StatusBar onAboutClick={() => setShowAbout(true)} />

      {showSigPad && <SignaturePad onConfirm={handleSignatureConfirm} onClose={() => setShowSigPad(false)} />}
      {showAbout && <AboutModal version={APP_VERSION} onClose={() => setShowAbout(false)} />}
      {showSearch && pdfDoc && (
        <SearchPanel
          onSearch={handleSearch}
          onJump={handleSearchJump}
          onClose={() => setShowSearch(false)}
          options={searchOptions}
          onOptionsChange={setSearchOptions}
          activeIndex={activeMatchIndex}
          onNext={searchNext}
          onPrev={searchPrev}
        />
      )}

      {isDraggingFile && (
        <div className="drop-veil">
          <p>Drop a PDF or .pdfedits project to open</p>
        </div>
      )}

      <style>{`
        .drop-veil {
          position: fixed;
          inset: 0;
          background: rgba(47, 111, 237, 0.08);
          border: 3px dashed var(--accent-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          pointer-events: none;
        }
        .drop-veil p {
          font-size: 18px;
          font-weight: 600;
          color: var(--bg-panel);
          background: var(--accent-blue);
          padding: 14px 26px;
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

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </div>
      <h1>No document open</h1>
      <p className="empty-sub">
        Open a PDF to view it offline. Drag &amp; drop a file onto this window, or press <kbd>Ctrl+O</kbd>.
      </p>
      <button className="empty-open" onClick={onOpen}>
        Open PDF
      </button>
      <style>{`
        .empty-state {
          grid-area: canvas;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: var(--bg-canvas);
          color: var(--text-primary);
          padding: 40px;
        }
        .empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-tertiary);
          margin-bottom: 18px;
        }
        .empty-state h1 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 10px;
        }
        .empty-sub {
          color: var(--text-secondary);
          max-width: 380px;
          margin: 0 0 22px;
          font-size: 13.5px;
          line-height: 1.6;
        }
        .empty-sub kbd {
          font-family: var(--font-mono);
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 11.5px;
        }
        .empty-open {
          background: var(--accent-blue);
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
        }
        .empty-open:hover { background: var(--accent-blue-strong); }
      `}</style>
    </div>
  );
}
