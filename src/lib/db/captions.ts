import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./client";
import { storageRoot } from "@/lib/storage/local";
import { declaredLanguage, detectScript, parseCaptions, validateCues, type CaptionValidation } from "@/lib/captions/parse";
import { CAPTION_PRESETS, type CaptionPreset } from "@/lib/captions/presets";
import type { CaptionView } from "@/lib/captions/types";

/** Loads the caption file and validates it against the CURRENT voiceover, so replacing the audio re-checks the timing. */
export async function loadCaptionView(projectId: string): Promise<CaptionView | null> {
  const row = await prisma.captionFile.findUnique({ where: { projectId } });
  if (!row) return null;
  const vo = await prisma.voiceover.findUnique({ where: { projectId }, select: { durationSeconds: true } });
  const format = row.format === "SRT" ? "srt" : "vtt";

  let cues: CaptionView["cues"] = [];
  let text = "";
  let validation: CaptionValidation;
  try {
    text = await readFile(path.join(storageRoot(), row.storageKey ?? ""), "utf8");
    cues = parseCaptions(text, format);
    validation = validateCues(cues, vo?.durationSeconds ?? null);
  } catch {
    validation = { valid: false, status: "invalid", errors: ["The stored caption file could not be read. Please upload it again."], warnings: [], cueCount: 0, coverageSeconds: 0 };
  }
  if (row.validationStatus !== validation.status) {
    await prisma.captionFile.update({ where: { projectId }, data: { validationStatus: validation.status, validationErrors: validation.errors } }).catch(() => {});
  }
  const preset = (CAPTION_PRESETS as readonly string[]).includes(row.preset) ? (row.preset as CaptionPreset) : "boxed";
  return {
    fileName: row.fileName, format, cueCount: cues.length, script: detectScript(cues), declaredLanguage: declaredLanguage(text, format),
    coverageSeconds: validation.coverageSeconds, validation: { status: validation.status, errors: validation.errors, warnings: validation.warnings },
    preset, enabled: row.enabled, uploadedAt: row.uploadedAt.toISOString(), url: `/api/projects/${projectId}/captions/file`, cues,
  };
}
