import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES } from "@/lib/constants";
import { submitProductionUpdate } from "@/lib/services/production";

const photoSchema = z.object({
  url: z.string().min(1).max(2000),
  publicId: z.string().max(500).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  bytes: z.number().int().nonnegative().nullable().optional(),
  caption: z.string().trim().max(300).optional(),
});

const issueSchema = z.object({
  descriptionTamil: z.string().trim().max(2000).optional(),
  descriptionEnglish: z.string().trim().max(2000).optional(),
  category: z.enum(ISSUE_CATEGORIES),
  severity: z.enum(ISSUE_SEVERITIES),
  aiSuggestedCategory: z.enum(ISSUE_CATEGORIES).optional(),
  aiExplanation: z.string().trim().max(500).optional(),
  aiStatus: z.enum(["suggested", "accepted", "corrected", "unavailable"]).optional(),
  voiceUrl: z.string().max(2000).optional(),
  voiceTranscript: z.string().trim().max(2000).optional(),
  voiceTranslation: z.string().trim().max(2000).optional(),
});

const schema = z.object({
  poId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  updateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().int().min(0).max(10_000_000),
  clientUuid: z.string().uuid(),
  source: z.enum(["online", "offline"]).default("online"),
  notes: z.string().trim().max(2000).optional(),
  issue: issueSchema.optional(),
  photos: z.array(photoSchema).max(6).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to submit production updates." }, { status: 401 });
  }
  if (user.role !== "unit_supervisor" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Only supervisors can submit production updates." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the update details." },
      { status: 400 },
    );
  }

  try {
    const result = await submitProductionUpdate(user, {
      poId: parsed.data.poId,
      milestoneId: parsed.data.milestoneId,
      updateDate: parsed.data.updateDate,
      quantity: parsed.data.quantity,
      clientUuid: parsed.data.clientUuid,
      source: parsed.data.source,
      notes: parsed.data.notes,
      issue: parsed.data.issue,
      photos: parsed.data.photos?.map((photo) => ({
        url: photo.url,
        publicId: photo.publicId ?? null,
        width: photo.width ?? null,
        height: photo.height ?? null,
        bytes: photo.bytes ?? null,
        caption: photo.caption,
      })),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit the update." },
      { status: 400 },
    );
  }
}
