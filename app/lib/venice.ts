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
};

const VENICE_API_KEY = "ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

// Vision model for food identification
const VISION_MODEL = "mistral-31-24b";

// Text model for nutrition calculation
const TEXT_MODEL = "qwen3-next-80b";

// Resize image to reduce payload size
async function resizeImageToJpeg(
  file: File,
  maxDimension = 720,
  quality = 0.8
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
  const timeout = setTimeout(() => controller.abort(), 180_000); // 3 minute timeout

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

type VeniceContent =
  | string
  | Array<{ text?: string; type?: string; content?: string }>
  | { text?: string; type?: string; content?: string };

function extractMessageText(content: VeniceContent | undefined): string {
  if (!content) return "";

  if (typeof content === "string") {
    return content.trim();
  }

  const readPart = (part: unknown): string => {
    if (!part) return "";
    if (typeof part === "string") return part;
    if (typeof part === "object") {
      const maybeText =
        (part as { text?: string }).text ??
        (part as { content?: string }).content;
      if (typeof maybeText === "string") {
        return maybeText;
      }
    }
    return "";
  };

  if (Array.isArray(content)) {
    return content.map((part) => readPart(part)).join("").trim();
  }

  return readPart(content).trim();
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

  const rawContent = data?.choices?.[0]?.message?.content as VeniceContent | undefined;
  const content = extractMessageText(rawContent);
  if (!content) {
    console.error("No content from vision model:", data);
    throw new Error("Vision model returned no food description");
  }

  console.log("✅ Food identified, description length:", content.length);
  return content;
}

// Stage 2: Calculate nutrition from food description using text model
async function calculateNutritionFromDescription(
  foodDescription: string
): Promise<NutritionSummary> {
  console.log("🔢 Stage 2: Calculating nutrition with", TEXT_MODEL);

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
        content: `You are a precision nutrition analyst. Calculate accurate nutritional information based on food descriptions. Provide:
- Complete macro and micronutrient breakdowns
- Realistic portion sizes with weights in grams
- Individual food item calorie estimates
- Confidence assessment with reasoning
- Visual observations that informed your analysis
- Allergens and dietary considerations

Output ONLY valid JSON matching the schema. No markdown, no extra text.`,
      },
      {
        role: "user",
        content: `Based on this detailed food description, calculate comprehensive nutrition information:

${foodDescription}

Requirements:
- Calculate realistic portion sizes and mass in grams
- Break down individual food items in the items[] array
- Include at least 3 actionable insights in notes[]
- Provide 4-6 visual observations in analysis.visualObservations
- Explain portion estimation methodology in analysis.portionEstimate
- Detail confidence reasoning in analysis.confidenceNarrative
- List allergens and cautions in analysis.cautions
- Confidence must be 1-100 (percentage, not decimal)

Return ONLY the JSON object, no markdown formatting.`,
      },
    ],
  };

  const data = await callVeniceAPI(requestBody);

  const rawContent = data?.choices?.[0]?.message?.content as VeniceContent | undefined;
  const content = extractMessageText(rawContent);
  if (!content) {
    console.error("No content from text model:", data);
    throw new Error("Nutrition calculation returned no content");
  }

  console.log("✅ Nutrition calculated, parsing JSON...");

  // Parse JSON response
  let parsed: NutritionSummary;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsedData = JSON.parse(jsonStr) as NutritionSummary & {
      confidence: number | string;
      totalCalories: number | string;
    };

    const coerceNumber = (value: number | string): number => {
      const numeric = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    if (typeof parsedData.confidence !== "number") {
      parsedData.confidence = coerceNumber(parsedData.confidence);
    }
    if (typeof parsedData.totalCalories !== "number") {
      parsedData.totalCalories = coerceNumber(parsedData.totalCalories);
    }

    parsed = parsedData;

    console.log("✅ Two-stage analysis complete!");
    return parsed;
  } catch (error) {
    console.error("Failed to parse nutrition JSON:", error);
    console.error("Raw content:", content);
    throw new Error("Failed to parse nutrition data from response");
  }
}

// Main export: Analyze image with two-stage approach
export async function analyzeImageWithVenice(
  file: File,
  options: AnalyzeImageOptions = {}
): Promise<NutritionSummary> {
  console.log("🚀 Starting two-stage analysis");
  console.log(`Vision: ${VISION_MODEL} | Nutrition: ${TEXT_MODEL}`);

  // Resize and convert image
  const imageDataUrl = await resizeImageToJpeg(file);
  console.log("📷 Image processed, size:", imageDataUrl.length, "characters");

  // Stage 1: Vision model identifies food
  const foodDescription = await identifyFoodFromImage(
    imageDataUrl,
    options.userDishDescription?.trim()
  );

  // Stage 2: Text model calculates nutrition
  const result = await calculateNutritionFromDescription(foodDescription);

  console.log("✅ Analysis complete!");
  return result;
}