import * as React from "react";
import type { NutritionSummary as NutritionSummaryType } from "../lib/venice";

export function NutritionSummary({ data }: { data: NutritionSummaryType }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0 }}>{data.title}</h2>
        <div style={{ color: "#666" }}>
          {data.servingDescription} • Confidence: {(data.confidence * 100).toFixed(0)}%
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}>
        <Card title="Total Calories" value={`${Math.round(data.totalCalories)} kcal`} />
        <Card title="Protein" value={`${data.macros.protein.grams.toFixed(1)} g • ${Math.round(data.macros.protein.calories)} kcal`} />
        <Card title="Carbs" value={`${data.macros.carbs.grams.toFixed(1)} g • ${Math.round(data.macros.carbs.calories)} kcal`} />
        <Card title="Fat" value={`${data.macros.fat.grams.toFixed(1)} g • ${Math.round(data.macros.fat.calories)} kcal`} />
      </div>

      {data.items && data.items.length > 0 && (
        <div>
          <h3 style={{ margin: "8px 0" }}>Items</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.items.map((it, idx) => (
              <li key={idx}>{it.name} — {it.quantity} — {Math.round(it.calories)} kcal</li>
            ))}
          </ul>
        </div>
      )}

      {data.micronutrients && (
        <div>
          <h3 style={{ margin: "8px 0" }}>Micronutrients</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {Object.entries(data.micronutrients).map(([k, v]) =>
              typeof v === "number" ? <Card key={k} title={pretty(k)} value={`${v} mg`} /> : null
            )}
          </div>
        </div>
      )}

      {data.notes && data.notes.length > 0 && (
        <div>
          <h3 style={{ margin: "8px 0" }}>Notes</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: 12,
      background: "#fff"
    }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function pretty(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}


