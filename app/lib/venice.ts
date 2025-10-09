export type NutritionMacro = {
  grams: number;
  calories: number;
};

export type NutritionAnalysis = {
  visualObservations?: string[];
  portionEstimate?: string;
  confidenceNarrative?: string;
  cautions?: string[];
};

export type NutritionSummary = {
  title: string;
  confidence: number;
  servingDescription: string;
  totalCalories: number;
  macros: {
    protein: NutritionMacro;
    carbs: NutritionMacro & { fiber?: number; sugar?: number };
    fat: NutritionMacro & { saturated?: number; unsaturated?: number };
  };
  micronutrients?: {
    sodiumMg?: number;
    potassiumMg?: number;
    cholesterolMg?: number;
    calciumMg?: number;
    ironMg?: number;
    vitaminCMg?: number;
  };
  items?: Array<{
    name: string;
    quantity: string;
    calories: number;
    massGrams?: number;
  }>;
  notes?: string[];
  analysis?: NutritionAnalysis;
};

export type AnalyzeImageOptions = {
  userDishDescription?: string;
  language?: "english" | "french";
};

const VENICE_API_KEY = "ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

// Vision model for food identification
const VISION_MODEL = "mistral-31-24b";

// Text model for nutrition calculation
const TEXT_MODEL = "venice-uncensored";

// Resize image to reduce payload size
async function resizeImageToJpeg(
  file: File,
  maxDimension = 800,
  quality = 0.85
): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = blobUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  URL.revokeObjectURL(blobUrl);
  return dataUrl;
}

