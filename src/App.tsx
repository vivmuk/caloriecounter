import * as React from "react";
import {
  analyzeImageWithVenice,
  type NutritionSummary,
} from "../app/lib/venice";
import { NutritionSummary as NutritionSummaryView } from "../app/components/NutritionSummary";
import { CameraIcon, GalleryIcon, SparkleIcon } from "./components/Icons";

type Section = "scan" | "howItWorks";

type VeniceContentElement = { id: Section; label: string; icon: React.ReactElement<{ color?: string }> };

export default function App() {
  const [image, setImageState] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<NutritionSummary | null>(null);
  const [showCamera, setShowCamera] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<Section>("scan");
  const [dishHint, setDishHint] = React.useState("");
  const [isMobile, setIsMobile] = React.useState(false);
  const [useFrench, setUseFrench] = React.useState(false);
  const [analysisTime, setAnalysisTime] = React.useState<number | null>(null);
  const [analysisElapsed, setAnalysisElapsed] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const previousImageUrlRef = React.useRef<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const analysisStartRef = React.useRef<number | null>(null);
  const progressIntervalRef = React.useRef<number | null>(null);
  const timerIntervalRef = React.useRef<number | null>(null);

  const clearAnalysisIntervals = React.useCallback(() => {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const setImage = React.useCallback((value: string | null) => {
    const previous = previousImageUrlRef.current;
    if (previous && previous.startsWith("blob:")) {
      URL.revokeObjectURL(previous);
    }

    previousImageUrlRef.current = value ?? null;
    setImageState(value);
  }, []);

  // Two-stage AI pipeline
  const visionModel = { label: "Mistral 3.1 24B Vision", role: "Food Identification" };
  const textModel = { label: "Llama 3.2 3B", role: "Nutrition Analysis" };

  React.useEffect(() => {
    return () => {
      clearAnalysisIntervals();
    };
  }, [clearAnalysisIntervals]);

  React.useEffect(() => {
    if (loading) {
      if (progressIntervalRef.current === null) {
        progressIntervalRef.current = window.setInterval(() => {
          setProgress((prev) => {
            if (prev >= 95) {
              return prev;
            }

            // Calibrated to reach 95% in ~15 seconds with faster model
            // 15000ms / 400ms = 37.5 ticks, 95 / 37.5 = 2.53% per tick
            const increment = 1.5 + Math.random() * 2; // Range: 1.5-3.5%, avg: 2.5%
            return Math.min(prev + increment, 95);
          });
        }, 400);
      }

      if (timerIntervalRef.current === null) {
        timerIntervalRef.current = window.setInterval(() => {
          if (analysisStartRef.current !== null) {
            const elapsedMs = performance.now() - analysisStartRef.current;
            setAnalysisElapsed(Math.max(0, elapsedMs / 1000));
          }
        }, 100);
      }
    } else {
      clearAnalysisIntervals();
      analysisStartRef.current = null;
      setAnalysisElapsed(0);
      setProgress((prev) => (prev === 100 ? prev : 0));
    }

    return () => {
      clearAnalysisIntervals();
    };
  }, [loading, clearAnalysisIntervals]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(max-width: 768px)");
    const update = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // Initial state
    update(query);

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }

    // Safari fallback
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  React.useEffect(() => {
    return () => {
      const previous = previousImageUrlRef.current;
      if (previous && previous.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }
    };
  }, []);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResult(null);
    setError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setImage(url);
    setShowCamera(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function startCamera() {
    try {
      setError(null);
      setCameraLoading(true);
      setShowCamera(true);

      let mediaStream: MediaStream | null = null;

      const configs: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1200 } } },
        { video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 960 } } },
        { video: { width: { ideal: 1280 }, height: { ideal: 960 } } },
        { video: true }
      ];

      for (const config of configs) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(config);
          break;
        } catch (configErr) {
          console.warn("Camera config failed", config, configErr);
          continue;
        }
      }

      if (!mediaStream) {
        throw new Error("No camera configuration worked");
      }

      setStream(mediaStream);
      setCameraLoading(false);
      setImage(null);
      setFile(null);
    } catch (err) {
      setError("Camera not available. Please check permissions or try uploading a photo instead.");
      setShowCamera(false);
      setCameraLoading(false);
      console.error("Camera error:", err);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setCameraLoading(false);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        setFile(capturedFile);
        const url = URL.createObjectURL(blob);
        setImage(url);
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  }

  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  React.useEffect(() => {
    if (stream && videoRef.current && showCamera) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream, showCamera]);

  React.useEffect(() => {
    if (activeSection !== "scan") {
      stopCamera();
    }
  }, [activeSection]);

  async function onAnalyze() {
    if (!file) return;
    clearAnalysisIntervals();
    analysisStartRef.current = performance.now();
    setAnalysisElapsed(0);
    setProgress(0);
    setLoading(true);
    setError(null);
    setAnalysisTime(null);
    let succeeded = false;
    const startTime = analysisStartRef.current ?? performance.now();
    try {
      const summary = await analyzeImageWithVenice(file, {
        userDishDescription: dishHint.trim() || undefined,
        language: useFrench ? "french" : "english",
      });
      const endTime = performance.now();
      const timeInSeconds = ((endTime - startTime) / 1000).toFixed(1);
      setAnalysisTime(parseFloat(timeInSeconds));
      setResult(summary);
      setProgress(100);
      succeeded = true;
    } catch (err) {
      setProgress(0);
      setError(err instanceof Error ? err.message : "Failed to analyze image");
    } finally {
      setLoading(false);
      if (!succeeded) {
        analysisStartRef.current = null;
      }
    }
  }

  function onClear() {
    clearAnalysisIntervals();
    setFile(null);
    setImage(null);
    setResult(null);
    setError(null);
    setDishHint("");
    setAnalysisTime(null);
    setAnalysisElapsed(0);
    setProgress(0);
    analysisStartRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    stopCamera();
  }

  const navItems: VeniceContentElement[] = [
    { id: "scan", label: "Scan", icon: <CameraIcon size={20} /> },
    { id: "howItWorks", label: "How it Works", icon: <SparkleIcon size={20} /> },
  ];

  const layoutMetrics = React.useMemo(
    () => ({
      containerPadding: isMobile ? "24px 16px 20px" : "32px 20px 24px",
      outerGap: isMobile ? 20 : 24,
      cardPadding: isMobile ? 20 : 28,
      cardGap: isMobile ? 16 : 20,
      heroTitleSize: isMobile ? 28 : 36,
      heroSubtitleSize: isMobile ? 14 : 16,
      analyzeButtonPadding: isMobile ? "14px 20px" : "16px 24px",
      analyzeButtonFontSize: isMobile ? 15 : 16,
      hintFontSize: isMobile ? 13 : 14,
      pillFontSize: isMobile ? 10 : 12,
      pillPadding: isMobile ? "5px 12px" : "6px 14px",
    }),
    [isMobile]
  );

  const disableAnalyze = !file || loading;
  const progressValue = Math.max(0, Math.min(100, progress));

  return (
    <div style={{
      minHeight: "100dvh",
      background: "radial-gradient(120% 120% at 50% 0%, #e0e7ff 0%, #f8fafc 45%, #f1f5f9 100%)",
    }}>
      <div style={{
        maxWidth: isMobile ? "100%" : 960,
        margin: "0 auto",
        minHeight: "100dvh",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        padding: layoutMetrics.containerPadding,
        gap: layoutMetrics.outerGap,
      }}>
        <header style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: layoutMetrics.pillPadding,
            borderRadius: 999,
            background: "rgba(79, 70, 229, 0.12)",
            color: "#4338ca",
            fontWeight: 600,
            fontSize: layoutMetrics.pillFontSize,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}>
            GenAI nutrition copilot
          </div>
          <h1 style={{
            margin: "18px 0 12px",
            fontSize: layoutMetrics.heroTitleSize,
            fontWeight: 700,
            color: "#0f172a",
          }}>
            Food Calorie Counter
          </h1>
          <p
            style={{ margin: 0, color: "#475569", fontSize: layoutMetrics.heroSubtitleSize, lineHeight: 1.6 }}
          >
            Capture a meal, optionally describe the dish, and let our AI pipeline analyze every pixel for a deep nutrition
            readout in seconds.
          </p>
        </header>

        <main style={{ paddingBottom: isMobile ? 24 : 32 }}>
          {activeSection === "scan" ? (
            <div style={{ display: "grid", gap: isMobile ? 20 : 28 }}>
              <div style={{
                display: "grid",
                gap: layoutMetrics.cardGap,
                background: "rgba(255,255,255,0.92)",
                borderRadius: 28,
                padding: layoutMetrics.cardPadding,
                border: "1px solid rgba(79,70,229,0.12)",
                boxShadow: "0 32px 60px -30px rgba(79, 70, 229, 0.35)",
                backdropFilter: "blur(18px)",
              }}>
                <div style={{ textAlign: "center", color: "#334155", fontSize: isMobile ? 16 : 18, fontWeight: 600 }}>
                  Upload a photo or open the camera to get a precision calorie breakdown.
                </div>

                <div style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(129,140,248,0.08) 100%)",
                  borderRadius: 24,
                  padding: isMobile ? 16 : 20,
                  border: "1px dashed rgba(99,102,241,0.4)",
                  display: "grid",
                  gap: isMobile ? 12 : 16,
                  justifyItems: "center",
                }}>
                  {showCamera ? (
                    <div style={{
                      width: "100%",
                      borderRadius: 20,
                      overflow: "hidden",
                      background: "#000",
                      position: "relative",
                      aspectRatio: "4/3",
                    }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <canvas ref={canvasRef} style={{ display: "none" }} />
                      {cameraLoading && (
                        <div style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          gap: 12,
                          color: "#fff",
                        }}>
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            border: "3px solid rgba(255,255,255,0.3)",
                            borderTopColor: "#fff",
                            animation: "spin 1s linear infinite",
                          }} />
                          Starting camera...
                        </div>
                      )}
                      {!cameraLoading && !stream && (
                        <div style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12,
                          color: "rgba(255,255,255,0.85)",
                          background: "rgba(15,23,42,0.5)",
                        }}>
                          <CameraIcon size={36} color="rgba(255,255,255,0.8)" />
                          Camera unavailable
                        </div>
                      )}
                      <div style={{
                        position: "absolute",
                        bottom: 20,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: isMobile ? 12 : 16,
                        alignItems: "center",
                      }}>
                        <button
                          onClick={stopCamera}
                          style={{
                            width: 54,
                            height: 54,
                            borderRadius: "50%",
                            border: "2px solid rgba(255,255,255,0.4)",
                            background: "rgba(15,23,42,0.7)",
                            color: "#fff",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          X
                        </button>
                        <button
                          onClick={capturePhoto}
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            border: "5px solid rgba(255,255,255,0.75)",
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 12px 30px rgba(15,23,42,0.45)",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#0f172a" }} />
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            width: 54,
                            height: 54,
                            borderRadius: "50%",
                            border: "2px solid rgba(255,255,255,0.4)",
                            background: "rgba(15,23,42,0.7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <GalleryIcon size={22} color="#fff" />
                        </button>
                      </div>
                    </div>
                  ) : image ? (
                    <img
                      src={image}
                      alt="Selected meal"
                      style={{
                        width: "100%",
                        borderRadius: 20,
                        border: "1px solid rgba(148,163,184,0.4)",
                        boxShadow: "0 20px 55px -30px rgba(15,23,42,0.8)",
                        maxHeight: isMobile ? 260 : 360,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      minHeight: isMobile ? 180 : 220,
                      borderRadius: 20,
                      background: "rgba(248,250,252,0.8)",
                      border: "1px dashed rgba(148,163,184,0.6)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b",
                      gap: 12,
                    }}>
                      <CameraIcon size={34} color="#94a3b8" />
                      <div style={{ fontWeight: 500 }}>No photo yet</div>
                      <div style={{ fontSize: isMobile ? 12 : 13 }}>Upload or open the camera to begin</div>
                    </div>
                  )}

                  {!showCamera && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 12 : 16, justifyContent: "center" }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 10,
                          padding: isMobile ? "16px 22px" : "18px 26px",
                          borderRadius: 20,
                          border: "1px solid rgba(148,163,184,0.5)",
                          background: "rgba(255,255,255,0.8)",
                          cursor: "pointer",
                          fontWeight: 600,
                          color: "#1e293b",
                          minWidth: 140,
                        }}
                      >
                        <GalleryIcon size={28} color="#6366f1" />
                        Upload Photo
                      </button>
                      <button
                        onClick={startCamera}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 10,
                          padding: isMobile ? "16px 22px" : "18px 26px",
                          borderRadius: 20,
                          border: 0,
                          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                          cursor: "pointer",
                          fontWeight: 600,
                          color: "#fff",
                          minWidth: 140,
                          boxShadow: "0 18px 35px -20px rgba(99,102,241,0.9)",
                        }}
                      >
                        <CameraIcon size={28} color="#fff" />
                        Use Camera
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="dishHint" style={{ fontWeight: 600, color: "#334155" }}>
                    Optional dish description
                  </label>
                  <textarea
                    id="dishHint"
                    value={dishHint}
                    onChange={(event) => setDishHint(event.target.value)}
                    placeholder="Add the dish name, ingredients, cuisine, or preparation details to guide the AI."
                    rows={3}
                    style={{
                      resize: "vertical",
                      minHeight: 72,
                      borderRadius: 16,
                      border: "1px solid rgba(148,163,184,0.55)",
                      padding: "14px 16px",
                      fontFamily: "inherit",
                      fontSize: 14,
                      color: "#0f172a",
                      background: "rgba(248,250,252,0.9)",
                    }}
                    disabled={loading}
                  />
                  <div style={{ fontSize: layoutMetrics.hintFontSize, color: "#64748b" }}>
                    Hint: more context (e.g., "grilled salmon with quinoa and roasted veggies") helps the AI identify food better.
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ fontWeight: 600, color: "#334155", textAlign: "center" }}>
                    Two-Stage AI Pipeline
                  </div>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr",
                    gap: isMobile ? 8 : 12, 
                    alignItems: "center",
                    fontSize: 12,
                  }}>
                    <div style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.1) 100%)",
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(99,102,241,0.2)",
                      textAlign: "center",
                    }}>
                      <div style={{ fontWeight: 600, color: "#4338ca", marginBottom: 4 }}>Stage 1</div>
                      <div style={{ color: "#1e293b", fontWeight: 500 }}>{visionModel.label}</div>
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{visionModel.role}</div>
                    </div>
                    {!isMobile && <div style={{ color: "#94a3b8", fontWeight: 600 }}>→</div>}
                    <div style={{
                      background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(168,85,247,0.1) 100%)",
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(139,92,246,0.2)",
                      textAlign: "center",
                    }}>
                      <div style={{ fontWeight: 600, color: "#7c3aed", marginBottom: 4 }}>Stage 2</div>
                      <div style={{ color: "#1e293b", fontWeight: 500 }}>{textModel.label}</div>
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{textModel.role}</div>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "rgba(248,250,252,0.9)",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.3)",
                }}>
                  <label htmlFor="frenchToggle" style={{ 
                    fontWeight: 600, 
                    color: "#334155",
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <span>🇫🇷</span>
                    Generate report in French
                  </label>
                  <button
                    id="frenchToggle"
                    onClick={() => setUseFrench(!useFrench)}
                    disabled={loading}
                    style={{
                      width: 52,
                      height: 28,
                      borderRadius: 14,
                      border: "2px solid",
                      borderColor: useFrench ? "#4f46e5" : "rgba(148,163,184,0.5)",
                      background: useFrench 
                        ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" 
                        : "rgba(203,213,225,0.8)",
                      cursor: loading ? "not-allowed" : "pointer",
                      position: "relative",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div style={{
                      position: "absolute",
                      top: 2,
                      left: useFrench ? "calc(100% - 22px)" : "2px",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.3s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button
                    onClick={onAnalyze}
                    disabled={disableAnalyze}
                    style={{
                      flex: 1,
                      minWidth: 160,
                      border: 0,
                      borderRadius: 18,
                      padding: layoutMetrics.analyzeButtonPadding,
                      fontSize: layoutMetrics.analyzeButtonFontSize,
                      fontWeight: 600,
                      color: "#fff",
                      background: disableAnalyze
                        ? "linear-gradient(135deg, #cbd5f5 0%, #c4b5fd 100%)"
                        : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                      cursor: disableAnalyze ? "not-allowed" : "pointer",
                      boxShadow: disableAnalyze ? "none" : "0 25px 50px -25px rgba(79,70,229,0.8)",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    {loading ? "Analyzing with AI pipeline..." : "Analyze meal"}
                  </button>
                  <button
                    onClick={onClear}
                    disabled={loading}
                    style={{
                      padding: layoutMetrics.analyzeButtonPadding,
                      borderRadius: 18,
                      border: "1px solid rgba(148,163,184,0.5)",
                      background: "rgba(255,255,255,0.8)",
                      color: "#475569",
                      fontWeight: 500,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    Clear
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  onChange={onSelect}
                  style={{ display: "none" }}
                />
              </div>

              {loading && (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    justifyItems: "center",
                    padding: isMobile ? 16 : 20,
                    background: "rgba(79,70,229,0.08)",
                    borderRadius: 20,
                    border: "1px solid rgba(79,70,229,0.2)",
                    color: "#4338ca",
                    fontWeight: 600,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "3px solid rgba(99,102,241,0.2)",
                        borderTopColor: "#4f46e5",
                        animation: "spin 0.9s linear infinite",
                      }}
                    />
                    Analyzing meal with the Venice nutrition pipeline...
                  </div>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: isMobile ? "100%" : 420,
                      height: 10,
                      background: "rgba(79,70,229,0.18)",
                      borderRadius: 999,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        transformOrigin: "left center",
                        width: `${progressValue}%`,
                        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                        boxShadow: "0 10px 20px -15px rgba(79,70,229,0.8)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      color: "#4f46e5",
                    }}
                  >
                    <span>Elapsed time: {analysisElapsed.toFixed(1)}s</span>
                    <span>Progress: {Math.round(progressValue)}%</span>
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  padding: "14px 18px",
                  borderRadius: 18,
                }}>
                  {error}
                </div>
              )}

              {result && (
                <div style={{
                  background: "linear-gradient(135deg, #f8f5ff 0%, #eef2ff 100%)",
                  borderRadius: 28,
                  padding: 28,
                  border: "1px solid rgba(99,102,241,0.18)",
                  boxShadow: "0 40px 70px -40px rgba(79,70,229,0.6)",
                }}>
                  {analysisTime !== null && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginBottom: 20,
                      padding: "10px 18px",
                      background: "rgba(79,70,229,0.1)",
                      borderRadius: 16,
                      color: "#4338ca",
                      fontWeight: 600,
                      fontSize: 14,
                    }}>
                      <span>⚡</span>
                      Analysis completed in {analysisTime}s
                    </div>
                  )}
                  <NutritionSummaryView data={result} />
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: "grid",
              gap: 32,
              background: "rgba(255,255,255,0.94)",
              borderRadius: 28,
              padding: 32,
              border: "1px solid rgba(148,163,184,0.2)",
              boxShadow: "0 32px 60px -36px rgba(15, 23, 42, 0.35)",
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "#0f172a" }}>
                  How the GenAI nutrition engine works
                </h2>
                <p style={{ marginTop: 12, color: "#475569", fontSize: 16, lineHeight: 1.7 }}>
                  The app uses a two-stage AI pipeline powered by Venice AI: {visionModel.label} for food identification and {textModel.label} for precision nutrition calculation.
                </p>
              </div>

              <div style={{
                display: "grid",
                gap: 20,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}>
                {[{
                  title: "1. Capture & enrich",
                  description: "Snap a meal or upload a photo, then add optional context like ingredients, cuisine, or portion notes.",
                }, {
                  title: "2. AI analysis",
                  description: `${visionModel.label} identifies food items and estimates portions, then ${textModel.label} calculates precise macro and micronutrient breakdowns.`,
                }, {
                  title: "3. Explainable output",
                  description: "You get a structured summary with macros, micros, per-item breakdowns, and AI caveats so you can trust the numbers.",
                }].map((card, idx) => (
                  <div
                    key={card.title}
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(129,140,248,0.08) 100%)",
                      borderRadius: 24,
                      padding: 24,
                      border: "1px solid rgba(99,102,241,0.15)",
                      color: "#1e293b",
                      boxShadow: "0 18px 36px -28px rgba(99,102,241,0.5)",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Step {idx + 1}</div>
                    <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 10 }}>{card.title}</div>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>{card.description}</div>
                  </div>
                ))}
              </div>

              <div style={{
                display: "grid",
                gap: 16,
                background: "linear-gradient(135deg, #0f172a 0%, #312e81 100%)",
                color: "#e0e7ff",
                borderRadius: 24,
                padding: 28,
              }}>
                <h3 style={{ margin: 0, fontSize: 22 }}>Why it feels like magic</h3>
                <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10 }}>
                  <li>Two-stage processing: vision models detect food, then specialized text models calculate precise nutrition.</li>
                  <li>Schema-constrained responses ensure tidy JSON you can plug into trackers or analytics.</li>
                  <li>AI highlights uncertainties, allergens, and portion logic so you know when to double-check.</li>
                </ul>
              </div>
            </div>
          )}
        </main>

        <nav style={{
          display: "flex",
          borderTop: "1px solid rgba(148,163,184,0.35)",
          paddingTop: 12,
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                borderRadius: 18,
                border: item.id === activeSection
                  ? "1px solid rgba(79,70,229,0.4)"
                  : "1px solid rgba(148,163,184,0.4)",
                background: item.id === activeSection
                  ? "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(129,140,248,0.1) 100%)"
                  : "rgba(255,255,255,0.9)",
                color: item.id === activeSection ? "#4338ca" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {React.cloneElement(item.icon, {
                  color: item.id === activeSection ? "#4338ca" : "#475569",
                })}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
