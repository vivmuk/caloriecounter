import type { NutritionSummary } from "../venice";

// Base configuration for all models
export interface ModelConfig {
  name: string;
  displayName: string;
  endpoint: string;
  apiKeyEnv: string;
  timeout: number;
  temperature: number;
}

// Multi-model result container
export interface MultiModelResult {
  modelName: string;
  displayName: string;
  nutritionSummary: NutritionSummary;
  analysisTime: number;
  confidence: number;
}

// Result selection state
export interface SelectedResult {
  modelName: string;
  savedAt: Date;
  nutritionSummary: NutritionSummary;
}

// Processed image data
export interface ProcessedImage {
  dataUrl: string;
  base64: string;
  mediaType: string;
}

// Food identification result
export interface FoodIdentification {
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    estimatedGrams: number;
    preparation: string;
    confidence: number;
  }>;
  overallConfidence: number;
  visualObservations: string[];
  alternativeObservations?: string[];
  complementaryItems?: string[];
}