import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type CompletionResult = { text: string; structured: boolean };
export type CompletionOptions = { maxCompletionTokens?: number };
export type Completer = (messages: ChatMessage[], schema: ZodTypeAny, opts?: CompletionOptions) => Promise<CompletionResult>;

export class GroqConfigError extends Error {}

/** Server-side only. Uses the OpenAI SDK pointed at Groq. Keys never reach the browser. */
export function groqCompleter(): Completer {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey) throw new GroqConfigError("GROQ_API_KEY is not set on the server");
  if (!model) throw new GroqConfigError("GROQ_MODEL is not set on the server");
  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

  // Settings that keep requests small, because free-tier limits are per minute: cap the answer length, and ask
  // reasoning models (gpt-oss) to think briefly. Reasoning tokens count against the limit too.
  const extras = (opts?: CompletionOptions): Record<string, unknown> => ({
    ...(opts?.maxCompletionTokens ? { max_completion_tokens: opts.maxCompletionTokens } : {}),
    ...(/gpt-oss/i.test(model) ? { reasoning_effort: "low" } : {}),
  });
  const create = (params: Record<string, unknown>) =>
    client.chat.completions.create({ model, temperature: 0.4, ...params } as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

  return async (messages, schema, opts) => {
    const jsonSchema = zodToJsonSchema(schema, { target: "openAi", $refStrategy: "none" }) as Record<string, unknown>;
    try {
      // 1) Strict Structured Outputs, when the chosen model supports them: the schema is enforced, so it is not repeated in the prompt.
      const res = await create({
        messages,
        response_format: { type: "json_schema", json_schema: { name: "vidscript_storyboard", strict: true, schema: jsonSchema } },
        ...extras(opts),
      });
      return { text: res.choices[0]?.message?.content ?? "", structured: true };
    } catch (err) {
      // 2) Unsupported model/schema (HTTP 400): fall back to JSON Object Mode, spelling the schema out in the prompt. Zod validates afterwards.
      if (!(err instanceof OpenAI.APIError) || err.status !== 400) throw err;
      const res = await create({
        messages: [{ role: "system", content: `Respond with ONE JSON object that matches this JSON Schema exactly:\n${JSON.stringify(jsonSchema)}` }, ...messages],
        response_format: { type: "json_object" },
        ...extras(opts),
      });
      return { text: res.choices[0]?.message?.content ?? "", structured: false };
    }
  };
}
