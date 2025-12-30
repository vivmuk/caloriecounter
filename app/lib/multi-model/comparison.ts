// Multi-Model Comparison Module
// Runs nutrition analysis across all available models in parallel

import { analyzeWithVenice } from "./venice-adapter";
import type { MultiModelResult } from "./types";
import type { AnalyzeImageOptions } from "../venice";

// Run all available models in parallel
export async function runAllModels(
  imageFile: File,
  options: AnalyzeImageOptions = {}
): Promise<MultiModelResult[]> {
  console.log("🚀 Starting parallel analysis with Venice AI...");

  // For now, we only use Venice AI as per your requirement
  // Additional models can be added here in the future
  const results = await Promise.allSettled([
    analyzeWithVenice(imageFile, options),
    // Future: Add more models here
    // analyzeWithGemini(imageFile, options),
    // analyzeWithMiniMax(imageFile, options),
    // analyzeWithGrok(imageFile, options),
  ]);

  // Filter successful results and extract values
  const successfulResults: MultiModelResult[] = results
    .filter((r): r is PromiseFulfilledResult<MultiModelResult> => r.status === "fulfilled")
    .map((r) => r.value);

  // Log failed results
  results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .forEach((r, index) => {
      console.error(`❌ Model ${index + 1} failed:`, r.reason);
    });

  console.log(`✅ Completed ${successfulResults.length} of ${results.length} analyses`);

  return successfulResults;
}

// Run specific models by name
export async function runSelectedModels(
  imageFile: File,
  modelNames: string[],
  options: AnalyzeImageOptions = {}
): Promise<MultiModelResult[]> {
  console.log(`🚀 Running selected models: ${modelNames.join(", ")}`);

  const modelPromises: Promise<MultiModelResult>[] = [];

  for (const modelName of modelNames) {
    switch (modelName.toLowerCase()) {
      case "venice":
        modelPromises.push(analyzeWithVenice(imageFile, options));
        break;
      // Future: Add more model cases here
      default:
        console.warn(`⚠️ Unknown model: ${modelName}`);
    }
  }

  if (modelPromises.length === 0) {
    console.warn("⚠️ No valid models selected, defaulting to Venice");
    modelPromises.push(analyzeWithVenice(imageFile, options));
  }

  const results = await Promise.allSettled(modelPromises);

  const successfulResults: MultiModelResult[] = results
    .filter((r): r is PromiseFulfilledResult<MultiModelResult> => r.status === "fulfilled")
    .map((r) => r.value);

  console.log(`✅ Completed ${successfulResults.length} of ${results.length} analyses`);

  return successfulResults;
}
