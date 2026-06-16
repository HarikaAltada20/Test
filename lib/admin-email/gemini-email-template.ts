import {
  callGeminiGenerateContent,
  getGoogleGeminiConfig,
} from "@/lib/admin-email/gemini-config";
import {
  BULK_EMAIL_MERGE_TAG_DEFAULTS,
  mergeTag,
} from "@/lib/admin-notifications/template";

type GenerateInput = {
  templateType: string;
  tone: string;
  targetAudience: string;
  industryFocus: string;
  selectedVariables: string[];
  calendlyUrl?: string | null;
  templateName?: string;
};

type GenerateResult = {
  subject: string;
  body: string;
};

function extractJsonObject(text: string): GenerateResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini response did not contain valid JSON");
  }
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
    subject?: string;
    body?: string;
  };
  const subject = parsed.subject?.trim();
  const body = parsed.body?.trim();
  if (!subject || !body) {
    throw new Error("Generated template is missing subject or body");
  }
  return { subject, body };
}

export async function generateEmailTemplateWithGemini(
  input: GenerateInput,
): Promise<GenerateResult> {
  const { generateModel } = getGoogleGeminiConfig();
  const variableList =
    input.selectedVariables.length > 0
      ? input.selectedVariables.map((v) => mergeTag(v)).join(", ")
      : BULK_EMAIL_MERGE_TAG_DEFAULTS.map((v) => mergeTag(v)).join(", ");

  const prompt = `You are an expert cold-email copywriter. Generate one outreach email template.

Requirements:
- Template type: ${input.templateType}
- Tone: ${input.tone}
- Target audience: ${input.targetAudience || "general business professionals"}
- Industry focus: ${input.industryFocus || "general"}
- Use only these merge variables where appropriate: ${variableList}
- Booking link (use only if relevant): ${input.calendlyUrl || "none"}
- Body must be HTML suitable for email (use <p>, <br>, <strong>, <a> tags; no <html> or <body> wrapper)
- Keep subject under 80 characters
- Avoid spam trigger words; write for Primary inbox, not promotional blasts
- Do not invent fake statistics or guarantees

Respond with ONLY valid JSON in this exact shape:
{"subject":"...","body":"..."}`;

  const res = await callGeminiGenerateContent(generateModel, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Gemini API error (${res.status}): ${errText.slice(0, 400)}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return extractJsonObject(text);
}
