"use client";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); }}
      className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
    >
      Sign out
    </button>
  );
}
