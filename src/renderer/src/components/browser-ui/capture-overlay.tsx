import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Camera,
  Check,
  Copy,
  Download,
  Highlighter,
  Pencil,
  RotateCcw,
  Square,
  Trash2,
  X
} from "lucide-react";
import { PortalComponent } from "@/components/portal/portal";
import { useBoundingRect } from "@/hooks/use-bounding-rect";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CapturedPageResult, CaptureRect } from "~/lumi/interfaces/browser/capture";
import { toast } from "sonner";

type OverlayMode = "closed" | "select" | "annotate";
type AnnotationTool = "pen" | "highlighter" | "arrow" | "rect";

interface Point {
  x: number; // normalized [0..1]
  y: number;
}

interface AnnotationStroke {
  tool: AnnotationTool;
  color: string;
  points: Point[];
}

const COLORS = [
  { id: "sapphire", hex: "#2563EB", label: "Sapphire" },
  { id: "crimson", hex: "#EF4444", label: "Crimson" },
  { id: "amber", hex: "#F59E0B", label: "Amber" },
  { id: "mint", hex: "#10B981", label: "Mint" }
];

function drawStrokeOnCanvas(ctx: CanvasRenderingContext2D, stroke: AnnotationStroke, width: number, height: number) {
  if (stroke.points.length === 0) return;
  const pts = stroke.points.map((p) => ({ x: p.x * width, y: p.y * height }));
  const scaleFactor = Math.max(1, width / 900);

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "highlighter") {
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 18 * scaleFactor;
  } else {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3.2 * scaleFactor;
  }

  if (stroke.tool === "pen" || stroke.tool === "highlighter") {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  } else if (stroke.tool === "rect") {
    const start = pts[0];
    const end = pts[pts.length - 1];
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (stroke.tool === "arrow") {
    const start = pts[0];
    const end = pts[pts.length - 1];
    const headLen = 14 * scaleFactor;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function CaptureOverlay({ anchorRef }: { anchorRef: React.RefObject<HTMLDivElement | null> }) {
  const contentRect = useBoundingRect(anchorRef);

  const [mode, setMode] = useState<OverlayMode>("closed");
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState<CapturedPageResult | null>(null);

  // Selection box drag state (relative to viewport)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);

  // Annotation state
  const [tool, setTool] = useState<AnnotationTool>("pen");
  const [color, setColor] = useState<string>(COLORS[0].hex);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<AnnotationStroke | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const closeOverlay = useCallback(() => {
    setMode("closed");
    setDragStart(null);
    setDragEnd(null);
    setActiveStroke(null);
    setStrokes([]);
    setCaptureResult(null);
    setCopiedFlag(false);
  }, []);

  const runCapture = useCallback(
    async (kind: "visible" | "full", rect?: CaptureRect) => {
      if (capturing) return;
      setCapturing(true);
      setMode("closed");
      // Allow Electron portal layer to hide before calling capturePage()
      await new Promise((r) => setTimeout(r, 85));
      try {
        const res = kind === "full" ? await lumi.capture.captureFullPage() : await lumi.capture.captureVisible(rect);
        if (res) {
          setStrokes([]);
          setActiveStroke(null);
          setCaptureResult(res);
          setMode("annotate");
        } else {
          toast.error("Could not capture current tab");
        }
      } catch {
        toast.error("Page capture failed");
      } finally {
        setCapturing(false);
      }
    },
    [capturing]
  );

  useEffect(() => {
    const onWorkspaceAction = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === "capture_region") {
        setDragStart(null);
        setDragEnd(null);
        setMode("select");
      } else if (action === "capture_full_page") {
        void runCapture("full");
      }
    };
    window.addEventListener("lumi:workspace-action", onWorkspaceAction);
    return () => window.removeEventListener("lumi:workspace-action", onWorkspaceAction);
  }, [runCapture]);

  useEffect(() => {
    if (mode === "closed") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeOverlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, closeOverlay]);

  // Decode captured image into offscreen HTMLImageElement
  useEffect(() => {
    if (!captureResult) {
      loadedImageRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      // Trigger canvas redraw
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          for (const s of strokes) drawStrokeOnCanvas(ctx, s, canvas.width, canvas.height);
        }
      }
    };
    img.src = captureResult.dataUrl;
  }, [captureResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw preview canvas whenever strokes or activeStroke update
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      drawStrokeOnCanvas(ctx, s, canvas.width, canvas.height);
    }
    if (activeStroke) {
      drawStrokeOnCanvas(ctx, activeStroke, canvas.width, canvas.height);
    }
  }, [strokes, activeStroke, mode]);

  const exportAnnotatedDataUrl = useCallback((): string | null => {
    if (!captureResult) return null;
    if (strokes.length === 0) return captureResult.dataUrl;

    const img = loadedImageRef.current;
    if (!img) return captureResult.dataUrl;

    const offscreen = document.createElement("canvas");
    offscreen.width = img.naturalWidth || captureResult.width;
    offscreen.height = img.naturalHeight || captureResult.height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return captureResult.dataUrl;

    ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
    for (const s of strokes) {
      drawStrokeOnCanvas(ctx, s, offscreen.width, offscreen.height);
    }
    return offscreen.toDataURL("image/png");
  }, [captureResult, strokes]);

  const handleCopy = async () => {
    const dataUrl = exportAnnotatedDataUrl();
    if (!dataUrl) return;
    const ok = await lumi.capture.copyDataUrl(dataUrl);
    if (ok) {
      setCopiedFlag(true);
      toast.success("Screenshot copied to clipboard");
      setTimeout(() => setCopiedFlag(false), 1600);
    } else {
      toast.error("Failed to copy screenshot");
    }
  };

  const handleSave = async () => {
    if (!captureResult) return;
    const dataUrl = exportAnnotatedDataUrl();
    if (!dataUrl) return;
    const res = await lumi.capture.savePng(dataUrl, captureResult.suggestedFilename);
    if (res.saved) {
      toast.success("Screenshot saved", { description: res.path });
      closeOverlay();
    }
  };

  const selectionBox =
    dragStart && dragEnd
      ? {
          left: Math.min(dragStart.x, dragEnd.x),
          top: Math.min(dragStart.y, dragEnd.y),
          width: Math.abs(dragEnd.x - dragStart.x),
          height: Math.abs(dragEnd.y - dragStart.y)
        }
      : null;

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    };
  };

  const previewAspectWidth = captureResult ? Math.min(820, Math.max(360, captureResult.width)) : 720;
  const previewAspectHeight =
    captureResult && captureResult.width > 0
      ? Math.round((previewAspectWidth / captureResult.width) * captureResult.height)
      : 480;

  return (
    <PortalComponent visible={mode !== "closed"} layerType="pageCaptureOverlay" autoFocus className="fixed inset-0">
      {mode === "select" && (
        <div
          className="dark relative h-screen w-screen cursor-crosshair bg-black/38 backdrop-blur-[1px] select-none"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("[data-capture-toolbar]")) return;
            const pt = { x: e.clientX, y: e.clientY };
            setDragStart(pt);
            setDragEnd(pt);
          }}
          onPointerMove={(e) => {
            if (!dragStart) return;
            setDragEnd({ x: e.clientX, y: e.clientY });
          }}
          onPointerUp={() => {
            if (!dragStart || !dragEnd) return;
            const left = Math.min(dragStart.x, dragEnd.x);
            const top = Math.min(dragStart.y, dragEnd.y);
            const width = Math.abs(dragEnd.x - dragStart.x);
            const height = Math.abs(dragEnd.y - dragStart.y);

            setDragStart(null);
            setDragEnd(null);

            if (width < 12 || height < 12) return;

            const originX = contentRect?.left ?? 0;
            const originY = contentRect?.top ?? 0;
            const maxW = contentRect?.width ?? window.innerWidth;
            const maxH = contentRect?.height ?? window.innerHeight;

            const relX = Math.max(0, Math.round(left - originX));
            const relY = Math.max(0, Math.round(top - originY));
            const clampedW = Math.min(Math.round(width), Math.max(10, Math.round(maxW - relX)));
            const clampedH = Math.min(Math.round(height), Math.max(10, Math.round(maxH - relY)));

            void runCapture("visible", {
              x: relX,
              y: relY,
              width: clampedW,
              height: clampedH
            });
          }}
        >
          {/* Floating Action Toolbar */}
          <div
            data-capture-toolbar
            className="fixed left-1/2 top-4 z-20 flex -translate-x-1/2 cursor-default items-center gap-1.5 rounded-full border border-white/18 bg-zinc-950/90 px-3 py-1.5 text-xs text-white shadow-2xl backdrop-blur-2xl"
          >
            <Camera className="size-3.5 text-blue-400" />
            <span className="pr-1 font-medium text-white/85">Drag to crop area</span>
            <span className="h-3.5 w-px bg-white/15" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs text-white hover:bg-white/15"
              onClick={() => void runCapture("visible")}
            >
              Visible Page
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs text-white hover:bg-white/15"
              onClick={() => void runCapture("full")}
            >
              Full Scroll Page
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-white/70 hover:bg-white/15 hover:text-white"
              onClick={closeOverlay}
              title="Cancel (Esc)"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {/* Selection Marquee */}
          {selectionBox && selectionBox.width >= 4 && selectionBox.height >= 4 && (
            <div
              className="pointer-events-none fixed rounded-lg border-2 border-blue-400 bg-blue-500/12 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={selectionBox}
            >
              <span className="absolute -bottom-7 left-0 rounded-md bg-zinc-950/90 px-2 py-0.5 font-mono text-[11px] text-white shadow">
                {Math.round(selectionBox.width)} × {Math.round(selectionBox.height)}
              </span>
            </div>
          )}
        </div>
      )}

      {mode === "annotate" && captureResult && (
        <div className="dark flex h-screen w-screen items-center justify-center bg-black/55 p-6 backdrop-blur-md select-none">
          <div className="flex max-h-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/16 bg-zinc-950/94 text-white shadow-2xl">
            {/* Annotation Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: "pen", label: "Pen", icon: Pencil },
                    { id: "highlighter", label: "Highlight", icon: Highlighter },
                    { id: "arrow", label: "Arrow", icon: ArrowUpRight },
                    { id: "rect", label: "Rectangle", icon: Square }
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = tool === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTool(item.id)}
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                        active
                          ? "bg-blue-500/25 text-blue-300 ring-1 ring-blue-400/50"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {item.label}
                    </button>
                  );
                })}

                <span className="mx-1.5 h-4 w-px bg-white/12" />

                <div className="flex items-center gap-1.5">
                  {COLORS.map((swatch) => (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() => setColor(swatch.hex)}
                      title={swatch.label}
                      className={cn(
                        "size-5 rounded-full border transition-transform",
                        color === swatch.hex
                          ? "scale-110 border-white ring-2 ring-white/40"
                          : "border-white/25 hover:scale-105"
                      )}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>

                <span className="mx-1.5 h-4 w-px bg-white/12" />

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-white/75 hover:bg-white/10"
                  onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                  disabled={strokes.length === 0}
                  title="Undo last stroke"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-white/75 hover:bg-white/10"
                  onClick={() => setStrokes([])}
                  disabled={strokes.length === 0}
                  title="Clear annotations"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-white/15 bg-white/6 text-xs text-white hover:bg-white/12"
                  onClick={() => void handleCopy()}
                >
                  {copiedFlag ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  {copiedFlag ? "Copied!" : "Copy Image"}
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-[#2563EB] text-xs text-white hover:bg-[#1D4ED8]"
                  onClick={() => void handleSave()}
                >
                  <Download className="size-3.5" />
                  Save PNG
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={closeOverlay}
                  title="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-zinc-900/75 p-4">
              <canvas
                ref={canvasRef}
                width={previewAspectWidth}
                height={previewAspectHeight}
                className="max-h-[70vh] max-w-full cursor-crosshair rounded-lg border border-white/12 shadow-lg object-contain"
                onPointerDown={(e) => {
                  const pt = getNormalizedPoint(e);
                  if (!pt) return;
                  setActiveStroke({ tool, color, points: [pt] });
                }}
                onPointerMove={(e) => {
                  if (!activeStroke) return;
                  const pt = getNormalizedPoint(e);
                  if (!pt) return;
                  setActiveStroke((prev) => {
                    if (!prev) return null;
                    if (prev.tool === "rect" || prev.tool === "arrow") {
                      return { ...prev, points: [prev.points[0], pt] };
                    }
                    return { ...prev, points: [...prev.points, pt] };
                  });
                }}
                onPointerUp={() => {
                  if (activeStroke && activeStroke.points.length > 0) {
                    setStrokes((prev) => [...prev, activeStroke]);
                  }
                  setActiveStroke(null);
                }}
                onPointerLeave={() => {
                  if (activeStroke && activeStroke.points.length > 0) {
                    setStrokes((prev) => [...prev, activeStroke]);
                  }
                  setActiveStroke(null);
                }}
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/8 px-4 py-1.5 text-[11px] text-white/55">
              <span className="truncate">{captureResult.title}</span>
              <span className="shrink-0 font-mono">
                {captureResult.width} × {captureResult.height} px
              </span>
            </div>
          </div>
        </div>
      )}
    </PortalComponent>
  );
}
