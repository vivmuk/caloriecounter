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
  confidence: number; // 0..1
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

export type VeniceVisionModelId = "qwen-2.5-vl" | "mistral-31-24b" | "mistral-32-24b";
export type VeniceTextModelId = "qwen3-235b" | "qwen-2.5-qwq-32b" | "llama-3.1-405b";

export type VeniceVisionModelConfig = {
  id: VeniceVisionModelId;
  label: string;
  description: string;
  badge?: string;
  strengths?: string;
};

export type VeniceTextModelConfig = {
  id: VeniceTextModelId;
  label: string;
  description: string;
  badge?: string;
};

export type AnalyzeImageOptions = {
  userDishDescription?: string;
  visionModel?: VeniceVisionModelId;
  textModel?: VeniceTextModelId;
};

export const VENICE_VISION_MODELS: VeniceVisionModelConfig[] = [
  {
    id: "qwen-2.5-vl",
    label: "Qwen 2.5 VL 72B",
    description: "72B: excellent food identification and portion estimation",
    badge: "Best overall",
  },
  {
    id: "mistral-31-24b",
    label: "Venice Medium",
    description: "24B: fast food detection with good accuracy",
    badge: "Fast",
  },
  {
    id: "mistral-32-24b",
    label: "Venice Medium 1.1",
    description: "24B: latest vision model for detailed food analysis",
    badge: "Beta",
  },
];

export const VENICE_TEXT_MODELS: VeniceTextModelConfig[] = [
  {
    id: "qwen3-235b",
    label: "Venice Large 1.1",
    description: "235B: precise macro calculations and nutritional analysis",
    badge: "Premium",
  },
  {
    id: "qwen-2.5-qwq-32b",
    label: "Venice Reasoning",
    description: "32B: advanced reasoning for complex nutritional breakdowns",
    badge: "Smart",
  },
  {
    id: "llama-3.1-405b",
    label: "Llama 3.1 405B",
    description: "405B: most intelligent model for complex nutritional analysis",
    badge: "Most Intelligent",
  },
];

const DEFAULT_VISION_MODEL: VeniceVisionModelId = VENICE_VISION_MODELS[0].id;
const DEFAULT_TEXT_MODEL: VeniceTextModelId = VENICE_TEXT_MODELS[0].id;

const VENICE_API_KEY = "ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_PROXY_URL = "/api/venice"; // Netlify function proxy for production

const VISION_SYSTEM_PROMPT = `You are a food identification specialist. Analyze the image thoroughly and provide detailed observations about:
- Food items and their preparation methods
- Portion sizes and visual cues for estimation
- Cooking techniques and ingredients visible
- Plating style and presentation details
- Any garnishes, sauces, or accompaniments
- Texture, color, and visual indicators of freshness
Be comprehensive and specific in your descriptions.`;

const NUTRITION_SYSTEM_PROMPT = `You are a meticulous nutrition analyst. Calculate precise nutritional content and provide comprehensive analysis including:
- Detailed macro and micronutrient breakdowns
- Confidence assessment with specific reasoning
- Visual observations that informed your analysis
- Portion estimation methodology and logic
- Potential allergens and dietary considerations
- Cooking method impacts on nutrition
- Measurement assumptions and limitations
Output a single JSON object that follows the provided schema exactly.`;

