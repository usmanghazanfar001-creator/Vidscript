import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/auth";

export const runtime = "nodejs";

/** Lists the model IDs your Groq key can use, so GROQ_MODEL can be set correctly. Returns IDs only, never the key. */
export async function GET() {
  try {
    requireUserId();
    const key = process.env.GROQ_API_KEY;
    if (!key) return NextResponse.json({ error: "GROQ_API_KEY is not set on the server" }, { status: 500 });

    const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: res.status === 401 ? "Groq rejected the API key" : `Groq returned HTTP ${res.status}` }, { status: 502 });

    const data = (await res.json()) as { data?: Array<{ id: string; active?: boolean }> };
    const ids = (data.data ?? []).filter((m) => m.active !== false).map((m) => m.id).sort();
    const isChat = (id: string) => !/whisper|tts|orpheus|guard|embed|playai/i.test(id);
    const current = process.env.GROQ_MODEL ?? null;
    return NextResponse.json({
      current,
      currentIsAvailable: current ? ids.includes(current) : false,
      chatModels: ids.filter(isChat),
      otherModels: ids.filter((id) => !isChat(id)),
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Groq. Check your internet connection." }, { status: 502 });
  }
}
