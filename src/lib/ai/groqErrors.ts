import OpenAI from "openai";

export type GroqProblem = { message: string; retryable: boolean };

/** Turns a Groq/OpenAI-SDK error into a clear message for the user. Returns null for errors that are not from the API client. */
export function describeGroqError(err: unknown, model: string | undefined = process.env.GROQ_MODEL): GroqProblem | null {
  if (!(err instanceof OpenAI.APIError)) return null;
  const detail = String((err.error as { message?: unknown } | undefined)?.message ?? err.message).slice(0, 300);
  switch (err.status) {
    case undefined:
      return { message: "Could not reach Groq. Check your internet connection, then retry.", retryable: true };
    case 401:
    case 403:
      return { message: "Groq rejected the API key. Check GROQ_API_KEY in .env, then restart the dev server.", retryable: false };
    case 404:
      return { message: `Groq does not offer the model "${model ?? "(not set)"}" to your key. Open /api/groq/models to see which models you can use, set GROQ_MODEL in .env, and restart the dev server.`, retryable: false };
    case 429: {
      const retryAfter = Number((err.headers as Record<string, string> | undefined)?.["retry-after"]);
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? `about ${Math.ceil(retryAfter)} seconds` : "a minute";
      const why = detail.replace(/org_\w+/g, "your organization");
      return { message: `Groq's free-tier rate limit was reached. Wait ${wait}, then retry. Groq says: ${why}`, retryable: true };
    }
    case 400:
    case 413:
    case 422:
      return { message: `Groq rejected the request: ${detail}`, retryable: false };
    default:
      return err.status >= 500
        ? { message: "Groq is having trouble right now. Please retry shortly.", retryable: true }
        : { message: `Groq error: ${detail}`, retryable: false };
  }
}
