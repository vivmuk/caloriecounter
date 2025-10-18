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

const VENICE_API_KEY = "n191pxahjwAE5VU5I8TmcPvPbKHJx0Z55VXToBj0kI";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

function getEnv(name: string): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const env = import.meta.env as Record<string, string | undefined>;
    return env[name] ?? env[`VITE_${name}`];
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}

// Vision model for food identification
const VISION_MODEL =
  getEnv("VENICE_VISION_MODEL") ?? "mistral-31-24b";

// Text model for nutrition calculation - using stable model without reasoning
const TEXT_MODEL = getEnv("VENICE_TEXT_MODEL") ?? "qwen3-235b";

type ProcessedImage = {
  dataUrl: string;
  base64: string;
  mediaType: string;
};

// Resize image to reduce payload size
async function resizeImageToJpeg(
  file: File,
  maxDimension = 800,
  quality = 0.85
): Promise<ProcessedImage> {
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
  const [prefix, base64Data] = dataUrl.split(",", 2);
  const mediaTypeMatch = prefix.match(/^data:(.*);base64$/);
  const mediaType = mediaTypeMatch?.[1] ?? "image/jpeg";

  return {
    dataUrl,
    base64: base64Data,
    mediaType,
  };
}

// Make API request to Venice
async function callVeniceAPI(body: any): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 minute timeout for stable model

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
      
      // Handle 404 errors (model not found) with helpful message
      if (response.status === 404) {
        throw new Error(
          `Model not found (404). The selected model may not be available. Please try again or contact support.`
        );
      }
      
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

