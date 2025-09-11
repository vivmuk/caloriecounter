import type { Route } from "./+types/home";
import * as React from "react";
import { analyzeImageWithVenice, type NutritionSummary } from "../lib/venice";
import { NutritionSummary as NutritionSummaryView } from "../components/NutritionSummary";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
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

  return (
    <main style={{
      padding: 16,
      maxWidth: 960,
      margin: "0 auto",
      display: "grid",
      gap: 16
    }}>
      <h1 style={{ margin: 0 }}>Food Calorie Counter</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Upload a food image to get estimated calories, macros, and micronutrients.</p>

      <div style={{ display: "grid", gap: 12 }}>
        <input type="file" accept="image/*" onChange={onSelect} />
        {image && (
          <img src={image} alt="preview" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }} />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onAnalyze} disabled={!file || loading}>
            {loading ? "Analyzing..." : "Analyze Image"}
          </button>
          <button onClick={() => { setFile(null); setImage(null); setResult(null); setError(null); }} disabled={loading}>Clear</button>
        </div>
        {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      </div>

      {result && (
        <section>
          <NutritionSummaryView data={result} />
        </section>
      )}
    </main>
  );
}
