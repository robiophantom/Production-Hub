import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { IssueCategory, IssueSeverity } from "@/lib/constants";

export interface PendingPhoto {
  blob: Blob;
  name: string;
  caption?: string;
}

export interface PendingIssue {
  descriptionTamil?: string;
  descriptionEnglish?: string;
  category: IssueCategory;
  severity: IssueSeverity;
  aiSuggestedCategory?: string;
  aiExplanation?: string;
  aiStatus?: "suggested" | "accepted" | "corrected" | "unavailable";
  voiceUrl?: string;
  voiceTranscript?: string;
  voiceTranslation?: string;
  voiceBlob?: Blob;
  voiceName?: string;
}

export interface PendingUpdate {
  id: string;
  poId: string;
  milestoneId: string;
  updateDate: string;
  quantity: number;
  notes?: string;
  issue?: PendingIssue;
  photos: PendingPhoto[];
  createdAt: string;
}

interface OfflineSchema extends DBSchema {
  pending_updates: {
    key: string;
    value: PendingUpdate;
    indexes: { "by-date": string };
  };
}

const DB_NAME = "company-a-offline";
const DB_VERSION = 1;
let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

function database() {
  if (typeof window === "undefined") {
    throw new Error("Offline storage is only available in the browser.");
  }
  dbPromise ??= openDB<OfflineSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("pending_updates", { keyPath: "id" });
      store.createIndex("by-date", "updateDate");
    },
  });
  return dbPromise;
}

export async function queuePendingUpdate(update: PendingUpdate): Promise<void> {
  const db = await database();
  await db.put("pending_updates", update);
}

export async function listPendingUpdates(): Promise<PendingUpdate[]> {
  const db = await database();
  return db.getAll("pending_updates");
}

export async function countPendingUpdates(): Promise<number> {
  const db = await database();
  return db.count("pending_updates");
}

export async function removePendingUpdate(id: string): Promise<void> {
  const db = await database();
  await db.delete("pending_updates", id);
}
