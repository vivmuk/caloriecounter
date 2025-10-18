const VENICE_API_KEY = "n191pxahjwAE5VU5I8TmcPvPbKHJx0Z55VXToBj0kI";
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

type NetlifyEvent = {
  httpMethod: string;
  body?: string | null;
};

type NetlifyResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
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


