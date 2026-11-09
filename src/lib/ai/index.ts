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
  provider: "openai" | "heuristic" | "none";
}

const TAMIL_KEYWORDS: { category: IssueCategory; words: string[] }[] = [
  {
    category: "Machine Breakdown",
    words: ["மெஷின்", "இயந்திர", "பழுத", "machine", "breakdown", "needle", "motor"],
  },
  {
    category: "Labour Shortage",
    words: ["தொழிலாள", "ஆள்", "வேலைக்கு ஆள்", "labour", "labor", "worker", "absent", "ஆட்கள்"],
  },
  {
    category: "Raw Material Shortage",
    words: ["மூலப்பொருள்", "துணி", "நூல்", "yarn", "fabric", "material", "trim", "button"],
  },
  {
    category: "Quality Issue",
    words: ["தரம்", "குறை", "defect", "quality", "reject", "repair", "stain", "தையல் குறை"],
  },
  { category: "Printing Delay", words: ["பிரிண்ட்", "அச்சு", "print", "printing", "screen"] },
  { category: "Washing Delay", words: ["வாஷ்", "சலவை", "wash", "washing", "dye"] },
  {
    category: "Power Interruption",
    words: ["மின்சார", "மின்தடை", "current", "power", "electricity", "generator"],
  },
  {
    category: "Production Capacity Issue",
    words: ["திறன்", "capacity", "overload", "உற்பத்தி குறை", "target", "slow"],
  },
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

  if (!config.ai.enabled || !config.ai.classificationEnabled) {
    return heuristicClassify(text);
  }

  try {
    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You classify factory production issues written in Tamil or English. " +
              `Return strict JSON with keys category, english_explanation, severity. ` +
              `category must be exactly one of: ${ISSUE_CATEGORIES.join(", ")}. ` +
              "english_explanation is one short English sentence. severity is low, medium, high or critical. " +
              "Never invent order or quantity data.",
          },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const parsed = classificationSchema.parse(JSON.parse(content));
    return {
      category: parsed.category,
      explanation: parsed.english_explanation,
      severity: parsed.severity ?? "medium",
      status: "suggested",
      provider: "openai",
    };
  } catch (error) {
    console.warn("[ai] classification unavailable, using the built-in fallback:", (error as Error).message);
    return heuristicClassify(text);
  }
}

export async function transcribeTamilAudio(file: File): Promise<{ text: string | null; provider: string }> {
  const config = env();
  if (!config.ai.enabled || !config.ai.voiceEnabled) {
    return { text: null, provider: "unavailable" };
  }

  try {
    const body = new FormData();
    body.set("file", file);
    body.set("model", config.ai.transcriptionModel);
    body.set("language", "ta");

    const response = await fetch(`${config.ai.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.ai.apiKey}` },
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) throw new Error(`Transcription provider returned ${response.status}`);
    const json = (await response.json()) as { text?: string };
    return { text: json.text ?? null, provider: "openai" };
  } catch (error) {
    console.warn("[ai] transcription unavailable:", (error as Error).message);
    return { text: null, provider: "unavailable" };
  }
}
