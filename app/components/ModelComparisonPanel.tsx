// Model Comparison Panel Component
// Displays nutrition analysis results from multiple AI models side-by-side

import type { MultiModelResult } from "../lib/multi-model";

export type ModelComparisonPanelProps = {
  results: MultiModelResult[];
  selectedModel: string | null;
  onSelectModel: (modelName: string) => void;
  onSave: (result: MultiModelResult) => void;
};

export function ModelComparisonPanel({
  results,
  selectedModel,
  onSelectModel,
  onSave,
}: ModelComparisonPanelProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 24, padding: 24, marginTop: 20 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 700 }}>
        Compare Analysis Results
      </h2>

      <p style={{ color: "#64748b", marginBottom: 20 }}>
        Review the nutrition analysis from each model and select your preferred result to save.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        {results.map((result) => (
          <ModelResultCard
            key={result.modelName}
            result={result}
            isSelected={selectedModel === result.modelName}
            onSelect={() => onSelectModel(result.modelName)}
            onSave={() => onSave(result)}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: "rgba(99,102,241,0.1)",
          borderRadius: 12,
        }}
      >
        <h4 style={{ margin: "0 0 8px" }}>Comparison Tips</h4>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#475569" }}>
          <li>Compare total calorie estimates between models</li>
          <li>Check if item identification matches your meal</li>
          <li>Consider the confidence score when deciding</li>
          <li>Review portion sizes that seem most accurate</li>
        </ul>
      </div>
    </div>
  );
}

type ModelResultCardProps = {
  result: MultiModelResult;
  isSelected: boolean;
  onSelect: () => void;
  onSave: () => void;
};

function ModelResultCard({ result, isSelected, onSelect, onSave }: ModelResultCardProps) {
  const hasError = result.confidence === 0 || result.error;

  return (
    <div
      style={{
        border: isSelected ? "2px solid #4f46e5" : "1px solid rgba(148,163,184,0.3)",
        borderRadius: 16,
        padding: 20,
        background: isSelected ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.9)",
        cursor: hasError ? "not-allowed" : "pointer",
        opacity: hasError ? 0.6 : 1,
        transition: "all 0.2s",
      }}
      onClick={hasError ? undefined : onSelect}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {result.displayName}
          </h3>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
            Analysis time: {result.analysisTime.toFixed(1)}s
          </div>
          {hasError && (
            <div style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>
              Error: {result.error || "Analysis failed"}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: result.confidence > 85 ? "rgba(16,185,129,0.15)" : "rgba(251,191,36,0.15)",
            color: result.confidence > 85 ? "#047857" : "#d97706",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {result.confidence}% confidence
        </div>
      </div>

      {!hasError && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
            <MiniStat label="Calories" value={result.nutritionSummary.totalCalories} unit="kcal" />
            <MiniStat label="Protein" value={result.nutritionSummary.macros.protein.grams} unit="g" />
            <MiniStat label="Carbs" value={result.nutritionSummary.macros.carbs.grams} unit="g" />
            <MiniStat label="Fat" value={result.nutritionSummary.macros.fat.grams} unit="g" />
          </div>

          {result.nutritionSummary.items && result.nutritionSummary.items.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#475569", marginBottom: 8 }}>
                Detected Items:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {result.nutritionSummary.items.slice(0, 5).map((item, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "4px 10px",
                      background: "rgba(148,163,184,0.15)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    {item.name} ({item.calories} kcal)
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              onClick={onSelect}
              style={{
                flex: 1,
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.4)",
                background: isSelected ? "#4f46e5" : "white",
                color: isSelected ? "white" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isSelected ? "Selected" : "Select This Result"}
            </button>
            <button
              onClick={onSave}
              disabled={!isSelected}
              style={{
                flex: 1,
                padding: "12px 20px",
                borderRadius: 12,
                border: "none",
                background: isSelected
                  ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                  : "#e2e8f0",
                color: isSelected ? "white" : "#94a3b8",
                fontWeight: 600,
                cursor: isSelected ? "pointer" : "not-allowed",
              }}
            >
              Save This Result
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type MiniStatProps = {
  label: string;
  value: number;
  unit: string;
};

function MiniStat({ label, value, unit }: MiniStatProps) {
  return (
    <div
      style={{
        padding: "12px",
        background: "rgba(148,163,184,0.1)",
        borderRadius: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
        {Math.round(value)}
        <span style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginLeft: 2 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