async function resizeImageToJpeg(file: File, maxDimension = 1024, quality = 1.0): Promise<string> {
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

type VeniceMessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

// Helper function for making Venice API requests
async function makeVeniceRequest(body: any): Promise<Response> {
  async function post(url: string) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120_000); // 2 minutes for two-stage process
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VENICE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  let res: Response;
  try {
    res = await post(VENICE_API_URL);
    if (!res.ok) {
      // fallback via Netlify proxy to avoid CORS in production
      res = await post(VENICE_PROXY_URL);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Venice request timed out. Try again or switch to a lighter model.");
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    if (text && (text.includes("Unsupported tokenizer") || text.includes("MistralTokenizer"))) {
      throw new Error("Selected model is not supported. Please try a different model.");
    }
    throw new Error(`Venice API error: ${res.status} ${text}`);
  }

  return res;
}

// Stage 1: Food identification using vision model
async function identifyFoodItems(imageDataUrl: string, userDishDescription?: string, visionModel: VeniceVisionModelId = DEFAULT_VISION_MODEL): Promise<string> {
  const supportedVisionModels: VeniceVisionModelId[] = ["qwen-2.5-vl", "mistral-31-24b", "mistral-32-24b"];
  const selectedVisionModel: VeniceVisionModelId = supportedVisionModels.includes(visionModel) ? visionModel : DEFAULT_VISION_MODEL;

  // Extract base64 data without data URL prefix (Venice-specific format)
  const base64Data = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  console.log("Using Venice-specific base64 format, length:", base64Data.length);

  const userContent: VeniceMessageContent[] = [];
  if (userDishDescription) {
    userContent.push({
      type: "text",
      text: `User provided dish hint: "${userDishDescription}". Use this to guide your analysis.`
    });
  }
  userContent.push({
    type: "text",
    text: "Analyze this food image comprehensively. Describe: 1) All visible food items with specific names and preparation methods, 2) Portion sizes with visual reference points (plate size, utensils, etc.), 3) Cooking techniques evident from appearance (grilled, fried, steamed, etc.), 4) Sauce types, seasonings, and garnishes, 5) Texture and doneness indicators, 6) Plating style and presentation details, 7) Any accompaniments or side dishes. Be extremely detailed and specific."
  });
  
  // Venice-specific format: base64 string only (no data URL prefix)
  userContent.push({
    type: "image_url",
    image_url: { url: base64Data }
  });

  const body = {
    model: selectedVisionModel,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: VISION_SYSTEM_PROMPT }]
      },
      {
        role: "user",
        content: userContent
      }
    ]
  };
  
  console.log("Vision request model:", selectedVisionModel);
  console.log("Vision request body size:", JSON.stringify(body).length);

  const res = await makeVeniceRequest(body);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No food identification returned from Venice vision model");
  }
  
  return typeof content === "string" ? content : JSON.stringify(content);
}

// Stage 2: Nutrition calculation using text model
async function calculateNutrition(foodDescription: string, textModel: VeniceTextModelId = DEFAULT_TEXT_MODEL): Promise<NutritionSummary> {
  const supportedTextModels: VeniceTextModelId[] = ["qwen3-235b", "qwen-2.5-qwq-32b", "llama-3.1-405b"];
  const selectedTextModel: VeniceTextModelId = supportedTextModels.includes(textModel) ? textModel : DEFAULT_TEXT_MODEL;

  const schema = {
    type: "object",
    required: [
      "title",
      "confidence",
      "servingDescription",
      "totalCalories",
      "macros"
    ],
    properties: {
      title: { type: "string" },
      confidence: { type: "number" },
      servingDescription: { type: "string" },
      totalCalories: { type: "number" },
      macros: {
        type: "object",
        required: ["protein", "carbs", "fat"],
        properties: {
          protein: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" }
            }
          },
          carbs: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" },
              fiber: { type: "number" },
              sugar: { type: "number" }
            }
          },
          fat: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" },
              saturated: { type: "number" },
              unsaturated: { type: "number" }
            }
          }
        }
      },
      micronutrients: {
        type: "object",
        properties: {
          sodiumMg: { type: "number" },
          potassiumMg: { type: "number" },
          cholesterolMg: { type: "number" },
          calciumMg: { type: "number" },
          ironMg: { type: "number" },
          vitaminCMg: { type: "number" }
        }
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
            massGrams: { type: "number" }
          }
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
  } as const;

  const coreInstruction = [
    "You must respond with strict JSON conforming to the schema.",
    "Calculate realistic portion sizes and mass in grams based on the detailed food description.",
    "List distinct food components inside items[] with accurate calorie estimates.",
    "Include at least 3 actionable nutritional insights in notes[].",
    "Use analysis.visualObservations to detail 4-6 specific visual cues from the food description that informed your analysis (colors, textures, cooking methods, portion indicators, etc.).",
    "Use analysis.portionEstimate to explain your serving size methodology with specific reference points.",
    "Use analysis.confidenceNarrative to provide detailed reasoning for your confidence score, including what you're certain about and what has uncertainty.",
    "Use analysis.cautions for comprehensive allergen warnings, dietary restrictions, and measurement limitations.",
    "Ensure confidence is a percentage between 1-100 (not decimal)."
  ].join(" ");

  const body = {
    model: selectedTextModel,
    temperature: 0.1,
    response_format: { type: "json_schema", json_schema: { name: "nutrition_summary", schema } },
    messages: [
      {
        role: "system",
        content: NUTRITION_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `Based on this food description, calculate detailed nutrition information:\n\n${foodDescription}\n\n${coreInstruction} Return only JSON without markdown.`
      }
    ]
  } as const;

  const res = await makeVeniceRequest(body);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No nutrition content returned from Venice text model");
  }

  let parsed: NutritionSummary;
  try {
    if (typeof content === "string") {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      const jsonStr = start >= 0 && end >= 0 ? content.slice(start, end + 1) : content;
      parsed = JSON.parse(jsonStr);
    } else {
      parsed = content;
    }
  } catch (e) {
    throw new Error("Failed to parse nutrition JSON");
  }
  return parsed;
}

