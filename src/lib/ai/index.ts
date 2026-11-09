import { z } from "zod";
import { env } from "@/lib/env";
import { ISSUE_CATEGORIES, type IssueCategory, type IssueSeverity } from "@/lib/constants";

const classificationSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  english_explanation: z.string().min(1).max(500),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export interface IssueClassification {
  category: IssueCategory;
  explanation: string;
  severity: IssueSeverity;
  status: "suggested" | "unavailable";
  provider: "gemini" | "heuristic" | "none";
}

const TAMIL_KEYWORDS: { category: IssueCategory; words: string[] }[] = [
  { category: "Machine Breakdown", words: ["மெஷின்", "இயந்திர", "பழுத", "machine", "breakdown", "needle", "motor"] },
  { category: "Labour Shortage", words: ["தொழிலாள", "ஆள்", "வேலைக்கு ஆள்", "labour", "labor", "worker", "absent", "ஆட்கள்"] },
  { category: "Raw Material Shortage", words: ["மூலப்பொருள்", "துணி", "நூல்", "yarn", "fabric", "material", "trim", "button"] },
  { category: "Quality Issue", words: ["தரம்", "குறை", "defect", "quality", "reject", "repair", "stain", "தையல் குறை"] },
  { category: "Printing Delay", words: ["பிரிண்ட்", "அச்சு", "print", "printing", "screen"] },
  { category: "Washing Delay", words: ["வாஷ்", "சலவை", "wash", "washing", "dye"] },
  { category: "Power Interruption", words: ["மின்சார", "மின்தடை", "current", "power", "electricity", "generator"] },
  { category: "Production Capacity Issue", words: ["திறன்", "capacity", "overload", "உற்பத்தி குறை", "target", "slow"] },
];

function heuristicClassify(text: string): IssueClassification {
  const normalized = text.toLowerCase();
  let best: { category: IssueCategory; hits: number } = { category: "Other", hits: 0 };
  for (const entry of TAMIL_KEYWORDS) {
    const hits = entry.words.reduce(
      (count, word) => count + (normalized.includes(word.toLowerCase()) ? 1 : 0),
      0,
    );
    if (hits > best.hits) best = { category: entry.category, hits };
  }
  const severity: IssueSeverity = /நிறுத்த|முழுவதும்|critical|stopped|breakdown/.test(normalized)
    ? "high"
    : "medium";
  return {
    category: best.category,
    explanation:
      best.category === "Other"
        ? "Issue noted from the supervisor's note. Manual category review is recommended."
        : `The note appears to describe a ${best.category.toLowerCase()} affecting production.`,
    severity,
    status: best.hits > 0 ? "suggested" : "unavailable",
    provider: "heuristic",
  };
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

const transcriptionSchema = z.object({
  transcript: z.string().min(1).max(2000),
  english_translation: z.string().min(1).max(2000),
});

async function generateGemini(
  model: string,
  contents: unknown[],
  generationConfig?: Record<string, unknown>,
  systemInstruction?: string,
  timeoutMs = 30_000,
): Promise<string> {
  const config = env();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.ai.apiKey!,
      },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        ...(generationConfig ? { generationConfig } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) throw new Error(`Gemini provider returned ${response.status}`);
  const json = (await response.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

export async function classifyIssue(text: string): Promise<IssueClassification> {
  const config = env();
  if (!text.trim()) {
    return {
      category: "Other",
      explanation: "No issue text was supplied.",
      severity: "medium",
      status: "unavailable",
      provider: "none",
    };
  }
  if (!config.ai.enabled || !config.ai.classificationEnabled) return heuristicClassify(text);

  try {
    const content = await generateGemini(
      config.ai.model,
      [{ role: "user", parts: [{ text }] }],
      { temperature: 0, responseMimeType: "application/json" },
      "You classify factory production issues written in Tamil or English. " +
        `Return strict JSON with keys category, english_explanation, severity. ` +
        `category must be exactly one of: ${ISSUE_CATEGORIES.join(", ")}. ` +
        "english_explanation is one short English sentence. severity is low, medium, high or critical. " +
        "Never invent order or quantity data.",
      15_000,
    );
    const parsed = classificationSchema.parse(JSON.parse(content));
    return {
      category: parsed.category,
      explanation: parsed.english_explanation,
      severity: parsed.severity ?? "medium",
      status: "suggested",
      provider: "gemini",
    };
  } catch (error) {
    console.warn("[ai] classification unavailable, using the built-in fallback:", error);
    return heuristicClassify(text);
  }
}

export async function transcribeTamilAudio(
  file: File,
): Promise<{ text: string | null; translation: string | null; provider: string }> {
  const config = env();
  if (!config.ai.enabled || !config.ai.voiceEnabled) {
    return { text: null, translation: null, provider: "unavailable" };
  }

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const text = await generateGemini(
      config.ai.transcriptionModel,
      [{
        role: "user",
        parts: [
          {
            text:
              "Transcribe this Tamil voice note exactly and translate it into English. " +
              'Return strict JSON with keys "transcript" and "english_translation". ' +
              "Keep the transcript in the original spoken language, usually Tamil. " +
              "The English translation must preserve the meaning and production context.",
          },
          { inlineData: { mimeType: file.type, data } },
        ],
      }],
      { temperature: 0, responseMimeType: "application/json" },
    );
    const parsed = transcriptionSchema.parse(JSON.parse(text));
    return {
      text: parsed.transcript.trim(),
      translation: parsed.english_translation.trim(),
      provider: "gemini",
    };
  } catch (error) {
    console.warn("[ai] transcription unavailable:", error);
    return { text: null, translation: null, provider: "unavailable" };
  }
}
