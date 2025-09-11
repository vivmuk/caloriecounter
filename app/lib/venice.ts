export type NutritionMacro = {
  grams: number;
  calories: number;
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
  }>;
  notes?: string[];
};

const VENICE_API_KEY = "ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_PROXY_URL = "/api/venice"; // Netlify function proxy for production
const VENICE_MODEL = "mistral-31-24b"; // supports vision per Venice model list

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

export async function analyzeImageWithVenice(file: File): Promise<NutritionSummary> {
  const imageDataUrl = await resizeImageToJpeg(file);

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
            calories: { type: "number" }
          }
        }
      },
      notes: { type: "array", items: { type: "string" } }
    }
  } as const;

  const body = {
    model: VENICE_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "You are a nutritionist. Analyze the food in the image and respond ONLY with a strict JSON object matching this schema: {title:string, confidence:number (0..1), servingDescription:string, totalCalories:number, macros:{protein:{grams:number, calories:number}, carbs:{grams:number, calories:number, fiber?:number, sugar?:number}, fat:{grams:number, calories:number, saturated?:number, unsaturated?:number}}, micronutrients?:{sodiumMg?:number,potassiumMg?:number,cholesterolMg?:number,calciumMg?:number,ironMg?:number,vitaminCMg?:number}, items?:[{name:string,quantity:string,calories:number}], notes?:string[]}. No prose or code fences."
          },
          {
            type: "image_url",
            image_url: { url: imageDataUrl }
          }
        ]
      }
    ]
  } as const;

  async function post(url: string) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VENICE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  let res = await post(VENICE_API_URL);
  if (!res.ok) {
    // fallback via Netlify proxy to avoid CORS in production
    res = await post(VENICE_PROXY_URL);
  }

  if (!res.ok) {
    const text = await res.text();
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


