import * as React from "react";
import { analyzeImageWithVenice, type NutritionSummary } from "../app/lib/venice";
import { NutritionSummary as NutritionSummaryView } from "../app/components/NutritionSummary";
import { CameraIcon, GalleryIcon, AddIcon, CalendarIcon, HistoryIcon, UserIcon, FlameIcon, MeatIcon, WheatIcon, DropletIcon } from "./components/Icons";

function TodayCard({ total, goal, protein, carbs, fat }: { total: number; goal: number; protein: number; carbs: number; fat: number; }) {
  const pct = Math.min(100, Math.round((total / goal) * 100));
  return (
    <div style={{ 
      background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", 
      border: "1px solid #e2e8f0", 
      borderRadius: 20, 
      padding: 20,
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
    }}>
      <div style={{ textAlign: "center", fontSize: 48, fontWeight: 700, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 4 }}>{Math.round(total)}</div>
      <div style={{ textAlign: "center", color: "#64748b", fontSize: 16, fontWeight: 500 }}>/ {goal} cal</div>
      <div style={{ height: 12, background: "#e2e8f0", borderRadius: 999, margin: "16px 0", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: 12, background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)", borderRadius: 999, transition: "width 0.3s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <Macro label="Protein" grams={protein} color="#ef4444" icon={<MeatIcon size={16} color="#ef4444" />} />
        <Macro label="Carbs" grams={carbs} color="#f59e0b" icon={<WheatIcon size={16} color="#f59e0b" />} />
        <Macro label="Fat" grams={fat} color="#8b5cf6" icon={<DropletIcon size={16} color="#8b5cf6" />} />
      </div>
    </div>
  );
}

function Macro({ label, grams, color, icon }: { label: string; grams: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", flex: 1, padding: 12, background: "#f8fafc", borderRadius: 12, border: `1px solid ${color}20` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
        {icon}
        <div style={{ fontWeight: 600, color }}>{Math.round(grams)}g</div>
      </div>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function App() {
  const [image, setImage] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<NutritionSummary | null>(null);
  const [showCamera, setShowCamera] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResult(null);
    setError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setImage(url);
  }

  async function startCamera() {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use rear camera on mobile
      });
      setStream(mediaStream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permission and try again.");
      console.error('Camera error:', err);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        setFile(file);
        const url = URL.createObjectURL(blob);
        setImage(url);
        stopCamera();
      }
    }, 'image/jpeg', 0.85);
  }

  React.useEffect(() => {
    return () => {
      // Cleanup camera stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  async function onAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await analyzeImageWithVenice(file);
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze image");
    } finally {
      setLoading(false);
    }
  }

  const [tab, setTab] = React.useState<"today" | "add" | "history" | "profile">("today");
  const calories = result?.totalCalories ?? 0;
  const protein = result?.macros.protein.grams ?? 0;
  const carbs = result?.macros.carbs.grams ?? 0;
  const fat = result?.macros.fat.grams ?? 0;

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)", minHeight: "100dvh", display: "grid", gridTemplateRows: "1fr auto" }}>
      <div style={{ padding: 16 }}>
        {tab === "today" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#1e293b" }}>Today</h1>
              <div style={{ color: "#64748b", fontSize: 16, fontWeight: 400, marginTop: 4 }}>{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
            <TodayCard total={calories} goal={2000} protein={protein} carbs={carbs} fat={fat} />
            <button onClick={() => setTab("add")} style={{ 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
              color: "#fff", 
              border: 0, 
              padding: "16px 20px", 
              borderRadius: 16, 
              fontWeight: 600, 
              fontSize: 16,
              boxShadow: "0 4px 14px 0 rgba(102, 126, 234, 0.39)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              transition: "transform 0.2s ease"
            }} onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"} onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
              <AddIcon size={20} color="#fff" /> Add Food
            </button>
            <div style={{ background: "#ffffff", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600, color: "#1e293b" }}>Today's Meals</h3>
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 16, padding: 32 }}>No meals logged yet<br/><span style={{ fontSize: 14 }}>Tap "Add Food" to get started</span></div>
            </div>
          </div>
        )}

        {tab === "add" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#1e293b" }}>Food Scanner</h1>
              <div style={{ color: "#64748b", fontSize: 16, marginTop: 4 }}>Take a photo or select from gallery to analyze your food</div>
            </div>
            
            {showCamera ? (
              <div style={{ background: "#000", borderRadius: 24, overflow: "hidden", position: "relative" }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  style={{ width: "100%", height: "300px", objectFit: "cover" }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <div style={{ 
                  position: "absolute", 
                  bottom: 16, 
                  left: "50%", 
                  transform: "translateX(-50%)", 
                  display: "flex", 
                  gap: 16, 
                  alignItems: "center" 
                }}>
                  <button onClick={stopCamera} style={{
                    width: 48, height: 48, borderRadius: 999, background: "rgba(255,255,255,0.2)", color: "#fff", border: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
                  }}>✕</button>
                  <button onClick={capturePhoto} style={{
                    width: 64, height: 64, borderRadius: 999, background: "#fff", color: "#000", border: "4px solid rgba(255,255,255,0.3)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                  }}>📷</button>
                  <button onClick={() => document.getElementById("fileInput")?.click()} style={{
                    width: 48, height: 48, borderRadius: 999, background: "rgba(255,255,255,0.2)", color: "#fff", border: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <GalleryIcon size={20} color="#fff" />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ 
                background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", 
                color: "#fff", 
                padding: 24, 
                borderRadius: 24, 
                display: "grid", 
                placeItems: "center",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                  <button onClick={() => document.getElementById("fileInput")?.click()} style={{ 
                    width: 52, height: 52, borderRadius: 999, background: "rgba(255,255,255,0.1)", color: "#fff", border: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease"
                  }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
                    <GalleryIcon size={24} color="#fff" />
                  </button>
                  <button onClick={startCamera} style={{ 
                    width: 72, height: 72, borderRadius: 999, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", border: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(102, 126, 234, 0.4)", transition: "all 0.2s ease"
                  }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
                    <CameraIcon size={32} color="#fff" />
                  </button>
                  <button onClick={startCamera} style={{ 
                    width: 52, height: 52, borderRadius: 999, background: "rgba(255,255,255,0.1)", color: "#fff", border: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease"
                  }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
                    <CameraIcon size={24} color="#fff" />
                  </button>
                </div>
              </div>
            )}
            
            <input id="fileInput" type="file" accept="image/*" onChange={onSelect} style={{ display: "none" }} />
            {image && !showCamera && <img src={image} alt="preview" style={{ width: "100%", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }} />}
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={onAnalyze} disabled={!file || loading} style={{ 
                background: loading ? "#94a3b8" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
                color: "#fff", 
                border: 0, 
                padding: "14px 20px", 
                borderRadius: 16, 
                fontWeight: 600,
                fontSize: 16,
                flex: 1,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px 0 rgba(102, 126, 234, 0.39)",
                transition: "all 0.2s ease"
              }}>
                {loading ? "Analyzing..." : "Analyze Image"}
              </button>
              <button onClick={() => { setFile(null); setImage(null); setResult(null); setError(null); stopCamera(); }} disabled={loading} style={{ 
                border: "1px solid #e2e8f0", 
                background: "#fff",
                padding: "14px 20px", 
                borderRadius: 16, 
                fontWeight: 500,
                color: "#64748b",
                cursor: loading ? "not-allowed" : "pointer"
              }}>Clear</button>
            </div>
            {error && <div style={{ color: "#ef4444", background: "#fef2f2", padding: 12, borderRadius: 12, border: "1px solid #fecaca" }}>{error}</div>}
            {result && <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}><NutritionSummaryView data={result} /></div>}
          </div>
        )}

        {tab === "history" && (
          <div style={{ display: "grid", gap: 20 }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#1e293b" }}>History</h1>
            <div style={{ background: "#ffffff", borderRadius: 16, padding: 32, border: "1px solid #e2e8f0", textAlign: "center" }}>
              <HistoryIcon size={48} color="#cbd5e1" />
              <div style={{ color: "#94a3b8", fontSize: 16, marginTop: 16 }}>No meals logged yet</div>
              <div style={{ color: "#cbd5e1", fontSize: 14, marginTop: 8 }}>Your meal history will appear here</div>
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div style={{ display: "grid", gap: 20 }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "#1e293b" }}>Profile</h1>
            <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}>
              <div style={{ fontWeight: 600, fontSize: 18, color: "#1e293b", marginBottom: 16 }}>Today's Progress</div>
              <TodayCard total={calories} goal={2000} protein={protein} carbs={carbs} fat={fat} />
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}>
              <div style={{ fontWeight: 600, fontSize: 18, color: "#1e293b", marginBottom: 16 }}>Daily Goals</div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#f8fafc", borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FlameIcon size={20} color="#ef4444" />
                    <span style={{ fontWeight: 500, color: "#374151" }}>Calorie Goal</span>
                  </div>
                  <span style={{ color: "#667eea", fontWeight: 600 }}>2000 cal</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#f8fafc", borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MeatIcon size={20} color="#ef4444" />
                    <span style={{ fontWeight: 500, color: "#374151" }}>Protein Goal</span>
                  </div>
                  <span style={{ color: "#667eea", fontWeight: 600 }}>150g</span>
                </div>
              </div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}>
              <div style={{ fontWeight: 600, fontSize: 18, color: "#1e293b", marginBottom: 16 }}>About</div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f0f9ff", borderRadius: 12, border: "1px solid #bae6fd" }}>
                  <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✨</div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#0c4a6e" }}>AI-Powered Analysis</div>
                    <div style={{ color: "#0369a1", fontSize: 14 }}>Uses Venice AI to analyze your food photos</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0" }}>
                  <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CameraIcon size={16} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#14532d" }}>Photo Recognition</div>
                    <div style={{ color: "#166534", fontSize: 14 }}>Take a photo and get instant calorie estimates</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <nav style={{ 
        display: "flex", 
        borderTop: "1px solid #e2e8f0", 
        background: "rgba(255, 255, 255, 0.95)", 
        backdropFilter: "blur(10px)",
        boxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.1)"
      }}>
        {[
          { id: "today", label: "Today", icon: <CalendarIcon size={20} /> },
          { id: "add", label: "Add Food", icon: <AddIcon size={20} /> },
          { id: "history", label: "History", icon: <HistoryIcon size={20} /> },
          { id: "profile", label: "Profile", icon: <UserIcon size={20} /> },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ 
            flex: 1, 
            padding: "12px 8px", 
            border: 0, 
            background: "transparent", 
            color: tab === t.id ? "#667eea" : "#64748b", 
            fontWeight: tab === t.id ? 600 : 500,
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative"
          }}>
            <div style={{ opacity: tab === t.id ? 1 : 0.6 }}>{React.cloneElement(t.icon, { color: tab === t.id ? "#667eea" : "#64748b" })}</div>
            {t.label}
            {tab === t.id && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 32, height: 3, background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)", borderRadius: "0 0 999px 999px" }} />}
          </button>
        ))}
      </nav>
    </div>
  );
}


