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

export type VeniceVisionModelId = "qwen-2.5-vl" | "venice-medium" | "venice-large";

export type VeniceVisionModelConfig = {
  id: VeniceVisionModelId;
  label: string;
  description: string;
  badge?: string;
  strengths?: string;
};

export type AnalyzeImageOptions = {
  userDishDescription?: string;
  model?: VeniceVisionModelId;
};

export const VENICE_VISION_MODELS: VeniceVisionModelConfig[] = [
  {
    id: "qwen-2.5-vl",
    label: "Qwen 2.5 VL",
    description: "72B flagship: balanced reasoning, confident portion sizing",
    badge: "Best overall",
  },
  {
    id: "venice-medium",
    label: "Venice Medium",
    description: "24B: fast responses, good for quick nutrition analysis",
    badge: "Fast",
  },
  {
    id: "venice-large",
    label: "Venice Large",
    description: "235B: deep reasoning, excellent for complex dishes",
    badge: "Premium",
  },
];

const DEFAULT_MODEL: VeniceVisionModelId = VENICE_VISION_MODELS[0].id;

const VENICE_API_KEY = "ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_PROXY_URL = "/api/venice"; // Netlify function proxy for production

const SYSTEM_PROMPT = `You are a meticulous nutrition analyst. Given a photo of food (and optional user dish hints), output a single JSON object that follows the provided schema exactly. Provide a realistic breakdown with portion sizing, macro and micro nutrients, and highlight any assumptions or cautions in notes. Avoid prose outside JSON.`;

async function resizeImageToJpeg(file: File, maxDimension = 1024, quality = 0.85): Promise<string> {
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
  | { type: "image_url"; image_url: { url: string } };

export async function analyzeImageWithVenice(file: File, options: AnalyzeImageOptions = {}): Promise<NutritionSummary> {
  const imageDataUrl = await resizeImageToJpeg(file);
  const userDishDescription = options.userDishDescription?.trim();
  const model = options.model ?? DEFAULT_MODEL;
  // Ensure we only use supported vision models
  const supportedModels: VeniceVisionModelId[] = ["qwen-2.5-vl", "venice-medium", "venice-large"];
  const selectedModel: VeniceVisionModelId = supportedModels.includes(model) ? model : DEFAULT_MODEL;

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
    model: selectedModel,
    temperature: 0.15,
    response_format: { type: "json_schema", json_schema: { name: "nutrition_summary", schema } },
    venice_parameters: { include_venice_system_prompt: true },
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: SYSTEM_PROMPT }]
      },
      {
        role: "user",
        content: userContent
      }
    ]
  } as const;

  async function post(url: string) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
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
      throw new Error("Selected model is not supported for vision on Venice. Please switch to Qwen 2.5 VL and try again.");
    }
    throw new Error(`Venice API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  // Venice Chat API shape is OpenAI-like: choices[0].message.content
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from Venice");
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
