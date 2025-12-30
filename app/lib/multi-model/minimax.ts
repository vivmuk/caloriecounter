import type { FoodIdentification } from "./types";
import { callModelAPI, MINIMAX_M21_CONFIG } from "./api";

// MiniMax M21 - Validation Food ID
export async function identifyWithMiniMax(imageBase64: string): Promise<FoodIdentification> {
  const prompt = `Analyze this food image from a different perspective:
  1. What are the main food components?
  2. Estimate the total meal composition
  3. Note any ingredients that might be missed in primary analysis
  4. Provide alternative portion estimates

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
  "visualObservations": string[],
  "alternativeObservations": string[],
  "complementaryItems": string[]
}`;

  const startTime = Date.now();
  const data = await callModelAPI(MINIMAX_M21_CONFIG, imageBase64, prompt, true);
  const analysisTime = Date.now() - startTime;
  
  console.log(`✅ MiniMax food identification completed in ${analysisTime}ms`);

  // Extract and parse the response
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    
    return {
      items: result.items || [],
      overallConfidence: result.overallConfidence || 80,
      visualObservations: result.visualObservations || [],
      alternativeObservations: result.alternativeObservations || [],
      complementaryItems: result.complementaryItems || [],
    };
  } catch (error) {
    console.error("❌ Failed to parse MiniMax food identification response:", error);
    throw new Error("Failed to parse MiniMax food identification response");
  }
}