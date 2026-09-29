import {
  callGeminiGenerateContent,
  getGoogleGeminiConfig,
} from "@/lib/admin-email/gemini-config";
import {
  BULK_EMAIL_MERGE_TAG_DEFAULTS,
  filterAllowedMergeVariables,
  findMissingMergeVariables,
  getMergeVariableLabel,
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

const TEMPLATE_TYPE_GUIDANCE: Record<string, string> = {
  cold_outreach:
    "Cold outreach — first contact with someone who has not heard from us. Lead with relevance, one clear value prop, and a soft CTA.",
  follow_up:
    "Follow-up — a short second touch referencing the prior message. Be polite, add one new angle, and make replying easy.",
  newsletter:
    "Newsletter — informative update with scannable sections, useful takeaways, and light promotion.",
  promotional:
    "Promotional — highlight an offer or opportunity with clear benefits and a strong CTA without sounding spammy.",
  welcome:
    "Welcome — warm onboarding email that orients the reader and sets expectations for next steps.",
};

const TONE_GUIDANCE: Record<string, string> = {
  professional: "Professional — polished, respectful, concise; no slang.",
  friendly: "Friendly — warm and approachable while staying credible.",
  casual: "Casual — conversational and direct, like a helpful colleague.",
  formal: "Formal — structured and courteous, suitable for executive audiences.",
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

function buildVariableInstructions(variables: string[]): string {
  return variables
    .map(
      (key) =>
        `- ${mergeTag(key)} (${getMergeVariableLabel(key)}) — must appear exactly as written`,
    )
    .join("\n");
}

function buildPrompt(
  input: GenerateInput,
  variables: string[],
  options?: { missingVariables?: string[]; retry?: boolean },
): string {
  const templateType =
    TEMPLATE_TYPE_GUIDANCE[input.templateType] ??
    `${input.templateType} email`;
  const tone =
    TONE_GUIDANCE[input.tone] ?? `${input.tone} tone`;
  const audience = input.targetAudience.trim() || "general business professionals";
  const industry = input.industryFocus.trim() || "general";
  const bookingUrl = input.calendlyUrl?.trim() ?? "";
  const templateName = input.templateName?.trim() || "Outreach email";

  const bookingSection = bookingUrl
    ? `BOOKING LINK (MANDATORY):
- Include a clear CTA button or link using this exact URL: ${bookingUrl}
- Use anchor text like "Book a call" or "Schedule a meeting"`
    : "BOOKING LINK: none provided — do not invent a scheduling URL.";

  const retrySection =
    options?.missingVariables && options.missingVariables.length > 0
      ? `\nCORRECTION REQUIRED: Your previous draft omitted these merge tags. You MUST include every one exactly once, unchanged:\n${options.missingVariables.map((v) => mergeTag(v)).join(", ")}`
      : "";

  return `You are an expert email copywriter for Game of Creators, a creator marketing platform.

Write one email template that strictly follows every requirement below.

TEMPLATE NAME / THEME: ${templateName}
EMAIL TYPE: ${templateType}
TONE: ${tone}
TARGET AUDIENCE: ${audience} — write specifically for this audience; do not use a generic blast.
INDUSTRY FOCUS: ${industry} — weave in industry-relevant context, examples, or language.

MERGE VARIABLES (MANDATORY):
- Use ONLY the variables listed below for personalization.
- Every listed variable MUST appear at least once across the subject and body combined.
- Copy each variable exactly with curly braces (e.g. ${mergeTag("first_name")}). Do not rename or reformat them.
${buildVariableInstructions(variables)}

${bookingSection}

CONTENT RULES:
- Subject line under 80 characters; may include merge variables.
- Body must be HTML fragments only (<p>, <br>, <strong>, <em>, <a>, <ul>, <li>). No <html>, <head>, or <body> wrapper.
- Match the requested email type, tone, audience, industry, and template theme.
- Avoid spam trigger words; aim for Primary inbox, not a promotional blast.
- Do not invent statistics, testimonials, or guarantees.
${retrySection}

Respond with ONLY valid JSON in this exact shape:
{"subject":"...","body":"..."}`;
}

async function callGemini(prompt: string): Promise<GenerateResult> {
  const { generateModel } = getGoogleGeminiConfig();
  const res = await callGeminiGenerateContent(generateModel, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.65,
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

function ensureRequiredContent(
  result: GenerateResult,
  variables: string[],
  calendlyUrl?: string | null,
): GenerateResult {
  let { subject, body } = result;
  const missing = findMissingMergeVariables(subject, body, variables);

  if (missing.length > 0) {
    const tags = missing.map((key) => mergeTag(key)).join(", ");
    body = `${body}<p>${tags}</p>`;
  }

  const bookingUrl = calendlyUrl?.trim();
  if (bookingUrl && !`${subject}\n${body}`.includes(bookingUrl)) {
    body = `${body}<p><a href="${bookingUrl}">Book a call</a></p>`;
  }

  return { subject, body };
}

export async function generateEmailTemplateWithGemini(
  input: GenerateInput,
): Promise<GenerateResult> {
  const variables = filterAllowedMergeVariables(
    input.selectedVariables.length > 0
      ? input.selectedVariables
      : [...BULK_EMAIL_MERGE_TAG_DEFAULTS],
  );

  let result = await callGemini(buildPrompt(input, variables));
  let missing = findMissingMergeVariables(
    result.subject,
    result.body,
    variables,
  );
  const bookingUrl = input.calendlyUrl?.trim();
  const missingBooking = bookingUrl
    ? !`${result.subject}\n${result.body}`.includes(bookingUrl)
    : false;

  if (missing.length > 0 || missingBooking) {
    result = await callGemini(
      buildPrompt(input, variables, {
        missingVariables: missing,
        retry: true,
      }),
    );
    missing = findMissingMergeVariables(result.subject, result.body, variables);
  }

  return ensureRequiredContent(result, variables, input.calendlyUrl);
}
