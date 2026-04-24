// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import Image from "next/image";
import {
  Camera,
  CameraOff,
  Download,
  Loader,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Layers,
  RotateCcw,
  Upload,
  ImageIcon,
  Trash2,
} from "lucide-react";

// ─── Style definitions ───────────────────────────────────────────────────────

interface StylePreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  thumbnailPath: string;
}

const STYLE_PRESETS: StylePreset[] = [
  { id: "anime", label: "Anime", emoji: "🎌", description: "Manga cel shading & vibrant colors", thumbnailPath: "/styles/anime.png" },
  { id: "van-gogh", label: "Van Gogh", emoji: "🎨", description: "Swirling brushstrokes & bold colors", thumbnailPath: "/styles/van-gogh.png" },
  { id: "monet", label: "Monet", emoji: "🌸", description: "Soft dreamy brushwork & haze", thumbnailPath: "/styles/monet.png" },
  { id: "picasso", label: "Picasso", emoji: "◆", description: "Cubist geometric shapes", thumbnailPath: "/styles/picasso.png" },
  { id: "watercolor", label: "Watercolor", emoji: "💧", description: "Soft flowing edges & bleeding colors", thumbnailPath: "/styles/watercolor.png" },
  { id: "sketch", label: "Sketch", emoji: "✏️", description: "Pencil linework & cross-hatching", thumbnailPath: "/styles/sketch.png" },
  { id: "cyberpunk", label: "Cyberpunk", emoji: "🔮", description: "Neon futuristic tech-noir", thumbnailPath: "/styles/cyberpunk.png" },
  { id: "pixel-art", label: "Pixel Art", emoji: "👾", description: "8-bit retro chunky pixels", thumbnailPath: "/styles/pixel-art.png" },
  { id: "oil-painting", label: "Oil Painting", emoji: "🖼️", description: "Classical rich textures & drama", thumbnailPath: "/styles/oil-painting.png" },
];

const STYLE_GRID_COLS = 3;

// ─── Job status types ─────────────────────────────────────────────────────────

interface StyleJob {
  style: string;
  promptId: string;
  status: "queued" | "running" | "success" | "error" | "pending";
  imageUrl?: string;
  imageData?: { filename: string; subfolder: string; type: string };
  error?: string;
}

// ─── Gallery persistence ────────────────────────────────────────────────────

interface GalleryEntry {
  promptId: string;
  style: string;
  imageUrl: string;
  imageData: { filename: string; subfolder: string; type: string };
  timestamp: number;
}

const GALLERY_KEY = "rocclaw-photobooth-gallery";
const GALLERY_MAX = 50;

