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

// ─── Job status types ─────────────────────────────────────────────────────────

interface StyleJob {
  style: string;
  promptId: string;
  status: "queued" | "running" | "success" | "error" | "pending";
  imageUrl?: string;
  imageData?: { filename: string; subfolder: string; type: string };
  error?: string;
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

  // Tracks a pending stream to attach after video element mounts
  const pendingStreamRef = useRef<MediaStream | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1024 }, height: { ideal: 1024 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      // Store stream and mark active — the useEffect above will attach it
      pendingStreamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      setCameraActive(false);
      setCameraReady(false);
      setCameraError(err instanceof Error ? err.message : "Failed to access camera");
    }
  }, []);

  // ── Stop camera ──────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    pendingStreamRef.current = null;
    setCameraActive(false);
    setCameraReady(false);
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
              updated[i] = { ...job, status: "success", imageUrl: `/api/photobooth/image?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder ?? "")}&type=${encodeURIComponent(img.type ?? "output")}`, imageData: img };
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
  }, [capturedImageBase64, selectedStyles, comfyuiStatus]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCamera(); if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [stopCamera]);

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadImage = useCallback(async (job: StyleJob) => {
    if (!job.imageUrl) return;
    try {
      const res = await fetch(job.imageUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `photobooth_${job.style}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(job.imageUrl, "_blank"); }
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────
  const completedCount = useMemo(() => jobs.filter((j) => j.status === "success").length, [jobs]);
  const failedCount = useMemo(() => jobs.filter((j) => j.status === "error").length, [jobs]);
  const allDone = useMemo(() => jobs.length > 0 && jobs.every((j) => j.status === "success" || j.status === "error"), [jobs]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface-1 shadow-sm">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Photo Booth</h2>
          <span className="font-mono text-[10px] text-muted-foreground">SDXL style transfer</span>
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

      {/* ── Two equal columns ── */}
      <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">

        {/* ═══════ LEFT COLUMN ═══════ */}
        <div className="flex flex-col border-r border-border overflow-hidden">

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
                    <div className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[8px] text-red-400">
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
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm hover:opacity-90">
                    <Camera className="h-3.5 w-3.5" /> Camera
                  </button>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground shadow-sm">
                    <Upload className="h-3.5 w-3.5" /> Load Image
                  </button>
                </>
              ) : capturedImage ? (
                <>
                  <button onClick={clearCapture} className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3" /> Retake
                  </button>
                  <button onClick={stopCamera} className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                    <CameraOff className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <button onClick={stopCamera} className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
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
                <h3 className="text-xs font-semibold text-foreground">Styles</h3>
                <span className="font-mono text-[9px] text-muted-foreground">{selectedStyles.size}/{STYLE_PRESETS.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={selectAllStyles} className="flex items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-foreground">
                  <Layers className="h-2.5 w-2.5" /> All
                </button>
                <button onClick={deselectAllStyles} className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-foreground">None</button>
              </div>
            </div>

            {/* 3×3 style grid — fills available space */}
            <div className="grid flex-1 grid-cols-3 gap-1.5 min-h-0">
              {STYLE_PRESETS.map((style) => {
                const isSelected = selectedStyles.has(style.id);
                const job = jobs.find((j) => j.style === style.id);
                const isProcessing = job?.status === "queued" || job?.status === "running";

                return (
                  <button key={style.id}
                    onClick={() => !processing && toggleStyle(style.id)}
                    disabled={processing}
                    className={`group relative overflow-hidden rounded-lg border transition-all ${
                      isSelected ? "border-primary ring-2 ring-primary/40"
                        : isProcessing ? "border-accent ring-1 ring-accent/30"
                          : "border-border hover:border-accent/40"
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                {processing
                  ? <><Loader className="h-3.5 w-3.5 animate-spin" /> {completedCount}/{jobs.length}...</>
                  : <><Zap className="h-3.5 w-3.5" /> Generate{selectedStyles.size > 0 ? ` ${selectedStyles.size}` : ""}</>
                }
              </button>
              {allDone && (
                <button onClick={clearCapture} className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!capturedImage && !cameraActive && (
              <button onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-2/50 px-3 py-1.5 text-[10px] text-muted-foreground hover:border-accent/40 hover:text-foreground shrink-0">
                <Upload className="h-3 w-3" /> Or load an image from disk
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

            {processing && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground shrink-0">
                <Clock className="h-2.5 w-2.5" /> ~15-30s per style
              </div>
            )}
          </div>
        </div>

        {/* ═══════ RIGHT COLUMN: Output ═══════ */}
        <div className="flex flex-col overflow-hidden">
          {jobs.length === 0 ? (
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
            <div className="grid flex-1 auto-rows-fr gap-2 p-3 overflow-y-auto"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(120px, 1fr))` }}
            >
              {jobs.map((job) => {
                const preset = STYLE_PRESETS.find((s) => s.id === job.style);
                if (!preset) return null;

                return (
                  <div key={job.promptId || job.style}
                    className={`group relative overflow-hidden rounded-xl border transition-all ${
                      job.status === "success" ? "border-green-500/20 bg-surface-1 shadow-sm hover:shadow-md"
                        : job.status === "error" ? "border-red-500/30 bg-surface-1"
                          : "border-accent/30 bg-surface-1 animate-pulse"
                    }`}
                  >
                    <div className="relative w-full overflow-hidden bg-surface-2" style={{ aspectRatio: "1 / 1" }}>
                      {job.status === "success" && job.imageUrl ? (
                        <>
                          <img src={job.imageUrl} alt={preset.label} className="h-full w-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-1.5 pb-1 pt-5">
                            <span className="text-[10px] font-bold text-white drop-shadow-lg">{preset.emoji} {preset.label}</span>
                          </div>
                          <button onClick={() => downloadImage(job)}
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
        </div>
      </div>
    </div>
  );
}