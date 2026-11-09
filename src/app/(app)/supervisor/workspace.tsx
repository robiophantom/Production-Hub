"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Factory,
  Languages,
  Loader2,
  Mic,
  RefreshCw,
  Sparkles,
  Square,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, HealthBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES } from "@/lib/constants";
import type { IssueCategory, IssueSeverity } from "@/lib/constants";
import { countPendingUpdates, queuePendingUpdate } from "@/lib/offline/db";
import { sendUpdate, syncPendingUpdates, type UpdatePayload } from "@/lib/offline/sync";
import type { SupervisorOrder, SupervisorStage } from "@/lib/services/production";
import { cn, formatDate, formatNumber, percent, titleCase } from "@/lib/utils";

type Lang = "en" | "ta";

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    switchLabel: "தமிழ்",
    assignedOrders: "Assigned orders",
    stages: "stages",
    exFactory: "Ex-factory",
    planned: "Planned",
    today: "Today",
    cumulative: "Cumulative",
    remaining: "Remaining",
    targetMet: "Target met",
    record: "Record output",
    syncTitle: "Offline sync",
    syncAllClear: "All updates sent",
    syncPending: "saved on this device",
    syncNow: "Sync now",
    syncing: "Syncing…",
    syncDone: "Pending updates sent.",
    syncFailed: "Some updates could not be sent. They stay saved on this device.",
    offlineNote: "No network. New updates are saved here and sent automatically when you reconnect.",
    onlineNote: "Connected. Updates are sent immediately.",
    updateTitle: "Daily production update",
    updateDate: "Update date",
    quantity: "Completed quantity",
    quantityHint: "Target",
    notes: "Notes (optional)",
    notesPlaceholder: "Line, shift or any context for the merchandiser",
    photos: "Photographs",
    addPhoto: "Take or choose photo",
    photoHint: "Up to 6 photos. The merchandiser approves each photo before a buyer can see it.",
    issueToggle: "Report a production issue",
    issueTamil: "Issue description (Tamil)",
    issueTamilPlaceholder: "எ.கா. தையல் மெஷின் பழுது, உற்பத்தி நிறுத்தப்பட்டது",
    issueEnglish: "English description (optional)",
    category: "Category",
    severity: "Severity",
    aiSuggest: "Suggest category with AI",
    aiWorking: "Checking…",
    aiNote:
      "AI only suggests a category. A merchandiser reviews every issue. AI never changes dates, quantities or buyer notifications.",
    aiSuggestion: "AI suggestion (for review only)",
    voice: "Voice note (Tamil)",
    recordVoice: "Record voice",
    stopRecording: "Stop recording",
    recording: "Recording… tap stop when finished",
    transcribing: "Transcribing…",
    voiceSaved: "Voice note attached. It will be stored with the update.",
    voiceNoText: "Voice note attached. Automatic transcription is unavailable right now.",
    submit: "Submit update",
    submitting: "Saving…",
    submitOffline: "Save on device",
    saved: "Production update submitted.",
    savedOffline: "Network unavailable — the update is saved on this device and will sync automatically.",
    queued: "Update saved on this device. It will sync when the network returns.",
    errorQuantity: "Enter a completed quantity of 0 or more, or report an issue instead.",
    errorIssue: "Describe the issue, or attach a voice note.",
    errorMicrophone: "Microphone permission was not granted. You can still type the issue.",
    errorAi: "AI assist is unavailable right now. Choose a category manually.",
    errorFiles: "You can attach up to 6 photographs.",
    removePhoto: "Remove photo",
    close: "Close",
    noStages: "No active stages assigned.",
  },
  ta: {
    switchLabel: "English",
    assignedOrders: "ஒதுக்கப்பட்ட ஆர்டர்கள்",
    stages: "நிலைகள்",
    exFactory: "கப்பல் தேதி",
    planned: "திட்டமிட்ட தேதி",
    today: "இன்று",
    cumulative: "மொத்தம்",
    remaining: "மீதம்",
    targetMet: "இலக்கு எட்டப்பட்டது",
    record: "உற்பத்தியைப் பதிவு செய்",
    syncTitle: "ஆஃப்லைன் ஒத்திசைவு",
    syncAllClear: "அனைத்து பதிவுகளும் அனுப்பப்பட்டன",
    syncPending: "இந்த சாதனத்தில் சேமிக்கப்பட்டுள்ளன",
    syncNow: "இப்போது ஒத்திசை",
    syncing: "ஒத்திசைக்கிறது…",
    syncDone: "காத்திருந்த பதிவுகள் அனுப்பப்பட்டன.",
    syncFailed: "சில பதிவுகளை அனுப்ப முடியவில்லை. அவை இந்த சாதனத்தில் சேமிக்கப்பட்டுள்ளன.",
    offlineNote: "நெட்வொர்க் இல்லை. புதிய பதிவுகள் இங்கே சேமிக்கப்பட்டு, இணைப்பு வரும்போது தானாக அனுப்பப்படும்.",
    onlineNote: "இணைப்பு உள்ளது. பதிவுகள் உடனே அனுப்பப்படும்.",
    updateTitle: "தினசரி உற்பத்தி பதிவு",
    updateDate: "பதிவு தேதி",
    quantity: "முடிந்த அளவு",
    quantityHint: "இலக்கு",
    notes: "குறிப்புகள் (விருப்பம்)",
    notesPlaceholder: "லைன், ஷிப்ட் அல்லது விவரங்கள்",
    photos: "புகைப்படங்கள்",
    addPhoto: "புகைப்படம் எடு / தேர்வு செய்",
    photoHint: "6 புகைப்படங்கள் வரை. வாங்குபவர் பார்ப்பதற்கு முன் மெர்ச்சண்டைசர் ஒப்புதல் அளிப்பார்.",
    issueToggle: "உற்பத்தி பிரச்சினையைப் பதிவு செய்",
    issueTamil: "பிரச்சினை விவரம் (தமிழ்)",
    issueTamilPlaceholder: "எ.கா. தையல் மெஷின் பழுது, உற்பத்தி நிறுத்தப்பட்டது",
    issueEnglish: "ஆங்கில விவரம் (விருப்பம்)",
    category: "வகை",
    severity: "தீவிரம்",
    aiSuggest: "AI மூலம் வகையை பரிந்துரை செய்",
    aiWorking: "பரிசீலிக்கிறது…",
    aiNote:
      "AI வகையை மட்டும் பரிந்துரைக்கும். ஒவ்வொரு பிரச்சினையையும் மெர்ச்சண்டைசர் சரிபார்ப்பார். தேதிகள், அளவுகள் அல்லது வாங்குபவர் அறிவிப்புகளை AI மாற்றாது.",
    aiSuggestion: "AI பரிந்துரை (சரிபார்ப்புக்கு மட்டும்)",
    voice: "குரல் குறிப்பு (தமிழ்)",
    recordVoice: "குரலைப் பதிவு செய்",
    stopRecording: "பதிவை நிறுத்து",
    recording: "பதிவு செய்கிறது… முடிந்ததும் நிறுத்து",
    transcribing: "எழுத்தாக்கம் செய்கிறது…",
    voiceSaved: "குரல் குறிப்பு இணைக்கப்பட்டது. பதிவுடன் சேமிக்கப்படும்.",
    voiceNoText: "குரல் குறிப்பு இணைக்கப்பட்டது. தானியங்கி எழுத்தாக்கம் இப்போது இல்லை.",
    submit: "பதிவைச் சமர்ப்பி",
    submitting: "சேமிக்கிறது…",
    submitOffline: "சாதனத்தில் சேமி",
    saved: "உற்பத்தி பதிவு சமர்ப்பிக்கப்பட்டது.",
    savedOffline: "நெட்வொர்க் இல்லை — பதிவு இந்த சாதனத்தில் சேமிக்கப்பட்டது. இணைப்பு வந்ததும் தானாக அனுப்பப்படும்.",
    queued: "பதிவு இந்த சாதனத்தில் சேமிக்கப்பட்டது. நெட்வொர்க் வந்ததும் ஒத்திசைக்கப்படும்.",
    errorQuantity: "0 அல்லது அதற்கு மேற்பட்ட முடிந்த அளவை உள்ளிடவும், அல்லது பிரச்சினையைப் பதிவு செய்யவும்.",
    errorIssue: "பிரச்சினையை விவரிக்கவும் அல்லது குரல் குறிப்பை இணைக்கவும்.",
    errorMicrophone: "மைக்ரோஃபோன் அனுமதி வழங்கப்படவில்லை. பிரச்சினையை தட்டச்சு செய்யலாம்.",
    errorAi: "AI உதவி இப்போது இல்லை. வகையை கைமுறையாகத் தேர்ந்தெடுக்கவும்.",
    errorFiles: "6 புகைப்படங்கள் வரை மட்டுமே இணைக்க முடியும்.",
    removePhoto: "புகைப்படத்தை நீக்கு",
    close: "மூடு",
    noStages: "செயலில் உள்ள நிலைகள் எதுவும் ஒதுக்கப்படவில்லை.",
  },
};

