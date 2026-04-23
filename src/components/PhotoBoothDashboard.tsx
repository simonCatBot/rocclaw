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
  X,
  CheckCircle,
  Clock,
  Zap,
  Layers,
  RotateCcw,
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
  {
    id: "anime",
    label: "Anime",
    emoji: "🎌",
    description: "Manga aesthetic with cel shading and vibrant colors",
    thumbnailPath: "/styles/anime.png",
  },
  {
    id: "van-gogh",
    label: "Van Gogh",
    emoji: "🎨",
    description: "Post-impressionist swirling brushstrokes and bold colors",
    thumbnailPath: "/styles/van-gogh.png",
  },
  {
    id: "monet",
    label: "Monet",
    emoji: "🌸",
    description: "Impressionist soft dreamy brushwork and atmospheric haze",
    thumbnailPath: "/styles/monet.png",
  },
  {
    id: "picasso",
    label: "Picasso",
    emoji: "◆",
    description: "Cubist geometric shapes and fragmented bold forms",
    thumbnailPath: "/styles/picasso.png",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    emoji: "💧",
    description: "Soft flowing edges with bleeding colors on paper texture",
    thumbnailPath: "/styles/watercolor.png",
  },
  {
    id: "sketch",
    label: "Sketch",
    emoji: "✏️",
    description: "Pencil drawing with detailed linework and cross-hatching",
    thumbnailPath: "/styles/sketch.png",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    emoji: "🔮",
    description: "Neon futuristic with holographic elements and tech-noir vibe",
    thumbnailPath: "/styles/cyberpunk.png",
  },
  {
    id: "pixel-art",
    label: "Pixel Art",
    emoji: "👾",
    description: "8-bit retro aesthetic with chunky pixels and limited palette",
    thumbnailPath: "/styles/pixel-art.png",
  },
  {
    id: "oil-painting",
    label: "Oil Painting",
    emoji: "🖼️",
    description: "Classical rich textures with dramatic lighting and thick strokes",
    thumbnailPath: "/styles/oil-painting.png",
  },
];

// ─── Job status types ─────────────────────────────────────────────────────────

interface StyleJob {
  style: string;
  promptId: string;
  status: "queued" | "running" | "success" | "error" | "pending";
  imageUrl?: string;
  imageData?: {
    filename: string;
    subfolder: string;
    type: string;
  };
  error?: string;
}

// ─── ComfyUI health ──────────────────────────────────────────────────────────

type ComfyUIStatus = "checking" | "online" | "offline";

