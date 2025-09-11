import * as React from "react";
import { analyzeImageWithVenice, type NutritionSummary } from "../app/lib/venice";
import { NutritionSummary as NutritionSummaryView } from "../app/components/NutritionSummary";

function TodayCard({ total, goal, protein, carbs, fat }: { total: number; goal: number; protein: number; carbs: number; fat: number; }) {
  const pct = Math.min(100, Math.round((total / goal) * 100));
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
      <div style={{ textAlign: "center", fontSize: 40, fontWeight: 700, color: "#0b74ff" }}>{Math.round(total)}</div>
      <div style={{ textAlign: "center", color: "#666" }}>/ {goal} cal</div>
      <div style={{ height: 8, background: "#eee", borderRadius: 999, margin: "12px 0" }}>
        <div style={{ width: `${pct}%`, height: 8, background: "#0b74ff", borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#111" }}>
        <Macro label="Protein" grams={protein} />
        <Macro label="Carbs" grams={carbs} />
        <Macro label="Fat" grams={fat} />
      </div>
    </div>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontWeight: 700 }}>{Math.round(grams)}g</div>
      <div style={{ color: "#666", fontSize: 12 }}>{label}</div>
    </div>
  );
}

export default function App() {
  const [image, setImage] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<NutritionSummary | null>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResult(null);
    setError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setImage(url);
  }

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
    <div style={{ maxWidth: 420, margin: "0 auto", background: "#f4f5f7", minHeight: "100dvh", display: "grid", gridTemplateRows: "1fr auto" }}>
      <div style={{ padding: 16 }}>
        {tab === "today" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0 }}>Today</h1>
              <div style={{ color: "#666" }}>{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
            <TodayCard total={calories} goal={2000} protein={protein} carbs={carbs} fat={fat} />
            <button onClick={() => setTab("add")} style={{ background: "#0b74ff", color: "#fff", border: 0, padding: "12px 16px", borderRadius: 12, fontWeight: 600 }}>📸 Add Food</button>
            <div>
              <h3>Today's Meals</h3>
              <div style={{ textAlign: "center", color: "#9aa1a9" }}>No meals logged yet</div>
            </div>
          </div>
        )}

        {tab === "add" && (
          <div style={{ display: "grid", gap: 12 }}>
            <h1 style={{ margin: 0 }}>Food Scanner</h1>
            <div style={{ color: "#666" }}>Take a photo or select from gallery to analyze your food</div>
            <div style={{ background: "#111", color: "#fff", padding: 16, borderRadius: 20, display: "grid", placeItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <button onClick={() => document.getElementById("fileInput")?.click()} style={{ width: 44, height: 44, borderRadius: 999, background: "#333", color: "#fff", border: 0 }}>🖼️</button>
                <button onClick={() => document.getElementById("fileInput")?.click()} style={{ width: 64, height: 64, borderRadius: 999, background: "#0b74ff", color: "#fff", border: 0 }} />
                <button onClick={() => document.getElementById("fileInput")?.click()} style={{ width: 44, height: 44, borderRadius: 999, background: "#333", color: "#fff", border: 0 }}>📷</button>
              </div>
            </div>
            <input id="fileInput" type="file" accept="image/*" onChange={onSelect} style={{ display: "none" }} />
            {image && <img src={image} alt="preview" style={{ width: "100%", borderRadius: 12, border: "1px solid #eee" }} />}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onAnalyze} disabled={!file || loading} style={{ background: "#0b74ff", color: "#fff", border: 0, padding: "12px 16px", borderRadius: 12, fontWeight: 600 }}>
                {loading ? "Analyzing..." : "Analyze Image"}
              </button>
              <button onClick={() => { setFile(null); setImage(null); setResult(null); setError(null); }} disabled={loading} style={{ border: "1px solid #e5e7eb", padding: "12px 16px", borderRadius: 12 }}>Clear</button>
            </div>
            {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
            {result && <NutritionSummaryView data={result} />}
          </div>
        )}

        {tab === "history" && (
          <div>
            <h1 style={{ margin: 0 }}>History</h1>
            <div style={{ color: "#666" }}>No meals logged yet.</div>
          </div>
        )}

        {tab === "profile" && (
          <div style={{ display: "grid", gap: 16 }}>
            <h1 style={{ margin: 0 }}>Profile</h1>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>Today's Progress</div>
              <div style={{ color: "#666" }}>Calories</div>
              <TodayCard total={calories} goal={2000} protein={protein} carbs={carbs} fat={fat} />
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>Daily Goals</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Calorie Goal</span><a href="#" style={{ color: "#0b74ff" }}>2000 cal</a></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Protein Goal</span><a href="#" style={{ color: "#0b74ff" }}>150g</a></div>
              </div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>About</div>
              <div style={{ color: "#666" }}>⭐ AI-Powered Analysis — Uses Venice AI to analyze your food photos</div>
              <div style={{ color: "#666" }}>📷 Photo Recognition — Take a photo and get instant calorie estimates</div>
            </div>
          </div>
        )}
      </div>

      <nav style={{ display: "flex", borderTop: "1px solid #e5e7eb", background: "#fff" }}>
        {[
          { id: "today", label: "Today" },
          { id: "add", label: "Add Food" },
          { id: "history", label: "History" },
          { id: "profile", label: "Profile" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ flex: 1, padding: 12, border: 0, background: tab === t.id ? "#eef5ff" : "#fff", fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</button>
        ))}
      </nav>
    </div>
  );
}