const onlineListeners = new Set<() => void>();

function subscribeOnline(callback: () => void) {
  onlineListeners.add(callback);
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    onlineListeners.delete(callback);
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

interface StageTarget {
  order: SupervisorOrder;
  stage: SupervisorStage;
}

export function SupervisorWorkspace({
  orders,
  businessDate,
}: {
  orders: SupervisorOrder[];
  businessDate: string;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const copy = COPY[lang];
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);

  const [pending, setPending] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await syncPendingUpdates();
      setPending(result.remaining);
      if (result.synced > 0) {
        toast.success(copy.syncDone);
        router.refresh();
      }
      if (result.errors.length > 0) toast.error(copy.syncFailed);
    } catch {
      toast.error(copy.syncFailed);
    } finally {
      setSyncing(false);
    }
  }, [copy.syncDone, copy.syncFailed, router]);

  useEffect(() => {
    if (!online) return;
    let active = true;
    void (async () => {
      const count = await countPendingUpdates().catch(() => 0);
      if (!active) return;
      setPending(count);
      if (count > 0) void runSync();
    })();
    return () => {
      active = false;
    };
  }, [online, runSync]);

  const [selected, setSelected] = useState<StageTarget | null>(null);
  const [quantity, setQuantity] = useState("");
  const [updateDate, setUpdateDate] = useState(businessDate);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTamil, setIssueTamil] = useState("");
  const [issueEnglish, setIssueEnglish] = useState("");
  const [category, setCategory] = useState<IssueCategory>("Other");
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [aiCategory, setAiCategory] = useState<IssueCategory | null>(null);
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiStatus, setAiStatus] = useState<"suggested" | "accepted" | "corrected" | "unavailable" | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceName, setVoiceName] = useState("voice-note.webm");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceTranslation, setVoiceTranslation] = useState("");
  const [voiceHint, setVoiceHint] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [previews],
  );

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const orderCount = orders.length;
  const stagesCount = orders.reduce((total, order) => total + order.stages.length, 0);

  function resetForm() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
    setTranscribing(false);
    setSelected(null);
    setQuantity("");
    setUpdateDate(businessDate);
    setNotes("");
    setFiles([]);
    setIssueOpen(false);
    setIssueTamil("");
    setIssueEnglish("");
    setCategory("Other");
    setSeverity("medium");
    setAiCategory(null);
    setAiExplanation("");
    setAiStatus(null);
    setVoiceBlob(null);
    setVoiceName("voice-note.webm");
    setVoiceTranscript("");
    setVoiceTranslation("");
    setVoiceHint("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openStage(order: SupervisorOrder, stage: SupervisorStage) {
    setSelected({ order, stage });
    setUpdateDate(businessDate);
    setQuantity("");
    setNotes("");
    setError("");
  }

  async function classify() {
    const text = [issueTamil, issueEnglish].filter((part) => part.trim()).join(". ");
    if (!text) {
      setError(copy.errorIssue);
      return;
    }
    setClassifying(true);
    setError("");
    try {
      const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("classify failed");
      const result = (await response.json()) as {
        category: IssueCategory;
        explanation: string;
        severity: IssueSeverity;
        status: "suggested" | "unavailable";
      };
      setAiCategory(result.category);
      setAiExplanation(result.explanation);
      setAiStatus(result.status);
      setCategory(result.category);
      setSeverity(result.severity);
    } catch {
      setError(copy.errorAi);
    } finally {
      setClassifying(false);
    }
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(copy.errorMicrophone);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        setVoiceBlob(blob);
        setVoiceName(blob.type.includes("mp4") ? "voice-note.mp4" : "voice-note.webm");
        setVoiceHint(copy.voiceSaved);
        if (navigator.onLine) void transcribe(blob);
      };
      recorder.start();
      setRecording(true);
    } catch {
      setError(copy.errorMicrophone);
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    try {
      const body = new FormData();
      body.set("audio", blob, voiceName);
      const response = await fetch("/api/ai/transcribe", { method: "POST", body });
      if (!response.ok) throw new Error("transcription failed");
      const result = (await response.json()) as {
        text: string | null;
        translation: string | null;
      };
      if (result.text) {
        setVoiceTranscript(result.text);
        setIssueTamil((current) => current || result.text || "");
        if (result.translation) {
          setVoiceTranslation(result.translation);
          setIssueEnglish((current) => current || result.translation || "");
        }
      } else {
        setVoiceHint(copy.voiceNoText);
      }
    } catch {
      setVoiceHint(copy.voiceNoText);
    } finally {
      setTranscribing(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list).filter((file) => file.type.startsWith("image/"));
    setFiles((current) => {
      const next = [...current, ...incoming].slice(0, 6);
      if (current.length + incoming.length > 6) toast.error(copy.errorFiles);
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");

    const parsed = Number(quantity);
    if (quantity.trim() === "" || Number.isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      setError(copy.errorQuantity);
      return;
    }
    if (parsed === 0 && !issueOpen) {
      setError(copy.errorQuantity);
      return;
    }
    if (issueOpen && !issueTamil.trim() && !issueEnglish.trim() && !voiceTranscript.trim() && !voiceBlob) {
      setError(copy.errorIssue);
      return;
    }

    const clientUuid = crypto.randomUUID();
    const payload: UpdatePayload = {
      poId: selected.order.summary.order.id,
      milestoneId: selected.stage.milestone.id,
      updateDate,
      quantity: parsed,
      clientUuid,
      notes: notes.trim() || undefined,
      issue: issueOpen
        ? {
            descriptionTamil: issueTamil.trim() || undefined,
            descriptionEnglish: issueEnglish.trim() || undefined,
            category,
            severity,
            aiSuggestedCategory: aiCategory ?? undefined,
            aiExplanation: aiExplanation || undefined,
            aiStatus: aiStatus ?? "unavailable",
            voiceTranscript: voiceTranscript || undefined,
            voiceTranslation: voiceTranslation || undefined,
            voiceBlob: voiceBlob ?? undefined,
            voiceName,
          }
        : undefined,
      photos: files.map((file) => ({ blob: file, name: file.name })),
    };

    const queue = async (message: string) => {
      await queuePendingUpdate({
        id: clientUuid,
        poId: payload.poId,
        milestoneId: payload.milestoneId,
        updateDate: payload.updateDate,
        quantity: payload.quantity,
        notes: payload.notes,
        issue: payload.issue,
        photos: payload.photos,
        createdAt: new Date().toISOString(),
      });
      setPending((current) => (current ?? 0) + 1);
      toast.success(message);
      resetForm();
      router.refresh();
    };

    if (!navigator.onLine) {
      setSubmitting(true);
      try {
        await queue(copy.savedOffline);
      } catch {
        setError(copy.syncFailed);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await sendUpdate(payload, "online");
      toast.success(copy.saved);
      resetForm();
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof TypeError) {
        try {
          await queue(copy.queued);
        } catch {
          setError(copy.syncFailed);
        }
      } else {
        setError(submitError instanceof Error ? submitError.message : copy.syncFailed);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            <Factory className="size-3.5" /> {orderCount} {copy.assignedOrders.toLowerCase()}
          </Badge>
          <Badge variant="neutral">
            {stagesCount} {copy.stages}
          </Badge>
          <Badge variant={online ? "success" : "warning"}>
            <span className={cn("size-1.5 rounded-full", online ? "bg-emerald-500" : "bg-amber-500")} />
            {online ? "Online" : "Offline"}
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLang(lang === "en" ? "ta" : "en")}
        >
          <Languages /> {copy.switchLabel}
        </Button>
      </div>

      <Card
        className={cn(
          "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
          online ? "border-line" : "border-amber-200 bg-amber-50/60",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              online ? "bg-brand-soft text-brand" : "bg-amber-100 text-amber-700",
            )}
          >
            {pending && pending > 0 ? (
              <CloudOff className="size-4" />
            ) : (
              <CloudUpload className="size-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">{copy.syncTitle}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              {pending === null
                ? "…"
                : pending > 0
                  ? `${pending} ${copy.syncPending}`
                  : copy.syncAllClear}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              {online ? copy.onlineNote : copy.offlineNote}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={online ? "success" : "warning"}>{online ? "Live" : "Saved locally"}</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!online || syncing || (pending ?? 0) === 0}
            onClick={() => void runSync()}
          >
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {syncing ? copy.syncing : copy.syncNow}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {orders.map((order) => (
          <Card key={order.summary.order.id} className="overflow-hidden">
            <div className="border-b border-line bg-slate-50/60 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{order.summary.order.po_number}</p>
                    <HealthBadge health={order.summary.health.health} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {order.summary.order.style_name} · {order.summary.buyer.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {copy.exFactory}
                  </p>
                  <p className="text-[12px] font-medium text-ink">
                    {formatDate(order.summary.order.ex_factory_date)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={order.summary.currentStageProgress} className="flex-1" />
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-600">
                  {Math.round(order.summary.currentStageProgress)}%
                </span>
              </div>
            </div>

            <ul className="divide-y divide-line">
              {order.stages.length === 0 ? (
                <li className="px-4 py-6 text-center text-[12px] text-muted">{copy.noStages}</li>
              ) : (
                order.stages.map((stage) => {
                  const progress = percent(stage.cumulative, stage.targetQuantity);
                  const complete = stage.remaining <= 0;
                  return (
                    <li key={stage.milestone.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-ink">{stage.stage.name}</p>
                          <StatusBadge status={stage.milestone.status} />
                          {stage.todayQuantity > 0 ? (
                            <Badge variant="default">
                              {copy.today}: {formatNumber(stage.todayQuantity)}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {copy.planned}: {formatDate(stage.plannedDate)} · {copy.cumulative}:{" "}
                          {formatNumber(stage.cumulative)} / {formatNumber(stage.targetQuantity)}
                          {complete ? ` · ${copy.targetMet}` : ` · ${copy.remaining}: ${formatNumber(stage.remaining)}`}
                        </p>
                        <div className="mt-2 max-w-xs">
                          <Progress value={progress} height="h-1.5" />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={complete ? "outline" : "primary"}
                        className="w-full sm:w-auto"
                        onClick={() => openStage(order, stage)}
                      >
                        <Factory /> {copy.record}
                      </Button>
                    </li>
                  );
                })
              )}
            </ul>
          </Card>
        ))}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        {selected ? (
          <DialogContent
            title={`${copy.updateTitle} — ${selected.stage.stage.name}`}
            description={`${selected.order.summary.order.po_number} · ${selected.order.summary.order.style_name}`}
            className="max-w-xl"
          >
            <form onSubmit={submit} className="space-y-4">
              {error ? <FormError>{error}</FormError> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={copy.updateDate} htmlFor="update-date" required>
                  <Input
                    id="update-date"
                    type="date"
                    value={updateDate}
                    max={businessDate}
                    onChange={(event) => setUpdateDate(event.target.value)}
                    required
                  />
                </Field>
                <Field
                  label={copy.quantity}
                  htmlFor="update-quantity"
                  required
                  hint={`${copy.quantityHint}: ${formatNumber(selected.stage.targetQuantity)} · ${copy.remaining}: ${formatNumber(selected.stage.remaining)}`}
                >
                  <Input
                    id="update-quantity"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="0"
                    required
                  />
                </Field>
              </div>

              <Field label={copy.notes} htmlFor="update-notes">
                <Textarea
                  id="update-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={copy.notesPlaceholder}
                  className="min-h-16"
                />
              </Field>

              <div>
                <p className="mb-1.5 text-[13px] font-medium text-slate-700">{copy.photos}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="update-photos"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <Button asChild variant="outline" size="sm">
                    <label htmlFor="update-photos" className="cursor-pointer">
                      <Camera /> {copy.addPhoto}
                    </label>
                  </Button>
                  {previews.map((preview) => (
                    <span
                      key={preview.url}
                      className="group relative size-14 overflow-hidden rounded-lg border border-line"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview.url}
                        alt={preview.file.name}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={copy.removePhoto}
                        onClick={() => setFiles((current) => current.filter((file) => file !== preview.file))}
                        className="absolute right-0.5 top-0.5 rounded-full bg-slate-900/70 p-0.5 text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{copy.photoHint}</p>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-ink">
                <input
                  type="checkbox"
                  checked={issueOpen}
                  onChange={(event) => setIssueOpen(event.target.checked)}
                  className="size-4 accent-[var(--color-brand)]"
                />
                <TriangleAlert className="size-4 text-amber-600" />
                {copy.issueToggle}
              </label>

              {issueOpen ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <Field label={copy.issueTamil} htmlFor="issue-tamil">
                    <Textarea
                      id="issue-tamil"
                      value={issueTamil}
                      onChange={(event) => setIssueTamil(event.target.value)}
                      placeholder={copy.issueTamilPlaceholder}
                      className="min-h-20"
                    />
                  </Field>
                  <Field label={copy.issueEnglish} htmlFor="issue-english">
                    <Textarea
                      id="issue-english"
                      value={issueEnglish}
                      onChange={(event) => setIssueEnglish(event.target.value)}
                      className="min-h-16"
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={copy.category} htmlFor="issue-category">
                      <Select
                        id="issue-category"
                        value={category}
                        onChange={(event) => {
                          setCategory(event.target.value as IssueCategory);
                          setAiStatus((current) => (current === "suggested" ? "corrected" : current));
                        }}
                      >
                        {ISSUE_CATEGORIES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={copy.severity} htmlFor="issue-severity">
                      <Select
                        id="issue-severity"
                        value={severity}
                        onChange={(event) => setSeverity(event.target.value as IssueSeverity)}
                      >
                        {ISSUE_SEVERITIES.map((option) => (
                          <option key={option} value={option}>
                            {titleCase(option)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void classify()}
                      disabled={classifying}
                    >
                      {classifying ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      {classifying ? copy.aiWorking : copy.aiSuggest}
                    </Button>
                    {recording ? (
                      <Button type="button" variant="danger" size="sm" onClick={stopRecording}>
                        <Square /> {copy.stopRecording}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void startRecording()}
                        disabled={transcribing}
                      >
                        {transcribing ? <Loader2 className="animate-spin" /> : <Mic />}
                        {transcribing ? copy.transcribing : copy.recordVoice}
                      </Button>
                    )}
                  </div>

                  {recording ? (
                    <p className="flex items-center gap-2 text-[12px] font-medium text-red-600">
                      <span className="size-2 animate-pulse rounded-full bg-red-500" />
                      {copy.recording}
                    </p>
                  ) : null}
                  {voiceHint ? <p className="text-[11px] text-muted">{voiceHint}</p> : null}
                  {voiceTranscript ? (
                    <div className="rounded-lg border border-line bg-white px-3 py-2 text-[12px] text-slate-600">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {copy.voice}
                      </p>
                      {voiceTranscript}
                      {voiceTranslation ? (
                        <p className="mt-2 border-t border-line pt-2">
                          <span className="font-semibold text-slate-400">English translation: </span>
                          {voiceTranslation}
                        </p>
                      ) : null}
                    </div>
                  ) : voiceBlob ? (
                    <Badge variant="purple">
                      <Mic className="size-3" /> {copy.voice}
                    </Badge>
                  ) : null}

                  {aiCategory ? (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-800">
                      <p className="font-semibold">
                        {copy.aiSuggestion}: {aiCategory}
                        {aiStatus === "unavailable" ? " · low confidence" : ""}
                      </p>
                      {aiExplanation ? <p className="mt-0.5">{aiExplanation}</p> : null}
                    </div>
                  ) : null}
                  <p className="text-[11px] leading-relaxed text-muted">{copy.aiNote}</p>
                </div>
              ) : null}

              <DialogFooter className="!mt-5 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={resetForm} className="w-full sm:w-auto">
                  {copy.close}
                </Button>
                <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? (
                    <Loader2 className="animate-spin" />
                  ) : online ? (
                    <CheckCircle2 />
                  ) : (
                    <CloudOff />
                  )}
                  {submitting
                    ? copy.submitting
                    : online
                      ? copy.submit
                      : copy.submitOffline}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