function loadGallery(): GalleryEntry[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── ComfyUI health ──────────────────────────────────────────────────────────

type ComfyUIStatus = "checking" | "online" | "offline";

async function checkComfyUIStatus(): Promise<ComfyUIStatus> {
  try {
    const res = await fetch("/api/photobooth", { signal: AbortSignal.timeout(5000) });
    return res.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PhotoBoothDashboard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);

  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<StyleJob[]>([]);
  const [processing, setProcessing] = useState(false);
  const [comfyuiStatus, setComfyUIStatus] = useState<ComfyUIStatus>("checking");

  // Gallery persistence
  const [gallery, setGallery] = useState<GalleryEntry[]>(loadGallery);

  // Tracks a pending stream to attach after video element mounts
  const pendingStreamRef = useRef<MediaStream | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Style grid keyboard navigation refs
  const styleButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // ── Persist gallery to localStorage ──────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
    } catch { /* storage full — ignore */ }
  }, [gallery]);

  // ── Check ComfyUI on mount ──────────────────────────────────────────────
  useEffect(() => {
    void checkComfyUIStatus().then(setComfyUIStatus);
    const interval = setInterval(() => { void checkComfyUIStatus().then(setComfyUIStatus); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Attach pending stream to video element after mount ──────────────────
  useEffect(() => {
    if (cameraActive && pendingStreamRef.current && videoRef.current) {
      const video = videoRef.current;
      const stream = pendingStreamRef.current;
      pendingStreamRef.current = null;

      video.srcObject = stream;

      const onCanPlay = async () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("error", onError);
        try { await video.play(); setCameraReady(true); } catch { /* play failed */ }
      };
      const onError = () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("error", onError);
        setCameraError("Video failed to load");
      };
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("error", onError);

      // Safety timeout
      setTimeout(() => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("error", onError);
        if (!cameraReady) setCameraReady(true); // force ready
      }, 5000);
    }
  }, [cameraActive, cameraReady]);

  // ── Load image from file ─────────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      setCapturedImage(dataUrl);
      setCapturedImageBase64(base64);
      setJobs([]);
      setProcessing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  // ── Start camera ────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);

      // Release any existing stream before requesting a new one.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;

      // Attempt 1: specific constraints (user-facing, 1024x1024)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1024 }, height: { ideal: 1024 }, facingMode: "user" },
          audio: false,
        });
      } catch {
        // Attempt 2: drop facingMode (desktop with single webcam)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1024 }, height: { ideal: 1024 } },
            audio: false,
          });
        } catch {
          // Attempt 3: minimal constraints — accept whatever the browser offers
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      streamRef.current = stream;
      // Store stream and mark active — the useEffect above will attach it
      pendingStreamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof DOMException
        ? {
            NotAllowedError: "Camera access denied — check browser permissions",
            NotFoundError: "No camera found — is it connected?",
            NotReadableError: "Camera is in use by another app",
            OverconstrainedError: "Camera doesn't support requested resolution",
            SecurityError: "Camera access blocked by browser security policy",
          }[err.name] ?? `Camera error: ${err.name}`
        : err instanceof Error
          ? err.message
          : "Failed to access camera";

      setCameraActive(false);
      setCameraReady(false);
      setCameraError(msg);
    }
  }, []);

  // ── Stop camera ──────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    pendingStreamRef.current = null;
    setCameraActive(false);
    setCameraReady(false);
    setCameraError(null);
  }, []);

  // ── Capture photo ────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    setCapturedImage(dataUrl);
    setCapturedImageBase64(base64);
    setJobs([]);
  }, []);

  // ── Clear capture ─────────────────────────────────────────────────────────
  const clearCapture = useCallback(() => {
    setCapturedImage(null);
    setCapturedImageBase64(null);
    setJobs([]);
    setProcessing(false);
  }, []);

  // ── Style selection ──────────────────────────────────────────────────────
  const toggleStyle = useCallback((styleId: string) => {
    setSelectedStyles((prev) => { const n = new Set(prev); if (n.has(styleId)) n.delete(styleId); else n.add(styleId); return n; });
  }, []);

  const selectAllStyles = useCallback(() => { setSelectedStyles(new Set(STYLE_PRESETS.map((s) => s.id))); }, []);
  const deselectAllStyles = useCallback(() => { setSelectedStyles(new Set()); }, []);

  // ── Persist completed job to gallery ──────────────────────────────────────
  const persistToGallery = useCallback((job: StyleJob) => {
    const { imageUrl, imageData } = job;
    if (job.status !== "success" || !imageUrl || !imageData) return;
    const promptId = job.promptId;
    const style = job.style;
    setGallery((prev) => {
      if (prev.some((g) => g.promptId === promptId)) return prev;
      const entry: GalleryEntry = {
        promptId,
        style,
        imageUrl,
        imageData,
        timestamp: Date.now(),
      };
      return [entry, ...prev].slice(0, GALLERY_MAX);
    });
  }, []);

  // ── Generate styles ──────────────────────────────────────────────────────
  const generateStyles = useCallback(async () => {
    if (!capturedImageBase64 || selectedStyles.size === 0 || comfyuiStatus !== "online") return;

    setProcessing(true);
    setJobs([]);

    try {
      const res = await fetch("/api/photobooth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: capturedImageBase64, styles: Array.from(selectedStyles) }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        setJobs(Array.from(selectedStyles).map((style) => ({ style, promptId: "", status: "error" as const, error: errData.error ?? "Failed to queue" })));
        setProcessing(false);
        return;
      }

      const data = await res.json();
      const initialJobs: StyleJob[] = (data.jobs ?? []).map(
        (job: { style: string; promptId: string }) => ({ style: job.style, promptId: job.promptId, status: "queued" as const })
      );
      setJobs(initialJobs);

      if (pollingRef.current) clearInterval(pollingRef.current);

      const pollJobs = async () => {
        let allDone = true;
        const currentJobs = await new Promise<StyleJob[]>((resolve) => {
          setJobs((prev) => { resolve(prev); return prev; });
        });
        const updated = [...currentJobs];
        for (let i = 0; i < updated.length; i++) {
          const job = updated[i];
          if (job.status === "success" || job.status === "error") continue;
          allDone = false;
          try {
            const sr = await fetch(`/api/photobooth/status?promptId=${encodeURIComponent(job.promptId)}`);
            const sd = await sr.json();
            if (sd.status === "success" && sd.images?.length > 0) {
              const img = sd.images[0];
              const completedJob: StyleJob = { ...job, status: "success", imageUrl: `/api/photobooth/image?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder ?? "")}&type=${encodeURIComponent(img.type ?? "output")}`, imageData: img };
              updated[i] = completedJob;
              persistToGallery(completedJob);
            } else if (sd.status === "error") {
              updated[i] = { ...job, status: "error", error: sd.error ?? "Generation failed" };
            } else {
              updated[i] = { ...job, status: sd.status === "running" ? "running" : "queued" };
            }
          } catch { /* keep */ }
        }
        setJobs(updated);
        if (allDone) { if (pollingRef.current) clearInterval(pollingRef.current); setProcessing(false); }
      };

      pollingRef.current = setInterval(pollJobs, 2000);
      void pollJobs();
    } catch {
      setJobs(Array.from(selectedStyles).map((style) => ({ style, promptId: "", status: "error" as const, error: "Failed to connect to ComfyUI" })));
      setProcessing(false);
    }
  }, [capturedImageBase64, selectedStyles, comfyuiStatus, persistToGallery]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCamera(); if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [stopCamera]);

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadImage = useCallback(async (imageUrl: string, style: string) => {
    try {
      const res = await fetch(imageUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `photobooth_${style}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(imageUrl, "_blank"); }
  }, []);

  // ── Clear gallery ─────────────────────────────────────────────────────────
  const clearGallery = useCallback(() => {
    setGallery([]);
  }, []);

  // ── Style grid keyboard navigation ────────────────────────────────────────
  const handleStyleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let targetIndex: number | null = null;
    const total = STYLE_PRESETS.length;

    switch (e.key) {
      case "ArrowRight":
        targetIndex = index + 1 < total ? index + 1 : 0;
        break;
      case "ArrowLeft":
        targetIndex = index - 1 >= 0 ? index - 1 : total - 1;
        break;
      case "ArrowDown":
        targetIndex = index + STYLE_GRID_COLS < total ? index + STYLE_GRID_COLS : index;
        break;
      case "ArrowUp":
        targetIndex = index - STYLE_GRID_COLS >= 0 ? index - STYLE_GRID_COLS : index;
        break;
      default:
        return;
    }

    e.preventDefault();
    const targetId = STYLE_PRESETS[targetIndex].id;
    styleButtonRefs.current.get(targetId)?.focus();
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────
  const completedCount = useMemo(() => jobs.filter((j) => j.status === "success").length, [jobs]);
  const failedCount = useMemo(() => jobs.filter((j) => j.status === "error").length, [jobs]);
  const allDone = useMemo(() => jobs.length > 0 && jobs.every((j) => j.status === "success" || j.status === "error"), [jobs]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col overflow-hidden" aria-label="Photo Booth">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="type-secondary-heading text-foreground">Photo Booth</h2>
          <span className="font-mono text-[10px] text-muted-foreground">SDXL style transfer</span>
          <div aria-live="polite">
            {processing && (
              <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Loader className="h-3 w-3 animate-spin" /> {completedCount}/{jobs.length}
              </span>
            )}
            {allDone && (
              <span className="flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                <CheckCircle className="h-3 w-3" /> {completedCount} done{failedCount > 0 && ` · ${failedCount} failed`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium ${
            comfyuiStatus === "online" ? "border-green-500/30 bg-green-500/10 text-green-400"
              : comfyuiStatus === "offline" ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-border bg-surface-2 text-muted-foreground"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${comfyuiStatus === "online" ? "bg-green-400" : comfyuiStatus === "offline" ? "bg-red-400" : "bg-muted-foreground animate-pulse"}`} />
            ComfyUI
          </div>
        </div>
      </div>

      {/* ── Two columns (stacked on mobile) ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 overflow-hidden">

        {/* ═══════ LEFT COLUMN ═══════ */}
        <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-border overflow-hidden">

          {/* ── Row 1: Camera ── */}
          <div className="flex flex-col items-center justify-center gap-2 border-b border-border p-3 shrink-0">
            <div className="relative w-full max-w-[240px] overflow-hidden rounded-xl border-2 border-border bg-black" style={{ aspectRatio: "1 / 1" }}>
              {/* Video always in DOM */}
              <video
                ref={videoRef}
                playsInline
                muted
                width={1024}
                height={1024}
                style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                  objectFit: "cover", transform: "scaleX(-1)",
                  visibility: cameraActive && !capturedImage ? "visible" : "hidden",
                }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Shutter button */}
              {cameraActive && !capturedImage && (
                <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                  <button onClick={capturePhoto} disabled={!cameraReady}
                    aria-label="Take photo"
                    className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-lg backdrop-blur-sm transition-all hover:bg-white/40 hover:scale-105 active:scale-95 disabled:opacity-30"
                    title="Take photo">
                    <div className="h-6 w-6 rounded-full border-2 border-white bg-white/80" />
                  </button>
                </div>
              )}

              {/* Captured image */}
              {capturedImage && (
                <img src={capturedImage} alt="Captured" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              )}

              {/* Empty state */}
              {!cameraActive && !capturedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
                  <ImageIcon className="h-8 w-8 text-white/20" />
                  <p className="text-[10px] text-white/30">Camera or load image</p>
                  {cameraError && (
                    <div role="alert" className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[8px] text-red-400">
                      <AlertTriangle className="h-3 w-3" /> {cameraError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input controls */}
            <div className="flex items-center gap-1.5">
              {!cameraActive ? (
                <>
                  <button onClick={startCamera}
                    aria-label="Start camera"
                    className="ui-btn-primary flex items-center gap-1.5 !min-h-0 px-3 py-1.5 text-[11px] font-semibold shadow-sm">
                    <Camera className="h-3.5 w-3.5" /> Camera
                  </button>
                  <button onClick={() => fileInputRef.current?.click()}
                    aria-label="Load image from file"
                    className="ui-btn-secondary flex items-center gap-1.5 !min-h-0 px-3 py-1.5 text-[11px] font-medium shadow-sm">
                    <Upload className="h-3.5 w-3.5" /> Load Image
                  </button>
                </>
              ) : capturedImage ? (
                <>
                  <button onClick={clearCapture}
                    aria-label="Retake photo"
                    className="ui-btn-secondary flex items-center gap-1 !min-h-0 px-2.5 py-1.5 text-[11px] font-medium">
                    <RotateCcw className="h-3 w-3" /> Retake
                  </button>
                  <button onClick={stopCamera}
                    aria-label="Stop camera"
                    className="ui-btn-secondary flex items-center gap-1 !min-h-0 px-2 py-1.5 text-[11px]">
                    <CameraOff className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <button onClick={stopCamera}
                  aria-label="Stop camera"
                  className="ui-btn-secondary flex items-center gap-1 !min-h-0 px-3 py-1.5 text-[11px] font-medium">
                  <CameraOff className="h-3 w-3" /> Stop
                </button>
              )}
            </div>
          </div>

          {/* ── Row 2: Styles + Generate (fills remaining space) ── */}
          <div className="flex flex-1 flex-col p-3 min-h-0 gap-2">
            {/* Style header */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <h3 className="type-secondary-heading text-foreground" style={{ fontSize: "12px" }}>Styles</h3>
                <span className="font-mono text-[9px] text-muted-foreground">{selectedStyles.size}/{STYLE_PRESETS.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={selectAllStyles}
                  aria-label="Select all styles"
                  className="ui-btn-secondary flex items-center gap-0.5 !min-h-0 px-1.5 py-0.5 text-[9px] font-medium">
                  <Layers className="h-2.5 w-2.5" /> All
                </button>
                <button onClick={deselectAllStyles}
                  aria-label="Deselect all styles"
                  className="ui-btn-secondary flex items-center !min-h-0 px-1.5 py-0.5 text-[9px] font-medium">None</button>
              </div>
            </div>

            {/* 3×3 style grid — fills available space */}
            <div className="grid flex-1 grid-cols-2 sm:grid-cols-3 gap-1.5 min-h-0" role="group" aria-label="Style presets">
              {STYLE_PRESETS.map((style, index) => {
                const isSelected = selectedStyles.has(style.id);
                const job = jobs.find((j) => j.style === style.id);
                const isProcessing = job?.status === "queued" || job?.status === "running";

                return (
                  <button key={style.id}
                    ref={(el) => { if (el) styleButtonRefs.current.set(style.id, el); else styleButtonRefs.current.delete(style.id); }}
                    onClick={() => !processing && toggleStyle(style.id)}
                    onKeyDown={(e) => handleStyleKeyDown(e, index)}
                    disabled={processing}
                    aria-pressed={isSelected}
                    aria-label={`${style.label} - ${style.description}`}
                    className={`group relative overflow-hidden rounded-lg transition-all ${
                      isSelected ? "ui-card-selected"
                        : isProcessing ? "ui-card ring-1 ring-accent/30"
                          : "ui-card hover:border-accent/40"
                    } ${processing ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  >
                    <div className="relative h-full w-full overflow-hidden bg-surface-2">
                      <Image src={style.thumbnailPath} alt={style.label} width={128} height={128} className="h-full w-full object-cover" unoptimized />
                      {isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <Loader className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
                      {job?.status === "success" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/25">
                          <CheckCircle className="h-4 w-4 text-green-400 drop-shadow" />
                        </div>
                      )}
                      {job?.status === "error" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/25">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 drop-shadow" />
                        </div>
                      )}
                      {isSelected && !isProcessing && job?.status !== "success" && (
                        <div className="absolute left-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary shadow">
                          <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-0.5 pb-px pt-3">
                        <span className="text-[8px] font-semibold text-white drop-shadow-md leading-none">{style.emoji} {style.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Generate + Load Image */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={generateStyles}
                disabled={!capturedImageBase64 || selectedStyles.size === 0 || processing || comfyuiStatus !== "online"}
                aria-busy={processing}
                aria-label={processing ? `Generating ${completedCount} of ${jobs.length}` : `Generate ${selectedStyles.size} styles`}
                className="ui-btn-primary flex flex-1 items-center justify-center gap-1.5 !min-h-0 px-3 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                {processing
                  ? <><Loader className="h-3.5 w-3.5 animate-spin" /> {completedCount}/{jobs.length}...</>
                  : <><Zap className="h-3.5 w-3.5" /> Generate{selectedStyles.size > 0 ? ` ${selectedStyles.size}` : ""}</>
                }
              </button>
              {allDone && (
                <button onClick={clearCapture}
                  aria-label="Reset and start over"
                  className="ui-btn-secondary flex items-center gap-1 !min-h-0 px-2 py-2 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!capturedImage && !cameraActive && (
              <button onClick={() => fileInputRef.current?.click()}
                aria-label="Load an image from disk"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-2/50 px-3 py-1.5 text-[10px] text-muted-foreground hover:border-accent/40 hover:text-foreground shrink-0">
                <Upload className="h-3 w-3" /> Or load an image from disk
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" aria-hidden="true" />

            {processing && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground shrink-0">
                <Clock className="h-2.5 w-2.5" /> ~15-30s per style
              </div>
            )}
          </div>
        </div>

        {/* ═══════ RIGHT COLUMN: Output + Gallery ═══════ */}
        <div className="flex flex-col overflow-hidden" aria-label="Generated images">
          {jobs.length === 0 && gallery.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-2">
                <Sparkles className="h-10 w-10 text-muted-foreground/20" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Styled outputs appear here</p>
                <p className="mt-1 text-[11px] text-muted-foreground/50">Select styles and click Generate</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3" aria-live="polite">
              {/* Current jobs */}
              {jobs.length > 0 && (
                <div className="grid gap-2 mb-3"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))` }}
                >
                  {jobs.map((job) => {
                    const preset = STYLE_PRESETS.find((s) => s.id === job.style);
                    if (!preset) return null;

                    return (
                      <div key={job.promptId || job.style}
                        className={`ui-card group relative overflow-hidden transition-all ${
                          job.status === "success" ? "border-green-500/20 shadow-sm hover:shadow-md"
                            : job.status === "error" ? "border-red-500/30"
                              : "border-accent/30 animate-pulse"
                        }`}
                      >
                        <div className="relative w-full overflow-hidden bg-surface-2" style={{ aspectRatio: "1 / 1" }}>
                          {job.status === "success" && job.imageUrl ? (
                            <>
                              <img src={job.imageUrl} alt={preset.label} className="h-full w-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-1.5 pb-1 pt-5">
                                <span className="text-[10px] font-bold text-white drop-shadow-lg">{preset.emoji} {preset.label}</span>
                              </div>
                              <button onClick={() => downloadImage(job.imageUrl!, job.style)}
                                aria-label={`Download ${preset.label}`}
                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/60"
                                title="Download">
                                <Download className="h-3 w-3" />
                              </button>
                            </>
                          ) : job.status === "error" ? (
                            <div className="flex h-full flex-col items-center justify-center gap-1 bg-red-500/5 p-2 text-center">
                              <AlertTriangle className="h-5 w-5 text-red-400" />
                              <span className="text-[9px] font-medium text-red-400">{preset.emoji} {preset.label}</span>
                              <span className="text-[8px] text-red-400/60">{job.error ?? "Failed"}</span>
                            </div>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-1 bg-surface-2/50">
                              <Loader className="h-5 w-5 animate-spin text-primary" />
                              <span className="text-[9px] text-muted-foreground">{preset.emoji} {preset.label}</span>
                              <span className="text-[8px] text-muted-foreground/50">{job.status === "running" ? "Generating..." : "Queued"}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Gallery (persisted past generations) */}
              {gallery.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="type-secondary-heading text-muted-foreground" style={{ fontSize: "11px" }}>Gallery</h3>
                      <span className="font-mono text-[9px] text-muted-foreground/60">{gallery.length}</span>
                    </div>
                    <button onClick={clearGallery}
                      aria-label="Clear gallery"
                      className="ui-btn-ghost flex items-center gap-1 !min-h-0 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground">
                      <Trash2 className="h-2.5 w-2.5" /> Clear
                    </button>
                  </div>
                  <div className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))` }}
                  >
                    {gallery.map((entry) => {
                      const preset = STYLE_PRESETS.find((s) => s.id === entry.style);
                      return (
                        <div key={entry.promptId}
                          className="ui-card group relative overflow-hidden border-green-500/10 shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="relative w-full overflow-hidden bg-surface-2" style={{ aspectRatio: "1 / 1" }}>
                            <img
                              src={entry.imageUrl}
                              alt={preset?.label ?? entry.style}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = "none";
                                const fallback = target.nextElementSibling;
                                if (fallback instanceof HTMLElement) fallback.style.display = "flex";
                              }}
                            />
                            <div className="hidden h-full flex-col items-center justify-center gap-1 bg-surface-2 p-2 text-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                              <span className="text-[8px] text-muted-foreground/50">Image unavailable</span>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-1.5 pb-1 pt-5">
                              <span className="text-[10px] font-bold text-white drop-shadow-lg">{preset?.emoji ?? ""} {preset?.label ?? entry.style}</span>
                            </div>
                            <button onClick={() => downloadImage(entry.imageUrl, entry.style)}
                              aria-label={`Download ${preset?.label ?? entry.style}`}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/60"
                              title="Download">
                              <Download className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
