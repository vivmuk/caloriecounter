import * as React from "react";
import {
  analyzeImageWithVenice,
  VENICE_TEXT_MODELS,
  type NutritionSummary,
  type ReasoningEffort,
  type VeniceTextModelId,
} from "../app/lib/venice";
import { NutritionSummary as NutritionSummaryView } from "../app/components/NutritionSummary";
import { CameraIcon, GalleryIcon, SparkleIcon } from "./components/Icons";

type Section = "scan" | "howItWorks";

type VeniceContentElement = { id: Section; label: string; icon: React.ReactElement<{ color?: string }> };

export default function App() {
  const [image, setImage] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<NutritionSummary | null>(null);
  const [showCamera, setShowCamera] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<Section>("scan");
  const [dishHint, setDishHint] = React.useState("");
  const textModelOptions: Array<{
    id: VeniceTextModelId;
    label: string;
    tagline: string;
    badge: string;
    reasoningEffort?: ReasoningEffort;
  }> = [
    {
      id: "qwen3-235b",
      label: "Venice Large 1.1",
      tagline: "Fast, high-accuracy macros with reasoning disabled for speed.",
      badge: "⚡ Fast response",
    },
    {
      id: "qwen-2.5-qwq-32b",
      label: "Venice Reasoning",
      tagline: "Google-style deep insights with structured explanations.",
      badge: "🧠 Deep insights",
      reasoningEffort: "medium",
    },
  ];
  const [selectedTextModelId, setSelectedTextModelId] = React.useState<VeniceTextModelId>(textModelOptions[0].id);
  const selectedTextModel =
    textModelOptions.find((model) => model.id === selectedTextModelId) ?? textModelOptions[0];
  // Models are now hardcoded in the Venice function
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Hardcoded model names for display
  const activeVisionModel = { label: "Mistral 3.1 24B Vision" };
  const activeTextModel =
    VENICE_TEXT_MODELS.find((model) => model.id === selectedTextModelId) ?? VENICE_TEXT_MODELS[0];

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResult(null);
    setError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setImage(url);
    setShowCamera(false);
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
    setLoading(true);
    setError(null);
    try {
      const summary = await analyzeImageWithVenice(file, {
        userDishDescription: dishHint.trim() || undefined,
        textModel: selectedTextModel.id,
        reasoningEffort: selectedTextModel.reasoningEffort,
      });
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze image");
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    setFile(null);
    setImage(null);
    setResult(null);
    setError(null);
    setDishHint("");
    stopCamera();
  }

  const navItems: VeniceContentElement[] = [
    { id: "scan", label: "Scan", icon: <CameraIcon size={20} /> },
    { id: "howItWorks", label: "How it Works", icon: <SparkleIcon size={20} /> },
  ];

  const disableAnalyze = !file || loading;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "radial-gradient(120% 120% at 50% 0%, #e0e7ff 0%, #f8fafc 45%, #f1f5f9 100%)",
    }}>
      <div style={{
        maxWidth: 960,
        margin: "0 auto",
        minHeight: "100dvh",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        padding: "32px 20px 24px",
        gap: 24,
      }}>
        <header style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(79, 70, 229, 0.12)",
            color: "#4338ca",
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}>
            GenAI nutrition copilot
          </div>
          <h1 style={{
            margin: "18px 0 12px",
            fontSize: 36,
            fontWeight: 700,
            color: "#0f172a",
          }}>
            Food Calorie Counter
          </h1>
          <p style={{ margin: 0, color: "#475569", fontSize: 16, lineHeight: 1.6 }}>
            Capture a meal, optionally describe the dish, and let {activeVisionModel.label} + {activeTextModel.label} analyze every pixel for a deep nutrition readout in seconds.
          </p>
        </header>

        <main style={{ paddingBottom: 32 }}>
          {activeSection === "scan" ? (
            <div style={{ display: "grid", gap: 28 }}>
              <div style={{
                display: "grid",
                gap: 20,
                background: "rgba(255,255,255,0.92)",
                borderRadius: 28,
                padding: 28,
                border: "1px solid rgba(79,70,229,0.12)",
                boxShadow: "0 32px 60px -30px rgba(79, 70, 229, 0.35)",
                backdropFilter: "blur(18px)",
              }}>
                <div style={{ textAlign: "center", color: "#334155", fontSize: 18, fontWeight: 600 }}>
                  Upload a photo or open the camera to get a precision calorie breakdown.
                </div>

                <div style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(129,140,248,0.08) 100%)",
                  borderRadius: 24,
                  padding: 20,
                  border: "1px dashed rgba(99,102,241,0.4)",
                  display: "grid",
                  gap: 16,
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
                        gap: 16,
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
                          onClick={() => document.getElementById("fileInput")?.click()}
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
                        maxHeight: 360,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      minHeight: 220,
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
                      <div style={{ fontSize: 13 }}>Upload or open the camera to begin</div>
                    </div>
                  )}

                  {!showCamera && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
                      <button
                        onClick={() => document.getElementById("fileInput")?.click()}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 10,
                          padding: "18px 26px",
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
                          padding: "18px 26px",
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
                  <div style={{ fontWeight: 600, color: "#334155" }}>Analysis mode</div>
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    }}
                  >
                    {textModelOptions.map((model) => {
                      const active = model.id === selectedTextModelId;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => setSelectedTextModelId(model.id)}
                          disabled={loading}
                          style={{
                            textAlign: "left",
                            padding: "18px 20px",
                            borderRadius: 18,
                            border: active
                              ? "1px solid rgba(79,70,229,0.45)"
                              : "1px solid rgba(148,163,184,0.45)",
                            background: active
                              ? "linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(129,140,248,0.08) 100%)"
                              : "rgba(255,255,255,0.85)",
                            color: "#0f172a",
                            display: "grid",
                            gap: 8,
                            cursor: loading ? "not-allowed" : "pointer",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              color: active ? "#4338ca" : "#6366f1",
                            }}
                          >
                            {model.badge}
                          </span>
                          <span style={{ fontSize: 18, fontWeight: 700 }}>{model.label}</span>
                          <span style={{ fontSize: 13, color: "#475569" }}>{model.tagline}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {model.reasoningEffort
                              ? "Reasoning enabled · expect longer responses"
                              : "Reasoning disabled · fastest turnaround"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
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
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Hint: more context (e.g., "grilled salmon with quinoa and roasted veggies") helps {activeVisionModel.label} identify food better.
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 600, color: "#334155", textAlign: "center" }}>
                    AI Models: {activeVisionModel.label} + {activeTextModel.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>
                    {selectedTextModel.reasoningEffort
                      ? "Deep reasoning pipeline for comprehensive nutritional insights"
                      : "Reasoning disabled so Venice Large returns results faster"}
                  </div>
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
                      padding: "16px 24px",
                      fontSize: 16,
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
                    {loading ? `Analyzing (${activeVisionModel.label} → ${activeTextModel.label})...` : "Analyze meal"}
                  </button>
                  <button
                    onClick={onClear}
                    disabled={loading}
                    style={{
                      padding: "16px 24px",
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

                <input id="fileInput" type="file" accept="image/*" onChange={onSelect} style={{ display: "none" }} />
              </div>

              {loading && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  justifyContent: "center",
                  color: "#4f46e5",
                  fontWeight: 600,
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "3px solid rgba(99,102,241,0.25)",
                    borderTopColor: "#4f46e5",
                    animation: "spin 1s linear infinite",
                  }} />
                  Generating a detailed nutrition profile...
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
                  The app pairs computer vision with Venice-hosted vision models like Mistral 3.1 24B Vision so you can choose the right analyst for every plate.
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
                  title: "2. Two-stage analysis",
                  description: `${activeVisionModel.label} identifies food items and portions, then ${activeTextModel.label} calculates precise macro and micronutrient breakdowns.`,
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
