import Link from "next/link";

export type RenderSummary = { id: string; status: string; progress: number; createdAt: string; storyboardVersion: number | null };

const label: Record<string, string> = { QUEUED: "Queued", RENDERING: "Rendering", COMPLETED: "Completed", FAILED: "Failed", CANCELED: "Canceled" };
const color: Record<string, string> = { QUEUED: "text-white/60", RENDERING: "text-brand-blue", COMPLETED: "text-emerald-400", FAILED: "text-red-400", CANCELED: "text-white/50" };

export function RenderHistory({ renders }: { renders: RenderSummary[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">Render history</h2>
      {renders.length === 0 ? <p className="mt-3 text-sm text-white/50">No renders yet.</p> : (
        <ul className="mt-3 grid gap-2">
          {renders.map((r) => (
            <li key={r.id}>
              <Link href={`/renders/${r.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-navy-900 px-4 py-3 text-sm hover:border-brand-orange">
                <span>Silent draft{r.storyboardVersion ? ` · storyboard v${r.storyboardVersion}` : ""}</span>
                <span className="flex gap-4">
                  <span className="text-white/50">{new Date(r.createdAt).toLocaleString()}</span>
                  <span className={color[r.status] ?? ""}>{label[r.status] ?? r.status}{r.status === "RENDERING" ? ` ${r.progress}%` : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