// Single-stage fallback (original approach)
async function analyzeSingleStage(imageDataUrl: string, userDishDescription?: string, visionModel: VeniceVisionModelId = DEFAULT_VISION_MODEL): Promise<NutritionSummary> {
  const supportedVisionModels: VeniceVisionModelId[] = ["qwen-2.5-vl", "mistral-31-24b", "mistral-32-24b"];
  const selectedVisionModel: VeniceVisionModelId = supportedVisionModels.includes(visionModel) ? visionModel : DEFAULT_VISION_MODEL;

  const schema = {
    type: "object",
    required: [
      "title",
      "confidence",
      "servingDescription",
      "totalCalories",
      "macros"
    ],
    properties: {
      title: { type: "string" },
      confidence: { type: "number" },
      servingDescription: { type: "string" },
      totalCalories: { type: "number" },
      macros: {
        type: "object",
        required: ["protein", "carbs", "fat"],
        properties: {
          protein: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" }
            }
          },
          carbs: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" },
              fiber: { type: "number" },
              sugar: { type: "number" }
            }
          },
          fat: {
            type: "object",
            required: ["grams", "calories"],
            properties: {
              grams: { type: "number" },
              calories: { type: "number" },
              saturated: { type: "number" },
              unsaturated: { type: "number" }
            }
          }
        }
      },
      micronutrients: {
        type: "object",
        properties: {
          sodiumMg: { type: "number" },
          potassiumMg: { type: "number" },
          cholesterolMg: { type: "number" },
          calciumMg: { type: "number" },
          ironMg: { type: "number" },
          vitaminCMg: { type: "number" }
        }
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
            massGrams: { type: "number" }
          }
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
  } as const;

  const coreInstruction = [
    "You must respond with strict JSON conforming to the schema.",
    "Estimate realistic portion sizes and mass in grams when possible.",
    "List distinct food components inside items[].",
    "Include at least two actionable insights in notes[].",
    "Use analysis.visualObservations to capture key visual cues and assumptions.",
    "Use analysis.portionEstimate to summarise serving size logic.",
    "Use analysis.confidenceNarrative to explain the confidence score.",
    "Use analysis.cautions for allergen, diet, or measurement cautions."
  ].join(" ");

  const userContent: VeniceMessageContent[] = [];
  if (userDishDescription) {
    userContent.push({
      type: "text",
      text: `User provided dish hint: "${userDishDescription}". Align the assessment with this context while verifying against the image.`
    });
  }
  userContent.push({
    type: "text",
    text: `${coreInstruction} Return only JSON without markdown.`
  });
  userContent.push({
    type: "image_url",
    image_url: { url: imageDataUrl }
  });

  const body = {
    model: selectedVisionModel,
    temperature: 0.15,
    response_format: { type: "json_schema", json_schema: { name: "nutrition_summary", schema } },
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: "You are a meticulous nutrition analyst. Given a photo of food (and optional user dish hints), output a single JSON object that follows the provided schema exactly. Provide a realistic breakdown with portion sizing, macro and micro nutrients, and highlight any assumptions or cautions in notes. Avoid prose outside JSON." }]
      },
      {
        role: "user",
        content: userContent
      }
    ]
  } as const;

  const res = await makeVeniceRequest(body);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No nutrition content returned from Venice vision model");
  }

  let parsed: NutritionSummary;
  try {
    if (typeof content === "string") {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      const jsonStr = start >= 0 && end >= 0 ? content.slice(start, end + 1) : content;
      parsed = JSON.parse(jsonStr);
    } else {
      parsed = content;
    }
  } catch (e) {
    throw new Error("Failed to parse nutrition JSON");
  }
  return parsed;
}

// Main analysis function with fallback
export async function analyzeImageWithVenice(file: File, options: AnalyzeImageOptions = {}): Promise<NutritionSummary> {
  const imageDataUrl = await resizeImageToJpeg(file);
  const userDishDescription = options.userDishDescription?.trim();
  const visionModel = options.visionModel ?? DEFAULT_VISION_MODEL;
  const textModel = options.textModel ?? DEFAULT_TEXT_MODEL;

  try {
    // Try two-stage processing first
    const foodDescription = await identifyFoodItems(imageDataUrl, userDishDescription, visionModel);
    const nutritionSummary = await calculateNutrition(foodDescription, textModel);
    return nutritionSummary;
  } catch (error) {
    console.warn("Two-stage processing failed, falling back to single-stage:", error);
    
    // Fallback to single-stage processing
    return await analyzeSingleStage(imageDataUrl, userDishDescription, visionModel);
  }
}