function extractTextFromResponse(data: any): string | undefined {
  const choiceContent = data?.choices?.[0]?.message?.content;
  if (typeof choiceContent === "string") {
    return choiceContent;
  }

  if (Array.isArray(choiceContent)) {
    const combined = choiceContent
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.text) return item.text;
        if (item?.type === "output_text") return item.text;
        if (item?.type === "text") return item.text;
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
    if (combined) return combined;
  }

  const outputText = data?.output_text;
  if (Array.isArray(outputText)) {
    const combined = outputText.join("\n").trim();
    if (combined) return combined;
  }

  const outputContent = data?.output ?? data?.response?.output;
  if (Array.isArray(outputContent)) {
    const combined = outputContent
      .map((item: any) => {
        const itemContent = item?.content;
        if (typeof itemContent === "string") return itemContent;
        if (Array.isArray(itemContent)) {
          return itemContent
            .map((child: any) => child?.text ?? "")
            .filter(Boolean)
            .join(" ");
        }
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
    if (combined) return combined;
  }

  return undefined;
}

// Stage 1: Identify food items from image using vision model
async function identifyFoodFromImage(
  processedImage: ProcessedImage,
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
    image_url: {
      url: processedImage.dataUrl,
    },
  });

  const requestBody = {
    model: VISION_MODEL,
    temperature: 0.6,
    venice_parameters: {
      include_venice_system_prompt: true,
    },
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "You are an expert food analyst. Analyze food images and provide comprehensive, detailed descriptions of all visible food items, portions, and preparation methods.",
          },
        ],
      },
      {
        role: "user",
        content: userContent,
      },
    ],
  };

  const data = await callVeniceAPI(requestBody);

  const content = extractTextFromResponse(data);
  if (!content) {
    console.error("No content from vision model:", data);
    throw new Error("Vision model returned no food description");
  }

  console.log("✅ Food identified, description length:", content.length);
  return content;
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

  const buildRequestBody = (useSchema: boolean) => {
  const body: Record<string, unknown> = {
      model: TEXT_MODEL,
      temperature: 0.6,
      venice_parameters: {
        include_venice_system_prompt: true,
        disable_thinking: true,
        strip_thinking_response: true,
      },
    messages: [
      {
        role: "system",
          content: [
            {
              type: "text",
              text: languageInstructions.systemPrompt,
            },
          ],
      },
      {
        role: "user",
          content: [
            {
              type: "text",
              text: languageInstructions.userPrompt,
            },
          ],
        },
      ],
    };

    if (useSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "nutrition_summary",
          schema: schema,
        },
      };
    }

    return body;
  };

  let data: any;
  let usedSchema = true;
  try {
    data = await callVeniceAPI(buildRequestBody(true));
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error);
    if (message.includes("response_format") && message.includes("not supported")) {
      console.warn(
        "⚠️ Selected model does not support response schemas. Retrying with manual JSON instructions."
      );
      usedSchema = false;
      data = await callVeniceAPI(buildRequestBody(false));
    } else {
      throw error;
    }
  }

  if (!usedSchema) {
    console.log("ℹ️ Proceeding without response schema enforcement.");
  }

  const content = extractTextFromResponse(data);
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
      
      // 5. Fix common JSON issues
      jsonStr = jsonStr.replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Add quotes to unquoted keys
      jsonStr = jsonStr.replace(/:\s*([^",{\[\s][^,}\]\s]*)\s*([,}\]])/g, ': "$1"$2'); // Add quotes to unquoted string values
      
      console.log("🧹 JSON cleaned, attempting parse...");
      console.log("Cleaned JSON preview:", jsonStr.substring(0, 200) + "...");
      
      try {
      parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("❌ JSON parse failed, trying fallback parsing...");
        // Try to extract just the core JSON object
        const coreMatch = jsonStr.match(/\{[\s\S]*"title"[\s\S]*\}/);
        if (coreMatch) {
          parsed = JSON.parse(coreMatch[0]);
        } else {
          throw parseError;
        }
      }
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

// Single-stage analysis using vision model for both food identification and nutrition
async function analyzeSingleStage(
  processedImage: ProcessedImage,
  userHint?: string,
  language: "english" | "french" = "english"
): Promise<NutritionSummary> {
  console.log("🔍 Single-stage analysis with", VISION_MODEL);

  const schema = {
    type: "object",
    required: ["title", "confidence", "servingDescription", "totalCalories", "macros"],
    properties: {
      title: { type: "string", description: "Name of the dish or meal" },
      confidence: { type: "number", description: "Confidence score 1-100 (percentage)" },
      servingDescription: { type: "string", description: "Description of serving size with weight" },
      totalCalories: { type: "number", description: "Total calories" },
      macros: {
        type: "object",
        required: ["protein", "carbs", "fat"],
        properties: {
          protein: { type: "object", required: ["grams", "calories"], properties: { grams: { type: "number" }, calories: { type: "number" } } },
          carbs: { type: "object", required: ["grams", "calories"], properties: { grams: { type: "number" }, calories: { type: "number" }, fiber: { type: "number" }, sugar: { type: "number" } } },
          fat: { type: "object", required: ["grams", "calories"], properties: { grams: { type: "number" }, calories: { type: "number" }, saturated: { type: "number" }, unsaturated: { type: "number" } } }
        }
      },
      micronutrients: {
        type: "object",
        properties: {
          sodiumMg: { type: "number" }, potassiumMg: { type: "number" }, cholesterolMg: { type: "number" },
          calciumMg: { type: "number" }, ironMg: { type: "number" }, vitaminCMg: { type: "number" }
        }
      },
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "quantity", "calories"],
          properties: { name: { type: "string" }, quantity: { type: "string" }, calories: { type: "number" }, massGrams: { type: "number" } }
        }
      },
      notes: { type: "array", items: { type: "string" } },
      analysis: {
        type: "object",
        properties: {
          visualObservations: { type: "array", items: { type: "string" } },
          portionEstimate: { type: "string" },
          confidenceNarrative: { type: "string" },
          cautions: { type: "array", items: { type: "string" } }
        }
      }
    }
  };

  const languageInstructions = language === "french"
    ? {
        systemPrompt: `Vous êtes un analyste nutritionnel expert. Analysez l'image de nourriture et calculez les informations nutritionnelles complètes. Fournissez UNIQUEMENT un JSON valide correspondant au schéma.`,
        userPrompt: `Analysez cette image de nourriture et calculez les informations nutritionnelles complètes. TOUTES les valeurs numériques doivent être des nombres entiers. Retournez UNIQUEMENT le JSON.`
      }
    : {
        systemPrompt: `You are an expert nutrition analyst. Analyze the food image and calculate comprehensive nutritional information. Provide ONLY valid JSON matching the schema.`,
        userPrompt: `Analyze this food image and calculate comprehensive nutritional information. ALL numeric values must be whole integers. Return ONLY the JSON.`
      };

  const userContent: any[] = [];
  if (userHint) {
    userContent.push({ type: "text", text: `User hint: "${userHint}". Use this as context.` });
  }
  userContent.push({ type: "text", text: languageInstructions.userPrompt });
  userContent.push({ type: "image_url", image_url: { url: processedImage.dataUrl } });

  const requestBody = {
    model: VISION_MODEL,
    temperature: 0.6,
    // Remove JSON schema for now - vision model might not support it
    venice_parameters: { include_venice_system_prompt: true, disable_thinking: true, strip_thinking_response: true },
    messages: [
      { role: "system", content: [{ type: "text", text: languageInstructions.systemPrompt }] },
      { role: "user", content: userContent }
    ]
  };

  const data = await callVeniceAPI(requestBody);
  const content = data?.choices?.[0]?.message?.content;
  
  if (!content) {
    console.error("❌ No content received from vision model");
    console.error("Full response:", data);
    throw new Error("Vision model returned no content");
  }

  console.log("✅ Single-stage content received, parsing JSON...");
  console.log("Raw content preview:", typeof content, content?.substring(0, 200) + "...");
  
  let parsed: NutritionSummary;
  try {
    if (typeof content === "string") {
      console.log("🔍 Parsing string content...");
      
      // Try to find JSON in the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ No JSON found in content");
        console.error("Content:", content);
        throw new Error("No JSON found in vision model response");
      }
      
      const jsonStr = jsonMatch[0];
      console.log("📝 Found JSON, cleaning...");
      
      // Clean JSON more aggressively
      let cleanedJson = jsonStr
        .replace(/\t/g, " ")                    // Replace tabs
        .replace(/(\d+)\.\d{50,}/g, "$1")      // Truncate long decimals
        .replace(/:\s*(\d+)\.\d+/g, ": $1")    // Round decimals to integers
        .replace(/,(\s*[}\]])/g, "$1")         // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
        .replace(/:\s*([^",{\[\s][^,}\]\s]*)\s*([,}\]])/g, ': "$1"$2'); // Add quotes to unquoted strings
      
      console.log("🧹 Cleaned JSON preview:", cleanedJson.substring(0, 300) + "...");
      parsed = JSON.parse(cleanedJson);
    } else {
      console.log("📦 Content is already parsed object");
      parsed = content;
    }
  } catch (error) {
    console.error("❌ Failed to parse single-stage JSON:", error);
    console.error("Raw content:", content);
    console.error("Content type:", typeof content);
    throw new Error("Failed to parse nutrition data from single-stage analysis");
  }
  
  return parsed;
}

// Main export: Analyze image with single-stage approach using vision model
export async function analyzeImageWithVenice(
  file: File,
  options: AnalyzeImageOptions = {}
): Promise<NutritionSummary> {
  const language = options.language || "english";
  console.log("🚀 Starting single-stage analysis");
  console.log(`Vision: ${VISION_MODEL} | Language: ${language}`);

  // Resize and convert image
  const processedImage = await resizeImageToJpeg(file);
  console.log(
    "📷 Image processed, base64 size:",
    processedImage.base64.length,
    "characters"
  );

  // Single-stage: Vision model does both food identification and nutrition calculation
  const result = await analyzeSingleStage(processedImage, options.userDishDescription?.trim(), language);

  console.log("✅ Analysis complete!");
  return result;
}
