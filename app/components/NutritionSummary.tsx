import * as React from "react";
import type { NutritionSummary as NutritionSummaryType } from "../lib/venice";

const macroPalette = {
  protein: { accent: "#ef4444", background: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(248,113,113,0.08) 100%)" },
  carbs: { accent: "#f97316", background: "linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(251,146,60,0.08) 100%)" },
  fat: { accent: "#8b5cf6", background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(167,139,250,0.08) 100%)" },
} as const;

const sectionCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  borderRadius: 20,
  border: "1px solid rgba(148,163,184,0.25)",
  padding: 20,
  boxShadow: "0 12px 30px -24px rgba(15, 23, 42, 0.4)",
};

export function NutritionSummary({ data }: { data: NutritionSummaryType }) {
  // Handle confidence as either decimal (0.85) or percentage (85)
  const confidenceValue = data.confidence ?? 0;
  const confidence = Math.round(confidenceValue > 1 ? confidenceValue : confidenceValue * 100);
  const micros = Object.entries(data.micronutrients ?? {}).filter(([, value]) =>
    typeof value === "number"
  );

  const macros: Array<{
    key: keyof typeof macroPalette;
    label: string;
    grams: number;
    calories: number;
    extra?: React.ReactNode[];
  }> = [
    {
      key: "protein",
      label: "Protein",
      grams: data.macros.protein.grams,
      calories: data.macros.protein.calories,
    },
    {
      key: "carbs",
      label: "Carbs",
      grams: data.macros.carbs.grams,
      calories: data.macros.carbs.calories,
      extra: buildMacroExtras(data.macros.carbs.fiber, data.macros.carbs.sugar, "Fiber", "Sugar"),
    },
    {
      key: "fat",
      label: "Fat",
      grams: data.macros.fat.grams,
      calories: data.macros.fat.calories,
      extra: buildMacroExtras(data.macros.fat.saturated, data.macros.fat.unsaturated, "Sat", "Unsat"),
    },
  ];

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{data.title}</h2>
          <span style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(16,185,129,0.15)",
            color: "#047857",
            fontWeight: 600,
            fontSize: 13,
          }}>
            {confidence}% AI confidence
          </span>
        </div>
        <div style={{ color: "#475569", fontSize: 14 }}>
          {data.servingDescription || "Single serving"}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
      }}>
        {macros.map((macro) => (
          <div
            key={macro.key}
            style={{
              ...sectionCardStyle,
              background: macroPalette[macro.key].background,
              borderColor: `${macroPalette[macro.key].accent}33`,
            }}
          >
            <div style={{ color: macroPalette[macro.key].accent, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {macro.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "#0f172a" }}>
              {formatNumber(macro.grams)} g
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
              {Math.round(macro.calories)} kcal
            </div>
            {macro.extra && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {macro.extra}
              </div>
            )}
          </div>
        ))}
      </div>

      {data.totalCalories && (
        <div style={{ ...sectionCardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Total energy</div>
            <div style={{ fontSize: 18, color: "#64748b" }}>Estimated per plate</div>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#312e81" }}>
            {Math.round(data.totalCalories)} kcal
          </div>
        </div>
      )}

      {Array.isArray(data.items) && data.items.length > 0 && (
        <div style={{ ...sectionCardStyle }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Dish breakdown</h3>
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {data.items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                  padding: 14,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(226,232,240,0.35) 0%, rgba(226,232,240,0.15) 100%)",
                  border: "1px solid rgba(148,163,184,0.2)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.name}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{item.quantity}</div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  {typeof item.massGrams === "number" && (
                    <Pill label="Portion" value={`${formatNumber(item.massGrams)} g`} />
                  )}
                  <Pill label="Calories" value={`${Math.round(item.calories)} kcal`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.analysis && (
        <div style={{ ...sectionCardStyle, display: "grid", gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>AI deep dive</h3>
          {renderAnalysisSection("Visual cues", data.analysis.visualObservations)}
          {data.analysis.portionEstimate && (
            <div>
              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>Portion logic</div>
              <div style={{ color: "#475569", fontSize: 14 }}>{data.analysis.portionEstimate}</div>
            </div>
          )}
          {data.analysis.confidenceNarrative && (
            <div>
              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>Confidence notes</div>
              <div style={{ color: "#475569", fontSize: 14 }}>{data.analysis.confidenceNarrative}</div>
            </div>
          )}
          {renderAnalysisSection("Cautions", data.analysis.cautions, "#dc2626")}
        </div>
      )}

      {micros.length > 0 && (
        <div style={{ ...sectionCardStyle }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Micronutrients (approx.)</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            {micros.map(([key, value]) => (
              <Pill key={key} label={prettify(key)} value={`${formatNumber(value as number)} mg`} />
            ))}
          </div>
        </div>
      )}

      {Array.isArray(data.notes) && data.notes.length > 0 && (
        <div style={{ ...sectionCardStyle }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Actionable insights</h3>
          <ul style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 10, color: "#475569", fontSize: 14 }}>
            {data.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 999,
      background: "rgba(15,23,42,0.06)",
      color: "#1e293b",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    }}>
      <span>{label}</span>
      <span style={{ fontWeight: 700, color: "#0f172a" }}>{value}</span>
    </span>
  );
}

function buildMacroExtras(primary?: number, secondary?: number, primaryLabel?: string, secondaryLabel?: string) {
  const pills: React.ReactNode[] = [];
  if (typeof primary === "number" && primaryLabel) {
    pills.push(<Pill key={primaryLabel} label={primaryLabel} value={`${formatNumber(primary)} g`} />);
  }
  if (typeof secondary === "number" && secondaryLabel) {
    pills.push(<Pill key={secondaryLabel} label={secondaryLabel} value={`${formatNumber(secondary)} g`} />);
  }
  return pills.length ? pills : undefined;
}

function renderAnalysisSection(title: string, bullets?: string[], accent = "#2563eb") {
  if (!bullets || bullets.length === 0) return null;
  return (
    <div>
      <div style={{ fontWeight: 600, color: accent, marginBottom: 6 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, color: "#475569", fontSize: 14 }}>
        {bullets.map((entry, index) => (
          <li key={`${title}-${index}`}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

function prettify(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : value;
}
