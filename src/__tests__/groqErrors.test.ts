import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import { describeGroqError } from "@/lib/ai/groqErrors";

const apiError = (status: number | undefined, message: string, headers: Record<string, string> = {}) => OpenAI.APIError.generate(status, { message }, message, headers);

describe("describeGroqError", () => {
  it("ignores errors that did not come from the API client", () => expect(describeGroqError(new Error("boom"))).toBeNull());
  it("explains a missing model and names it, without retrying", () => {
    const p = describeGroqError(apiError(404, "The model `x` does not exist"), "llama-old")!;
    expect(p.retryable).toBe(false);
    expect(p.message).toMatch(/llama-old/);
    expect(p.message).toMatch(/\/api\/groq\/models/);
  });
  it("explains a bad key", () => {
    const p = describeGroqError(apiError(401, "Invalid API Key"))!;
    expect(p.message).toMatch(/GROQ_API_KEY/);
    expect(p.retryable).toBe(false);
  });
  it("treats rate limits and server errors as retryable", () => {
    expect(describeGroqError(apiError(429, "slow down"))!.retryable).toBe(true);
    expect(describeGroqError(apiError(503, "down"))!.retryable).toBe(true);
  });
  it("passes through the reason for other 400s", () => expect(describeGroqError(apiError(400, "bad schema"))!.message).toMatch(/bad schema/));
  it("never includes the API key in a message", () => {
    process.env.GROQ_API_KEY = "gsk_SECRET_VALUE_123";
    const all = [401, 404, 429, 400, 500].map((s) => describeGroqError(apiError(s, "x"))!.message).join(" ");
    expect(all.includes("gsk_SECRET_VALUE_123")).toBe(false);
  });
  it("tells the user how long to wait and what Groq said, hiding organization ids", () => {
    const p = describeGroqError(apiError(429, "Rate limit reached for model x in organization org_abc123 on tokens per minute (TPM): Limit 8000", { "retry-after": "42" }))!;
    expect(p.retryable).toBe(true);
    expect(p.message).toMatch(/about 42 seconds/);
    expect(p.message).toMatch(/tokens per minute/);
    expect(p.message.includes("org_abc123")).toBe(false);
  });
});
