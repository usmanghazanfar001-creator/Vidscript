import { LoginForm } from "@/components/auth/LoginForm";
import { safeNext } from "@/lib/authn/access";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={48} height={48} className="rounded-xl" />
      <h1 className="mt-6 text-3xl font-bold">Sign in to Vidscript</h1>
      <p className="mt-2 text-sm text-white/60">This workspace is private.</p>
      <LoginForm next={safeNext(searchParams.next)} />
    </main>
  );
}
