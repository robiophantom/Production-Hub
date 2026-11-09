import {
  listPendingUpdates,
  removePendingUpdate,
  type PendingIssue,
  type PendingPhoto,
} from "./db";

export interface UpdatePayload {
  poId: string;
  milestoneId: string;
  updateDate: string;
  quantity: number;
  clientUuid: string;
  notes?: string;
  issue?: PendingIssue;
  photos: PendingPhoto[];
}

export interface SubmitUpdateResponse {
  id: string;
  duplicate: boolean;
  cumulative: number;
  milestoneCompleted: boolean;
}

interface UploadedPhoto {
  url: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  caption?: string;
}

async function uploadPhoto(photo: PendingPhoto): Promise<UploadedPhoto> {
  const body = new FormData();
  body.set("file", photo.blob, photo.name || "production.jpg");
  const response = await fetch("/api/uploads", { method: "POST", body });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? "Photograph upload failed.");
  }
  const asset = (await response.json()) as UploadedPhoto;
  return { ...asset, caption: photo.caption };
}

export async function sendUpdate(
  payload: UpdatePayload,
  source: "online" | "offline",
): Promise<SubmitUpdateResponse> {
  const photos: UploadedPhoto[] = [];
  for (const photo of payload.photos) {
    photos.push(await uploadPhoto(photo));
  }

  let issue = payload.issue;
  if (issue?.voiceBlob) {
    const body = new FormData();
    body.set("audio", issue.voiceBlob, issue.voiceName || "voice-note.webm");
    const voiceResponse = await fetch("/api/ai/transcribe", { method: "POST", body });
    if (voiceResponse.ok) {
      const voice = (await voiceResponse.json()) as {
        text: string | null;
        translation: string | null;
        url: string | null;
      };
      issue = {
        ...issue,
        voiceUrl: issue.voiceUrl ?? voice.url ?? undefined,
        voiceTranscript: issue.voiceTranscript ?? voice.text ?? undefined,
        voiceTranslation: issue.voiceTranslation ?? voice.translation ?? undefined,
      };
    }
  }

  const response = await fetch("/api/production/updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      poId: payload.poId,
      milestoneId: payload.milestoneId,
      updateDate: payload.updateDate,
      quantity: payload.quantity,
      clientUuid: payload.clientUuid,
      source,
      notes: payload.notes,
      issue: issue
        ? {
            descriptionTamil: issue.descriptionTamil,
            descriptionEnglish: issue.descriptionEnglish,
            category: issue.category,
            severity: issue.severity,
            aiSuggestedCategory: issue.aiSuggestedCategory,
            aiExplanation: issue.aiExplanation,
            aiStatus: issue.aiStatus,
            voiceUrl: issue.voiceUrl,
            voiceTranscript: issue.voiceTranscript,
            voiceTranslation: issue.voiceTranslation,
          }
        : undefined,
      photos,
    }),
  });

  const result = (await response.json().catch(() => null)) as
    | (SubmitUpdateResponse & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(result?.error ?? "Unable to submit the production update.");
  }
  return result as SubmitUpdateResponse;
}

export interface SyncResult {
  synced: number;
  remaining: number;
  errors: string[];
}

export async function syncPendingUpdates(): Promise<SyncResult> {
  const pending = await listPendingUpdates();
  const errors: string[] = [];
  let synced = 0;

  for (const update of pending) {
    try {
      await sendUpdate(
        {
          poId: update.poId,
          milestoneId: update.milestoneId,
          updateDate: update.updateDate,
          quantity: update.quantity,
          clientUuid: update.id,
          notes: update.notes,
          issue: update.issue,
          photos: update.photos,
        },
        "offline",
      );
      await removePendingUpdate(update.id);
      synced += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Sync failed.");
    }
  }

  return {
    synced,
    remaining: pending.length - synced,
    errors,
  };
}
