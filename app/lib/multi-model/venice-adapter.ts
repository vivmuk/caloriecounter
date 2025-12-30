// Venice AI Pipeline Adapter
// This adapter wraps the existing Venice implementation to work with the multi-model system

import { analyzeImageWithVenice, type NutritionSummary, type AnalyzeImageOptions } from "../venice";
import { VENICE_CONFIG } from "./api";
import type { MultiModelResult } from "./types";

// Analyze nutrition using Venice AI two-stage pipeline
export async function analyzeWithVenice(
  imageFile: File,
  options: AnalyzeImageOptions = {}
): Promise<MultiModelResult> {
  console.log("🚀 Starting Venice AI analysis...");
  const startTime = Date.now();

  try {
    // Use the existing Venice implementation
    const nutritionSummary = await analyzeImageWithVenice(imageFile, options);

    const analysisTime = (Date.now() - startTime) / 1000; // Convert to seconds

    console.log(`✅ Venice AI analysis completed in ${analysisTime.toFixed(2)}s`);

    return {
      modelName: VENICE_CONFIG.name,
      displayName: VENICE_CONFIG.displayName,
      nutritionSummary,
      analysisTime,
      confidence: nutritionSummary.confidence || 85,
    };
  } catch (error) {
    const analysisTime = (Date.now() - startTime) / 1000;
    console.error("❌ Venice AI analysis failed:", error);

    // Return error result
    return {
      modelName: VENICE_CONFIG.name,
      displayName: VENICE_CONFIG.displayName,
      nutritionSummary: createFallbackNutritionSummary(error),
      analysisTime,
      confidence: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Create a fallback nutrition summary for errors
function createFallbackNutritionSummary(error: unknown): NutritionSummary {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
    title: "Analysis Failed",
    confidence: 0,
    servingDescription: "Unable to analyze",
    totalCalories: 0,
    macros: {
      protein: { grams: 0, calories: 0 },
      carbs: { grams: 0, calories: 0, fiber: 0, sugar: 0 },
      fat: { grams: 0, calories: 0, saturated: 0, unsaturated: 0 },
    },
    micronutrients: {
      sodiumMg: 0,
      potassiumMg: 0,
      cholesterolMg: 0,
      calciumMg: 0,
      ironMg: 0,
      vitaminCMg: 0,
    },
    items: [],
    notes: [
      `Error: ${errorMessage}`,
      "Please try again or use a different model.",
    ],
    analysis: {
      visualObservations: [],
      portionEstimate: "Unable to estimate",
      confidenceNarrative: `Analysis failed: ${errorMessage}`,
      cautions: ["This analysis failed and should not be used."],
    },
  };
}
