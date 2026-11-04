/* CLI silent-draft render: `npm run render:draft -- plan.json out/draft.mp4`
   Uses the same renderer as the web app and writes sceneTiming.json beside the MP4. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { vidscriptPlanSchema } from "../src/remotion/schemas/vidscriptSchema";
import { sceneTimingExport } from "../src/lib/render/metadata";
import { renderSilentDraft } from "../src/lib/render/local";

async function main() {
  const [planPath = "plan.json", out = "out/draft.mp4"] = process.argv.slice(2);
  const plan = vidscriptPlanSchema.parse(JSON.parse(await readFile(planPath, "utf8")));
  await mkdir(path.dirname(out), { recursive: true });
  await renderSilentDraft(plan, path.resolve(out), { onProgress: (f) => process.stdout.write(`\rRendering ${(f * 100).toFixed(0)}%`) });
  await writeFile(path.join(path.dirname(out), "sceneTiming.json"), JSON.stringify(sceneTimingExport(plan), null, 2));
  console.log(`\nDone: ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
