# AI assistance

AI is a convenience layer for **issue classification** and **Tamil voice transcription**. It is optional, server-side only, and never participates in production quantities, delay calculations, alert decisions or buyer notification approval.

## Scope and guarantees

- **Server-side only.** `OPENAI_API_KEY` is read in `src/lib/env.ts` and used by `src/lib/ai/index.ts`. It is not prefixed `NEXT_PUBLIC_` and never reaches the browser bundle.
- **Non-blocking.** Classification and transcription failures are caught and converted to fallback results. A production update is never rejected because AI is down.
- **Advisory.** The generated category, explanation and severity are suggestions stored in `ai_suggested_category`, `ai_explanation` and `ai_status`. The supervisor or merchandiser can accept or correct the category before/after submission.
- **Never approves buyer notifications.** Only `confirmAlert` by a Super Admin or Merchandiser creates an approved buyer notification. AI output cannot set alert status or notification status.
- **Never determines delays.** The delay engine is deterministic and documented in [delay-engine.md](delay-engine.md).

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `OPENAI_API_KEY` | unset | Enables the provider when longer than 10 characters |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `AI_MODEL` | `gpt-4o-mini` | Chat model for classification |
| `AI_TRANSCRIPTION_MODEL` | `whisper-1` | Transcription model |
| `AI_CLASSIFICATION_ENABLED` | inferred from the key | Explicitly enable/disable classification |
| `AI_VOICE_ENABLED` | inferred from the key | Explicitly enable/disable transcription |

Setting `AI_CLASSIFICATION_ENABLED=false` or `AI_VOICE_ENABLED=false` disables that feature even when a key exists. With no key at all, both features use their fallbacks.

## Issue classification

Endpoint: `POST /api/ai/classify` with `{ "text": "..." }`.

- Requires an authenticated session with role `unit_supervisor`, `super_admin` or `merchandiser`.
- Text is trimmed, required and limited to 4,000 characters.
- The provider is called with `temperature: 0`, a JSON response format and a 15-second timeout.
- The response is validated with Zod: category must be one of the nine issue categories, explanation 1–500 characters, severity one of low/medium/high/critical (default medium).
- Invalid provider output, non-2xx responses, timeouts and network errors fall back to the heuristic.

### Heuristic fallback

A keyword matcher understands Tamil and English terms for machine breakdown, labour shortage, raw material shortage, quality, printing delay, washing delay, power interruption and capacity issues. It selects the category with the most keyword hits, defaults to `Other`, and marks severity `high` when the text contains strong interruption terms (e.g. நிறுத்த, முழுவதும், stopped, breakdown), otherwise `medium`.

Fallback results return `status: "suggested"` when at least one keyword matched and `provider: "heuristic"`; otherwise `status: "unavailable"`. Empty text returns `Other` with `provider: "none"`. The UI labels the suggestion so users know whether it came from the model or the fallback.

## Voice transcription

Endpoint: `POST /api/ai/transcribe` with multipart field `audio`.

- Requires a session with role `unit_supervisor` or `super_admin` (merchandisers cannot record voice notes through this endpoint).
- Audio types and the 12 MB limit are enforced by the storage helper.
- The provider is called with `language: "ta"` and a 30-second timeout.
- On success, returns `{ text, provider: "openai", url, publicId }`.
- On failure or disabled AI, returns `{ text: null, provider: "unavailable" }` but still attempts to store the audio. Storage failure is also non-fatal.

The supervisor UI attaches the recording to the issue, shows the transcript when available and tells the user when automatic transcription is unavailable. Text entry remains available in all cases.

## Data sent to the provider

Classification sends the issue text. Transcription sends the audio file and the language code. No order ids, buyer names, quantities, prices or user identities are included by the application. If your organisation has stricter data-residency requirements, leave the AI variables unset; the fallbacks keep the workflow functional.

## Failure behaviour summary

| Situation | Classification | Transcription |
| --- | --- | --- |
| No API key | Heuristic keyword result | `text: null`, `unavailable` |
| Feature flag off | Heuristic keyword result | `null`, `unavailable` |
| Provider 4xx/5xx | Heuristic + warning log | `null`, `unavailable` |
| Timeout | Heuristic + warning log | `null`, `unavailable` |
| Invalid JSON/schema | Heuristic + warning log | `null`, `unavailable` |
| Provider success | Validated suggestion | Transcript text |

Warnings are written to the server console only; they are not shown to floor users beyond the generic "unavailable" hint.

## Testing and verification status

`tests/ai.test.ts` verifies the no-key fallback for Tamil machine, English labour and Tamil fabric text, empty input and transcription unavailability. The live provider integration was **not** exercised because no API key is part of the repository; the OpenAI-compatible HTTP calls are implemented but unverified against a live endpoint.

## Related reading

- [Production & offline](production-offline.md)
- [Environment](environment.md)
- [Roles & security](roles-and-security.md)
