import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export const RENDER_FILES = ["draft.mp4", "sceneTiming.json", "storyboard.json", "credits.txt"] as const;
export type RenderFile = (typeof RENDER_FILES)[number];

export const storageRoot = () => path.resolve(process.env.STORAGE_DIR ?? "storage");
export const renderDir = (jobId: string) => path.join(storageRoot(), "renders", jobId);
/** Only whitelisted file names are ever joined onto a path, so callers cannot escape the render directory. */
export const renderFilePath = (jobId: string, name: RenderFile) => path.join(renderDir(jobId), name);

export async function ensureRenderDir(jobId: string) {
  await mkdir(renderDir(jobId), { recursive: true });
}
export async function writeRenderText(jobId: string, name: RenderFile, text: string) {
  await writeFile(renderFilePath(jobId, name), text, "utf8");
}
export async function writeRenderJson(jobId: string, name: RenderFile, data: unknown) {
  await writeFile(renderFilePath(jobId, name), JSON.stringify(data, null, 2));
}
