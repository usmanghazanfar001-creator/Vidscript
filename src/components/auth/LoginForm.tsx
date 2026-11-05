"use client";
import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Sign-in failed (${res.status})`);
      window.location.assign(next); // full load so the new session cookie is used everywhere
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block text-sm text-white/70" htmlFor="password">Password</label>
      <input
        id="password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-navy-900 p-3"
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button type="submit" disabled={busy || password.length === 0} className="w-full rounded-xl bg-brand-orange px-6 py-3 font-semibold text-navy-950 disabled:opacity-40">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