// Make API request to Venice
async function callVeniceAPI(body: any): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 minute timeout

  try {
    const response = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VENICE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Venice API error:", response.status, errorText);
      throw new Error(
        `Venice API error (${response.status}): ${errorText || "Unknown error"}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Request timed out. Please check your connection and try again."
      );
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Network error. Please check your internet connection and try again."
      );
    }

    throw error;
  }
}

// Stage 1: Identify food items from image using vision model
async function identifyFoodFromImage(
  imageDataUrl: string,
  userHint?: string
): Promise<string> {
  console.log("🔍 Stage 1: Identifying food with", VISION_MODEL);

  const userContent: any[] = [];

  if (userHint) {
    userContent.push({
      type: "text",
      text: `User hint: "${userHint}". Use this as context.`,
    });
  }

  userContent.push({
    type: "text",
    text: `Analyze this food image in detail. Describe:
1. All visible food items with specific names
2. Preparation methods (grilled, fried, baked, etc.)
3. Portion sizes with reference points (plate size, comparisons)
4. Ingredients you can identify
5. Sauces, seasonings, garnishes
6. Cooking doneness and texture
7. Serving style and presentation

Be extremely detailed and specific in your description.`,
  });

  userContent.push({
    type: "image_url",
    image_url: { url: imageDataUrl },
  });

  const requestBody = {
    model: VISION_MODEL,
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          "You are an expert food analyst. Analyze food images and provide comprehensive, detailed descriptions of all visible food items, portions, and preparation methods.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
  };

  const data = await callVeniceAPI(requestBody);

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("No content from vision model:", data);
    throw new Error("Vision model returned no food description");
  }

  console.log("✅ Food identified, description length:", content.length);
  return typeof content === "string" ? content : JSON.stringify(content);
}

// Stage 2: Calculate nutrition from food description using text model
async function calculateNutritionFromDescription(
  foodDescription: string,
  language: "english" | "french" = "english"
): Promise<NutritionSummary> {
  console.log("🔢 Stage 2: Calculating nutrition with", TEXT_MODEL, "in", language);

  const schema = {
    type: "object",
    required: ["title", "confidence", "servingDescription", "totalCalories", "macros"],
    properties: {
      title: { type: "string", description: "Name of the dish or meal" },
      confidence: {
        type: "number",
        description: "Confidence score 1-100 (percentage)",
      },
      servingDescription: {
        type: "string",
        description: "Description of serving size with weight",
      },
      totalCalories: { type: "number", description: "Total calories" },
      macros: {
        type: "object",
        required: ["protein", "carbs", "fat"],
        properties: {
          protein: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" },
            },
          },
          carbs: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" },
              fiber: { type: "number" },
              sugar: { type: "number" },
            },
          },
          fat: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" },
              saturated: { type: "number" },
              unsaturated: { type: "number" },
            },
          },
        },
      },
      micronutrients: {
        type: "object",
        properties: {
          sodiumMg: { type: "number" },
          potassiumMg: { type: "number" },
          cholesterolMg: { type: "number" },
          calciumMg: { type: "number" },
          ironMg: { type: "number" },
          vitaminCMg: { type: "number" },
        },
      },
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "quantity", "calories"],
          properties: {
            name: { type: "string" },
            quantity: { type: "string" },
            calories: { type: "number" },
            massGrams: { type: "number" },
          },
        },
      },
      notes: {
        type: "array",
        items: { type: "string" },
        description: "Actionable nutritional insights",
      },
      analysis: {
        type: "object",
        properties: {
          visualObservations: {
            type: "array",
            items: { type: "string" },
            description: "Visual cues from the food description",
          },
          portionEstimate: {
            type: "string",
            description: "Methodology for portion size estimation",
          },
          confidenceNarrative: {
            type: "string",
            description: "Detailed reasoning for confidence score",
          },
          cautions: {
            type: "array",
            items: { type: "string" },
            description: "Allergens, dietary restrictions, limitations",
          },
        },
      },
    },
  };

  const languageInstructions = language === "french"
    ? {
        systemPrompt: `Vous êtes un analyste nutritionnel de précision. Calculez des informations nutritionnelles précises basées sur les descriptions d'aliments. Fournissez:
- Détails complets des macronutriments et micronutriments
- Tailles de portions réalistes avec poids en grammes
- Estimations caloriques par aliment
- Évaluation de la confiance avec raisonnement
- Observations visuelles ayant guidé votre analyse
- Allergènes et considérations diététiques

Sortie UNIQUEMENT en JSON valide correspondant au schéma. Pas de markdown, pas de texte supplémentaire.`,
        userPrompt: `Basé sur cette description détaillée d'aliments, calculez des informations nutritionnelles complètes:

${foodDescription}

EXIGENCES CRITIQUES:
- TOUTES les valeurs numériques DOIVENT être des nombres entiers (pas de décimales)
- Arrondissez tous les grammes, calories et milligrammes au nombre entier le plus proche
- Calculez des tailles de portions et masses réalistes en grammes (en nombres entiers)
- Décomposez les aliments individuels dans le tableau items[]
- Incluez au moins 3 conseils nutritionnels exploitables dans notes[]
- Fournissez 4 à 6 observations visuelles dans analysis.visualObservations
- Expliquez la méthodologie d'estimation des portions dans analysis.portionEstimate
- Détaillez le raisonnement de confiance dans analysis.confidenceNarrative
- Listez les allergènes et précautions dans analysis.cautions
- La confiance doit être entre 1-100 (pourcentage entier)
- TOUS LES TEXTES dans le JSON doivent être en FRANÇAIS

Retournez UNIQUEMENT l'objet JSON avec des VALEURS ENTIÈRES UNIQUEMENT, pas de formatage markdown, pas de décimales.`,
      }
    : {
        systemPrompt: `You are a precision nutrition analyst. Calculate accurate nutritional information based on food descriptions. Provide:
- Complete macro and micronutrient breakdowns
- Realistic portion sizes with weights in grams
- Individual food item calorie estimates
- Confidence assessment with reasoning
- Visual observations that informed your analysis
- Allergens and dietary considerations

Output ONLY valid JSON matching the schema. No markdown, no extra text.`,
        userPrompt: `Based on this detailed food description, calculate comprehensive nutrition information:

${foodDescription}

CRITICAL REQUIREMENTS:
- ALL numeric values MUST be whole integers (no decimals)
- Round all grams, calories, and milligrams to nearest whole number
- Calculate realistic portion sizes and mass in grams (as integers)
- Break down individual food items in the items[] array
- Include at least 3 actionable insights in notes[]
- Provide 4-6 visual observations in analysis.visualObservations
- Explain portion estimation methodology in analysis.portionEstimate
- Detail confidence reasoning in analysis.confidenceNarrative
- List allergens and cautions in analysis.cautions
- Confidence must be 1-100 (percentage integer)

Return ONLY the JSON object with INTEGER VALUES ONLY, no markdown formatting, no decimals.`,
      };

  const requestBody = {
    model: TEXT_MODEL,
    temperature: 0.6,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "nutrition_summary",
        schema: schema,
      },
    },
    messages: [
      {
        role: "system",
        content: languageInstructions.systemPrompt,
      },
      {
        role: "user",
        content: languageInstructions.userPrompt,
      },
    ],
  };

  const data = await callVeniceAPI(requestBody);

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("No content from text model:", data);
    throw new Error("Nutrition calculation returned no content");
  }

  console.log("✅ Nutrition calculated, parsing JSON...");

  // Parse JSON response with cleaning
  let parsed: NutritionSummary;
  try {
    let jsonStr: string;
    
    if (typeof content === "string") {
      // Extract JSON from potential markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      // Clean up malformed JSON:
      // 1. Replace tabs with spaces
      jsonStr = jsonStr.replace(/\t/g, " ");
      
      // 2. Fix extremely long decimal numbers (truncate completely)
      jsonStr = jsonStr.replace(/(\d+)\.\d{50,}/g, "$1");
      
      // 3. Round all remaining decimals to integers for numeric fields
      jsonStr = jsonStr.replace(/:\s*(\d+)\.\d+/g, ": $1");
      
      // 4. Remove trailing commas before closing braces/brackets
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");
      
      console.log("🧹 JSON cleaned, attempting parse...");
      parsed = JSON.parse(jsonStr);
    } else {
      parsed = content;
    }

    console.log("✅ Two-stage analysis complete!");
    return parsed;
  } catch (error) {
    console.error("❌ Failed to parse nutrition JSON:", error);
    console.error("Raw content:", content);
    throw new Error("Failed to parse nutrition data. The model returned invalid JSON format.");
  }
}

// Main export: Analyze image with two-stage approach
export async function analyzeImageWithVenice(
  file: File,
  options: AnalyzeImageOptions = {}
): Promise<NutritionSummary> {
  const language = options.language || "english";
  console.log("🚀 Starting two-stage analysis");
  console.log(`Vision: ${VISION_MODEL} | Nutrition: ${TEXT_MODEL} | Language: ${language}`);

  // Resize and convert image
  const imageDataUrl = await resizeImageToJpeg(file);
  console.log("📷 Image processed, size:", imageDataUrl.length, "characters");

  // Stage 1: Vision model identifies food
  const foodDescription = await identifyFoodFromImage(
    imageDataUrl,
    options.userDishDescription?.trim()
  );

  // Stage 2: Text model calculates nutrition with language support
  const result = await calculateNutritionFromDescription(foodDescription, language);

  console.log("✅ Analysis complete!");
  return result;
}