import Link from "next/link";

const modes = [
  { title: "1. Silent draft", body: "Paste a script. Groq plans the storyboard, Vidscript animates it and renders a silent MP4 plus sceneTiming.json." },
  { title: "2. Final render", body: "Upload your finished voiceover and Lafzaly captions. Align scenes to the real audio, then render the final MP4 with burned-in captions." },
];

export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Vidscript logo" width={56} height={56} className="rounded-xl" />
        <span className="text-2xl font-bold">Vidscript</span>
      </div>
      <h1 className="mt-12 text-5xl font-extrabold leading-tight">Turn your script into animated visuals.<br />Add your voice. Publish your video.</h1>
      <p className="mt-6 max-w-2xl text-lg text-white/70">An animated video studio for YouTube creators. You bring the script, voiceover, and Lafzaly captions. Vidscript brings the visuals, timeline control, and the final MP4.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {modes.map((m) => (
          <div key={m.title} className="rounded-2xl border border-white/10 bg-navy-900 p-6">
            <h2 className="text-xl font-semibold text-brand-orange">{m.title}</h2>
            <p className="mt-2 text-white/70">{m.body}</p>
          </div>
        ))}
      </div>
      <Link href="/projects/new" className="mt-10 inline-block rounded-xl bg-brand-orange px-6 py-3 font-semibold text-navy-950">Create video from script</Link>
    </main>
  );
}
