import { ModelConfig, ProcessedImage } from "./types";

// Venice AI Configuration (using existing implementation)
export const VENICE_CONFIG: ModelConfig = {
  name: "venice",
  displayName: "Venice AI",
  endpoint: "https://api.venice.ai/api/v1/chat/completions",
  apiKeyEnv: "VENICE_API_KEY",
  timeout: 300000, // 5 minutes
  temperature: 0.3,
};

// Specific model configurations
export const GEMINI_FLASH_CONFIG: ModelConfig = {
  name: "gemini-3-flash",
  displayName: "Gemini 3 Flash",
  endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
  apiKeyEnv: "GEMINI_API_KEY",
  timeout: 30000,
  temperature: 0.3,
};

export const MINIMAX_M21_CONFIG: ModelConfig = {
  name: "minimax-m21",
  displayName: "MiniMax M21",
  endpoint: "https://api.minimax.chat/v1/text/chatcompletion_v2",
  apiKeyEnv: "MINIMAX_API_KEY",
  timeout: 25000,
  temperature: 0.4,
};

export const GROK_41_CONFIG: ModelConfig = {
  name: "grok-41-fast",
  displayName: "Grok 41 Fast",
  endpoint: "https://api.x.ai/v1/chat/completions",
  apiKeyEnv: "GROK_API_KEY",
  timeout: 20000,
  temperature: 0.5,
};

// Unified API call function
export async function callModelAPI(
  config: ModelConfig,
  imageBase64: string,
  prompt: string,
  isImageRequest: boolean = true
): Promise<any> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${config.name} API key not configured`);
  }

  // Set up timeout controller
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout);

  try {
    let response;

    if (config.name === "venice") {
      // Venice API format (OpenAI compatible)
      response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-31-24b", // Vision model for food identification
          messages: isImageRequest ? [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
              ]
            }
          ] : [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: config.temperature,
          venice_parameters: {
            include_venice_system_prompt: true,
          }
        }),
        signal: controller.signal,
      });
    } else if (config.name === "gemini-3-flash") {
      // Gemini API format
      response = await fetch(`${config.endpoint}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: isImageRequest ? [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
            ] : [
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: config.temperature,
            responseMimeType: "application/json",
          }
        }),
        signal: controller.signal,
      });
    } else if (config.name === "minimax-m21") {
      // MiniMax API format
      response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "abab6.5-chat",
          messages: isImageRequest ? [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
              ]
            }
          ] : [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: config.temperature,
        }),
        signal: controller.signal,
      });
    } else if (config.name === "grok-41-fast") {
      // Grok API format (OpenAI compatible)
      response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-41-fast",
          messages: isImageRequest ? [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
              ]
            }
          ] : [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: config.temperature,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });
    } else {
      throw new Error(`Unsupported model: ${config.name}`);
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${config.name} API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${config.name} API request timed out after ${config.timeout}ms`);
    }
    
    throw error;
  }
}

// Extract text content from API response
export function extractTextFromResponse(data: any): string | undefined {
  // Handle Venice/OpenAI/Grok response (choices format)
  if (data?.choices?.[0]?.message?.content) {
    const content = data.choices[0].message.content;

    // Handle string content
    if (typeof content === "string") {
      return content;
    }

    // Handle array content
    if (Array.isArray(content)) {
      const combined = content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item?.text) return item.text;
          if (item?.type === "text") return item.text;
          return "";
        })
        .filter(Boolean)
        .join(" ")
        .trim();
      if (combined) return combined;
    }
  }

  // Handle Gemini response
  if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  // Handle MiniMax response
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  
  // Handle array responses
  if (Array.isArray(data)) {
    const combined = data
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.text) return item.text;
        if (item?.type === "text") return item.text;
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
    if (combined) return combined;
  }
  
  return undefined;
}