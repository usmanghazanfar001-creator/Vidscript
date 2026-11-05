import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { prisma } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let projects: Array<{ id: string; title: string; mode: string; updatedAt: Date }> = [];
  let notice: string | null = null;
  try {
    projects = await prisma.project.findMany({ where: { userId: requireUserId() }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, mode: true, updatedAt: true } });
  } catch (e) {
    notice = e instanceof UnauthorizedError ? e.message : "Could not load projects. Check DATABASE_URL and run the migrations.";
  }
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        <div className="flex items-center gap-3">
          <SignOutButton />
          <Link href="/projects/new" className="rounded-xl bg-brand-orange px-5 py-2 font-semibold text-navy-950">New project</Link>
        </div>
      </div>
      {notice ? <p className="mt-8 text-red-300">{notice}</p> : null}
      {!notice && projects.length === 0 ? <p className="mt-8 text-white/60">No projects yet. Create one to generate your first silent draft.</p> : null}
      <ul className="mt-8 grid gap-3">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/projects/${p.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-navy-900 p-4 hover:border-brand-orange">
              <span className="font-semibold">{p.title}</span>
              <span className="text-sm text-white/50">{p.mode === "SILENT_DRAFT" ? "Silent draft" : "Final render"} · {p.updatedAt.toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
