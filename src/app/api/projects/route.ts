import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db/client";
import { ensureUser } from "@/lib/db/storyboards";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { countWords, estimateSeconds } from "@/lib/timing/duration";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  mode: z.enum(["silent-draft", "final-render"]).default("silent-draft"),
  visualStyle: z.string().min(1),
  format: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  script: z.string().min(20, "Script is too short"),
  wordsPerMinute: z.number().int().min(120).max(190).default(150),
});

function fail(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please retry." }, { status: 500 });
}

export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const b = createSchema.parse(await req.json().catch(() => null));
    await ensureUser(userId);
    const words = countWords(b.script);
    const project = await prisma.project.create({
      data: {
        userId, title: b.title, visualStyle: b.visualStyle, format: b.format,
        mode: b.mode === "silent-draft" ? "SILENT_DRAFT" : "FINAL_RENDER",
        script: { create: { originalText: b.script, wordCount: words, wordsPerMinute: b.wordsPerMinute, estimatedDurationSeconds: estimateSeconds(words, b.wordsPerMinute) } },
      },
      select: { id: true },
    });
    return NextResponse.json({ id: project.id }, { status: 201 });
  } catch (err) { return fail(err); }
}

export async function GET() {
  try {
    const userId = requireUserId();
    const projects = await prisma.project.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, mode: true, updatedAt: true } });
    return NextResponse.json({ projects });
  } catch (err) { return fail(err); }
}
