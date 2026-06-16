export type GoogleGeminiConfig = {
  apiKey: string;
  project: string | null;
  location: string;
  generateModel: string;
  jsonModel: string;
  streamModel: string;
  synthesizeModel: string;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getGoogleGeminiConfig(): GoogleGeminiConfig {
  const apiKey = env("GOOGLE_API_KEY") || env("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY (or GEMINI_API_KEY) is not configured",
    );
  }

  const generateModel =
    env("GEMINI_GENERATE_MODEL") ||
    env("GEMINI_JSON_MODEL") ||
    "gemini-2.0-flash";

  return {
    apiKey,
    project: env("GOOGLE_CLOUD_PROJECT") || null,
    location: env("GOOGLE_CLOUD_LOCATION") || "global",
    generateModel,
    jsonModel: env("GEMINI_JSON_MODEL") || generateModel,
    streamModel: env("GEMINI_STREAM_MODEL") || generateModel,
    synthesizeModel:
      env("GEMINI_SYNTHESIZE_MODEL") || env("GEMINI_JSON_MODEL") || generateModel,
  };
}

/** Build generateContent URL for Vertex (project set) or AI Studio fallback. */
export function buildGeminiGenerateContentUrl(model: string): string {
  const { apiKey, project, location } = getGoogleGeminiConfig();
  const encodedModel = encodeURIComponent(model);
  const encodedKey = encodeURIComponent(apiKey);

  if (project) {
    const host =
      location === "global"
        ? "https://aiplatform.googleapis.com"
        : `https://${encodeURIComponent(location)}-aiplatform.googleapis.com`;
    return `${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodedModel}:generateContent?key=${encodedKey}`;
  }

  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
}

export async function callGeminiGenerateContent(
  model: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const url = buildGeminiGenerateContentUrl(model);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
