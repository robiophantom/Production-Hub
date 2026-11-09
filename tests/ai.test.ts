import { describe, expect, it } from "vitest";
import { classifyIssue, transcribeTamilAudio } from "@/lib/ai";

// No OPENAI_API_KEY is configured in the test environment, so classification
// must fall back to the deterministic keyword heuristic instead of failing.
describe("Tamil issue classification fallback", () => {
  it("classifies a Tamil machine breakdown note", async () => {
    const result = await classifyIssue("மெஷின் பழுது, தையல் நிறுத்தப்பட்டது");
    expect(result.category).toBe("Machine Breakdown");
    expect(result.status).toBe("suggested");
    expect(result.provider).toBe("heuristic");
    expect(result.severity).toBe("high");
  });

  it("classifies a labour shortage note in English", async () => {
    const result = await classifyIssue("Many workers absent today, labour shortage on the stitching line");
    expect(result.category).toBe("Labour Shortage");
    expect(result.status).toBe("suggested");
  });

  it("recognises Tamil raw-material notes", async () => {
    const result = await classifyIssue("துணி மூலப்பொருள் இன்னும் வரவில்லை");
    expect(result.category).toBe("Raw Material Shortage");
  });

  it("returns an unavailable suggestion for an empty note", async () => {
    const result = await classifyIssue("   ");
    expect(result.category).toBe("Other");
    expect(result.status).toBe("unavailable");
    expect(result.provider).toBe("none");
  });

  it("returns an unavailable suggestion for unrecognised text", async () => {
    const result = await classifyIssue("asdf qwerty");
    expect(result.category).toBe("Other");
    expect(result.status).toBe("unavailable");
    expect(result.provider).toBe("heuristic");
  });

  it("reports transcription as unavailable without an AI key", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" });
    const result = await transcribeTamilAudio(file);
    expect(result).toEqual({ text: null, provider: "unavailable" });
  });
});
