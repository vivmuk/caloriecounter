import * as React from "react";
import type { NutritionSummary as NutritionSummaryType } from "../lib/venice";

export function NutritionSummary({ data }: { data: NutritionSummaryType }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#1e293b" }}>{data.title}</h2>
        <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          {data.servingDescription} • Confidence: {(data.confidence * 100).toFixed(0)}%
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}>
        <Card title="Total Calories" value={`${Math.round(data.totalCalories)} kcal`} color="#ef4444" gradient="linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)" />
        <Card title="Protein" value={`${data.macros.protein.grams.toFixed(1)} g • ${Math.round(data.macros.protein.calories)} kcal`} color="#ef4444" gradient="linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)" />
        <Card title="Carbs" value={`${data.macros.carbs.grams.toFixed(1)} g • ${Math.round(data.macros.carbs.calories)} kcal`} color="#f59e0b" gradient="linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" />
        <Card title="Fat" value={`${data.macros.fat.grams.toFixed(1)} g • ${Math.round(data.macros.fat.calories)} kcal`} color="#8b5cf6" gradient="linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)" />
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

function Card({ title, value, color, gradient }: { title: string; value: string; color: string; gradient: string }) {
  return (
    <div style={{
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: 16,
      background: gradient,
      boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.06)"
    }}>
      <div style={{ fontSize: 12, color: `${color}`, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function pretty(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}


