import type { Handler } from "@netlify/functions";

const VENICE_API_KEY = "ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const body = event.body || "{}";
    const res = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VENICE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body
    });

    const text = await res.text();
    return {
      statusCode: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: text
    };
  } catch (err) {
    return { statusCode: 500, body: (err as Error).message };
  }
};


