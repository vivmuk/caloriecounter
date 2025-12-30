import { callModelAPI, GEMINI_FLASH_CONFIG } from "./api";
import { FoodIdentification } from "./types";
import type { NutritionSummary } from "../venice";

// Gemini 3 Flash Preview - Primary Food ID
export async function identifyWithGemini(imageBase64: string): Promise<FoodIdentification> {
  const prompt = `You are an expert food identification AI. Analyze this food image and provide:
  1. List of all visible food items with specific names
  2. Estimated quantities (number of pieces, serving size)
  3. Preparation methods visible (fried, baked, raw, etc.)
  4. Approximate portion sizes in grams
  5. Confidence score for each identification

Return as JSON matching this schema:
{
  "items": [{
    "name": string,
    "quantity": number,
    "unit": string,
    "estimatedGrams": number,
    "preparation": string,
    "confidence": number
  }],
  "overallConfidence": number,
  "visualObservations": string[]
}`;

  const startTime = Date.now();
  const data = await callModelAPI(GEMINI_FLASH_CONFIG, imageBase64, prompt, true);
  const analysisTime = Date.now() - startTime;
  
  console.log(`✅ Gemini food identification completed in ${analysisTime}ms`);

  // Extract and parse the response
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    
    return {
      items: result.items || [],
      overallConfidence: result.overallConfidence || 85,
      visualObservations: result.visualObservations || [],
    };
  } catch (error) {
    console.error("❌ Failed to parse Gemini food identification response:", error);
    throw new Error("Failed to parse Gemini food identification response");
  }
}

// Gemini 3 Flash Preview with Reasoning - Primary Nutrition
export async function analyzeNutritionWithGemini(foodData: FoodIdentification): Promise<NutritionSummary> {
  const prompt = `As a certified clinical nutritionist with 20+ years of experience, calculate nutrition for:

${JSON.stringify(foodData.items, null, 2)}

Provide detailed calculations:
1. Macronutrient breakdown (protein, carbs, fat with subtypes)
2. Micronutrient estimates (sodium, potassium, calcium, iron, vitamins)
3. Calorie calculations with methodology
4. Per-item calorie breakdown
5. Health considerations and cautions

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "confidence": number,
  "servingDescription": string,
  "totalCalories": number,
  "macros": {
    "protein": { "grams": number, "calories": number },
    "carbs": { "grams": number, "calories": number, "fiber": number, "sugar": number },
    "fat": { "grams": number, "calories": number, "saturated": number, "unsaturated": number }
  },
  "micronutrients": {
    "sodiumMg": number,
    "potassiumMg": number,
    "cholesterolMg": number,
    "calciumMg": number,
    "ironMg": number,
    "vitaminCMg": number
  },
  "items": [{
    "name": string,
    "quantity": string,
    "calories": number,
    "massGrams": number
  }],
  "notes": [string],
  "analysis": {
    "visualObservations": [string],
    "portionEstimate": string,
    "confidenceNarrative": string,
    "cautions": [string]
  }
}`;

  const startTime = Date.now();
  const data = await callModelAPI(GEMINI_FLASH_CONFIG, "", prompt, false);
  const analysisTime = Date.now() - startTime;
  
  console.log(`✅ Gemini nutrition analysis completed in ${analysisTime}ms`);

  // Extract and parse the response
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    
    // Ensure all numeric values are integers
    return ensureIntegerValues(result);
  } catch (error) {
    console.error("❌ Failed to parse Gemini nutrition response:", error);
    throw new Error("Failed to parse Gemini nutrition response");
  }
}

// Ensure all numeric values in the nutrition summary are integers
function ensureIntegerValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === "number") {
    return Math.round(obj);
  }
  
  if (typeof obj === "string") {
    // Try to parse as number and round if it's a decimal
    const num = parseFloat(obj);
    if (!isNaN(num) && num.toString() !== obj) {
      return Math.round(num).toString();
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(ensureIntegerValues);
  }
  
  if (typeof obj === "object") {
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = ensureIntegerValues(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}