async function checkComfyUIStatus(): Promise<ComfyUIStatus> {
  try {
    const res = await fetch("/api/photobooth", { signal: AbortSignal.timeout(5000) });
    if (res.ok) return "online";
    return "offline";
  } catch {
    return "offline";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PhotoBoothDashboard() {
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false); // true once video is actually playing
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);

  // Processing state
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<StyleJob[]>([]);
  const [processing, setProcessing] = useState(false);
  const [comfyuiStatus, setComfyUIStatus] = useState<ComfyUIStatus>("checking");

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check ComfyUI on mount ──────────────────────────────────────────────
  useEffect(() => {
    void checkComfyUIStatus().then(setComfyUIStatus);
    const interval = setInterval(() => {
      void checkComfyUIStatus().then(setComfyUIStatus);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Start camera ────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1024 },
          height: { ideal: 1024 },
          facingMode: "user",
        },
        audio: false,
      });
      // Store the stream
      streamRef.current = stream;
      // Mark camera as active so the video element renders
      setCameraActive(true);

      // Wait a tick for React to mount the video element, then attach the stream
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setCameraActive(false);
        setCameraError("Video element not available. Please try again.");
        return;
      }

      video.srcObject = stream;

      // Wait for the video to actually start playing
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          reject(new Error("Video failed to load"));
        };
        video.addEventListener("canplay", onCanPlay);
        video.addEventListener("error", onError);
        // Timeout fallback — resolve anyway after 5s
        setTimeout(() => {
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          resolve();
        }, 5000);
      });

      await video.play();
      setCameraReady(true);
    } catch (err) {
      setCameraActive(false);
      setCameraReady(false);
      setCameraError(
        err instanceof Error ? err.message : "Failed to access camera"
      );
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
    setCameraActive(false);
    setCameraReady(false);
  }, []);

  // ── Capture photo ────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Use the smaller of video dimensions to create a square crop
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the image horizontally (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // Crop to center square from the video feed
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

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
    // Camera stays active — just clear the photo so user can take another
  }, []);

  // ── Toggle style selection ───────────────────────────────────────────────
  const toggleStyle = useCallback((styleId: string) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(styleId)) next.delete(styleId);
      else next.add(styleId);
      return next;
    });
  }, []);

  // ── Select all styles ────────────────────────────────────────────────────
  const selectAllStyles = useCallback(() => {
    setSelectedStyles(new Set(STYLE_PRESETS.map((s) => s.id)));
  }, []);

  // ── Deselect all styles ─────────────────────────────────────────────────
  const deselectAllStyles = useCallback(() => {
    setSelectedStyles(new Set());
  }, []);

  // ── Submit styles for generation ─────────────────────────────────────────
  const generateStyles = useCallback(async () => {
    if (!capturedImageBase64) return;
    if (selectedStyles.size === 0) return;
    if (comfyuiStatus !== "online") return;

    setProcessing(true);
    setJobs([]);

    try {
      const res = await fetch("/api/photobooth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: capturedImageBase64,
          styles: Array.from(selectedStyles),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        setJobs(
          Array.from(selectedStyles).map((style) => ({
            style,
            promptId: "",
            status: "error" as const,
            error: errData.error ?? "Failed to queue generation",
          }))
        );
        setProcessing(false);
        return;
      }

      const data = await res.json();

      const initialJobs: StyleJob[] = (data.jobs ?? []).map(
        (job: { style: string; promptId: string }) => ({
          style: job.style,
          promptId: job.promptId,
          status: "queued" as const,
        })
      );

      setJobs(initialJobs);

      // Start polling for status
      if (pollingRef.current) clearInterval(pollingRef.current);

      const pollJobs = async () => {
        let allDone = true;
        const currentJobs = await new Promise<StyleJob[]>((resolve) => {
          setJobs((prevJobs) => {
            resolve(prevJobs);
            return prevJobs;
          });
        });

        const updatedJobs = [...currentJobs];
        for (let i = 0; i < updatedJobs.length; i++) {
          const job = updatedJobs[i];
          if (job.status === "success" || job.status === "error") continue;

          allDone = false;
          try {
            const statusRes = await fetch(
              `/api/photobooth/status?promptId=${encodeURIComponent(job.promptId)}`
            );
            const statusData = await statusRes.json();

            if (statusData.status === "success" && statusData.images?.length > 0) {
              const img = statusData.images[0];
              const imageUrl = `/api/photobooth/image?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder ?? "")}&type=${encodeURIComponent(img.type ?? "output")}`;
              updatedJobs[i] = {
                ...job,
                status: "success",
                imageUrl,
                imageData: img,
              };
            } else if (statusData.status === "error") {
              updatedJobs[i] = {
                ...job,
                status: "error",
                error: statusData.error ?? "Generation failed",
              };
            } else {
              updatedJobs[i] = {
                ...job,
                status: statusData.status === "running" ? "running" : "queued",
              };
            }
          } catch {
            // Keep current status on network error
          }
        }

        setJobs(updatedJobs);

        if (allDone) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setProcessing(false);
        }
      };

      pollingRef.current = setInterval(pollJobs, 2000);
      // Also poll immediately
      void pollJobs();
    } catch {
      setJobs(
        Array.from(selectedStyles).map((style) => ({
          style,
          promptId: "",
          status: "error" as const,
          error: "Failed to connect to ComfyUI",
        }))
      );
      setProcessing(false);
    }
  }, [capturedImageBase64, selectedStyles, comfyuiStatus]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [stopCamera]);

  // ── Download result ──────────────────────────────────────────────────────
  const downloadImage = useCallback(async (job: StyleJob) => {
    if (!job.imageUrl) return;
    try {
      const res = await fetch(job.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photobooth_${job.style}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(job.imageUrl, "_blank");
    }
  }, []);

  // ── Computed values ──────────────────────────────────────────────────────
  const completedCount = useMemo(
    () => jobs.filter((j) => j.status === "success").length,
    [jobs]
  );
  const failedCount = useMemo(
    () => jobs.filter((j) => j.status === "error").length,
    [jobs]
  );
  const allDone = useMemo(
    () =>
      jobs.length > 0 &&
      jobs.every((j) => j.status === "success" || j.status === "error"),
    [jobs]
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Photo Booth</h2>
          <span className="font-mono text-[10px] text-muted-foreground">
            Local camera · SDXL style transfer
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* ComfyUI status indicator */}
          <div
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium ${
              comfyuiStatus === "online"
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : comfyuiStatus === "offline"
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-border bg-surface-2 text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                comfyuiStatus === "online"
                  ? "bg-green-400"
                  : comfyuiStatus === "offline"
                    ? "bg-red-400"
                    : "bg-muted-foreground animate-pulse"
              }`}
            />
            ComfyUI
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Left panel: Camera viewport ── */}
        <div className="flex w-[420px] shrink-0 flex-col border-r border-border bg-surface-1">
          {/* Camera viewport — takes remaining space */}
          <div className="flex flex-1 items-center justify-center p-4 min-h-0">
            <div className="relative w-full overflow-hidden rounded-2xl border-2 border-border bg-black shadow-xl" style={{ aspectRatio: "1 / 1" }}>
              {/* Video is always in the DOM so the ref is always available */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                width={1024}
                height={1024}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                  visibility: cameraActive && !capturedImage ? "visible" : "hidden",
                }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Capture overlay button — shown on top of live video */}
              {cameraActive && !capturedImage && (
                <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={capturePhoto}
                    disabled={!cameraReady}
                    className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-lg backdrop-blur-sm transition-all hover:bg-white/40 hover:scale-105 active:scale-95 disabled:opacity-30"
                    title="Take photo"
                  >
                    <div className="h-10 w-10 rounded-full border-2 border-white bg-white/80" />
                  </button>
                </div>
              )}

              {/* Captured image — overlays the video */}
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )}

              {/* Empty state — shown when camera is not active and no image */}
              {!cameraActive && !capturedImage && (
                <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                    <Camera className="h-10 w-10 text-white/30" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/50">
                      Photo Booth
                    </p>
                    <p className="mt-1 text-xs text-white/30">
                      Take a photo and apply artistic styles
                    </p>
                  </div>
                  {cameraError && (
                    <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {cameraError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Camera controls — centered below the square viewport */}
          <div className="flex w-full shrink-0 items-center justify-center gap-2 border-t border-border bg-surface-1 px-4 py-3">
            {!cameraActive ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
              >
                <Camera className="h-4 w-4" />
                Start Camera
              </button>
            ) : capturedImage ? (
              <>
                <button
                  onClick={clearCapture}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </button>
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CameraOff className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm hover:text-foreground transition-colors"
              >
                <CameraOff className="h-4 w-4" />
                Stop Camera
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel: Styles + Results ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* ── Style selection ── */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Styles</h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {selectedStyles.size}/{STYLE_PRESETS.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={selectAllStyles}
                  className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <Layers className="h-3 w-3" />
                  All
                </button>
                <button
                  onClick={deselectAllStyles}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  None
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {STYLE_PRESETS.map((style) => {
                const isSelected = selectedStyles.has(style.id);
                const job = jobs.find((j) => j.style === style.id);
                const isProcessing = job?.status === "queued" || job?.status === "running";

                return (
                  <button
                    key={style.id}
                    onClick={() => !processing && toggleStyle(style.id)}
                    disabled={processing}
                    className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : isProcessing
                          ? "border-accent bg-accent/5"
                          : "border-border bg-surface-1 hover:border-accent/40 hover:bg-surface-2/30"
                    } ${processing ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-surface-2">
                      <Image
                        src={style.thumbnailPath}
                        alt={style.label}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                      {/* Processing overlay */}
                      {isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <Loader className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                      {/* Completed overlay */}
                      {job?.status === "success" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                      )}
                      {/* Error overlay */}
                      {job?.status === "error" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                        </div>
                      )}
                      {/* Selection checkmark */}
                      {isSelected && !isProcessing && job?.status !== "success" && (
                        <div className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <span className="text-[11px] font-medium text-foreground">
                      {style.emoji} {style.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Generate button */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={generateStyles}
                disabled={
                  !capturedImageBase64 ||
                  selectedStyles.size === 0 ||
                  processing ||
                  comfyuiStatus !== "online"
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing {completedCount}/{jobs.length}...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Generate {selectedStyles.size || ""} Style{selectedStyles.size !== 1 ? "s" : ""}
                  </>
                )}
              </button>
              {allDone && (
                <button
                  onClick={clearCapture}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  New Photo
                </button>
              )}
            </div>

            {/* Progress info */}
            {processing && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Generating styles using ComfyUI SDXL... Each style takes ~15-30s
                </span>
              </div>
            )}
            {allDone && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-green-400">
                <CheckCircle className="h-3 w-3" />
                <span>
                  {completedCount} style{completedCount !== 1 ? "s" : ""} generated
                  {failedCount > 0 && ` · ${failedCount} failed`}
                </span>
              </div>
            )}
          </div>

          {/* ── Results gallery ── */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {jobs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground/20" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No styles generated yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Take a photo, select styles, and click Generate
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {jobs.map((job) => {
                  const preset = STYLE_PRESETS.find((s) => s.id === job.style);
                  if (!preset) return null;

                  return (
                    <div
                      key={job.promptId || job.style}
                      className={`group relative overflow-hidden rounded-xl border transition-all ${
                        job.status === "success"
                          ? "border-green-500/30 bg-surface-1"
                          : job.status === "error"
                            ? "border-red-500/30 bg-surface-1"
                            : "border-accent/30 bg-surface-1 animate-pulse"
                      }`}
                    >
                      {/* Style label */}
                      <div className="flex items-center gap-1.5 border-b border-border/50 px-2.5 py-1.5">
                        <span className="text-xs">{preset.emoji}</span>
                        <span className="text-[11px] font-medium text-foreground">
                          {preset.label}
                        </span>
                        {job.status === "success" && (
                          <button
                            onClick={() => downloadImage(job)}
                            className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Image area */}
                      <div className="relative aspect-square bg-black/5">
                        {job.status === "success" && job.imageUrl ? (
                          <img
                            src={job.imageUrl}
                            alt={`${preset.label} style`}
                            className="h-full w-full object-cover"
                          />
                        ) : job.status === "error" ? (
                          <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
                            <AlertTriangle className="h-6 w-6 text-red-400" />
                            <p className="text-[10px] text-red-400">
                              {job.error ?? "Failed"}
                            </p>
                          </div>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2">
                            <Loader className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-[10px] text-muted-foreground">
                              {job.status === "running" ? "Generating..." : "Queued..."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="px-2.5 py-1.5">
                        <p className="line-clamp-2 text-[10px] text-muted-foreground/70">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}