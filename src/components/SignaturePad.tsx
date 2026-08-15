import { useRef, useState } from "react";

interface Props {
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
}

export function SignaturePad({ onConfirm, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  function start(e: React.PointerEvent) {
    drawing.current = true;
    draw(e);
  }
  function stop() {
    drawing.current = false;
  }
  function draw(e: React.PointerEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#171b24";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setEmpty(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL("image/png"));
  }

  return (
    <div className="sig-backdrop" onClick={onClose}>
      <div className="sig-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Draw your signature</h3>
        <canvas
          ref={canvasRef}
          width={480}
          height={180}
          className="sig-canvas"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerMove={draw}
        />
        <div className="sig-actions">
          <button className="sig-btn-ghost" onClick={clear}>
            Clear
          </button>
          <div className="sig-actions-right">
            <button className="sig-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="sig-btn-primary" onClick={confirm} disabled={empty}>
              Use signature
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .sig-backdrop {
          position: fixed; inset: 0; background: rgba(15,23,42,0.35);
          display: flex; align-items: center; justify-content: center; z-index: 50;
        }
        .sig-modal {
          background: var(--bg-panel); border-radius: var(--radius-md);
          padding: 22px; width: 520px; box-shadow: 0 20px 50px rgba(15,23,42,0.25);
          border: 1px solid var(--border);
        }
        .sig-modal h3 {
          color: var(--text-primary);
          margin: 0 0 14px; font-size: 15px; font-weight: 700;
        }
        .sig-canvas {
          width: 100%; background: #fff; border: 1px dashed var(--border-strong);
          border-radius: var(--radius-sm); touch-action: none; cursor: crosshair;
        }
        .sig-actions { display: flex; justify-content: space-between; margin-top: 16px; }
        .sig-actions-right { display: flex; gap: 8px; }
        .sig-btn-ghost, .sig-btn-primary {
          font-size: 13px;
          font-weight: 600;
          border-radius: var(--radius-sm);
          padding: 8px 16px;
          cursor: pointer;
        }
        .sig-btn-ghost {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-primary);
        }
        .sig-btn-ghost:hover { background: var(--bg-canvas); }
        .sig-btn-primary {
          background: var(--accent-blue);
          border: none;
          color: #fff;
        }
        .sig-btn-primary:hover:not(:disabled) { background: var(--accent-blue-strong); }
        .sig-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
