# Vidscript

Turn your script into animated visuals. Add your voice. Publish your video.

Vidscript is a video generation tool only. It does not generate voiceover or captions; those come from you and Lafzaly.

## Status

Build order progress (see the spec): steps 1 (scaffold, Prisma), 2 (Zod schema), 3 (duration estimation, UI preview), 4 (Remotion skeleton), part of 7 (Title, Bullet, Stat scenes; others use a placeholder) and the silent-draft render script (8) are in place. Not yet built: API routes, auth, uploads, Groq generator, storyboard/timeline editors, remaining scene templates, Lambda rendering.

This code has not been installed or run yet. Run `npm install && npm run typecheck && npm test` first and fix anything that surfaces.

## Setup

1. `cp .env.example .env` and fill in values (secrets stay server-side).
2. `npm install` (keep all `remotion` and `@remotion/*` packages on the same exact version).
3. `npx prisma migrate dev --name init`
4. `npm run dev`

## Favicon

`src/app/favicon.ico`, `icon.png`, `apple-icon.png` are generated from the Vidscript logo and auto-registered by Next.js. `public/logo.png` is used on the landing page.

## Local silent-draft render

`npm run remotion:studio` to preview. `npm run render:draft -- plan.json out/draft.mp4` renders a muted H.264 (CRF 18) MP4 and writes `sceneTiming.json` beside it.

## Lambda (later)

Set `REMOTION_RENDER_MODE=lambda` plus the `REMOTION_LAMBDA_*` and `S3_*` variables; deploy the site with `npx remotion lambda sites create`.

## Step 5: Groq visual-plan route

`POST /api/projects/[projectId]/visual-plan` takes `{ script, visualStyle, brand, mode?, wordsPerMinute?, actualDurationSeconds?, audience?, tone?, targetSceneCount? }`, asks Groq for a storyboard only (title + scenes), snaps scene timings to the target duration in code, validates with the shared Zod schema (one corrective retry), and stores the raw response plus validated plan as a new StoryboardVersion. Strict Structured Outputs are tried first; a 400 from Groq falls back to JSON Object Mode.

Auth is a placeholder: set `DEV_USER_ID` in `.env` to any string. The matching User row is created automatically when you create your first project.

## Step 6: Storyboard editor

- `/projects/new` creates the project (`POST /api/projects`) then generates the storyboard.
- `/projects/[projectId]` shows a live Remotion Player preview, a timeline with draggable scene boundaries, and a scene editor (title, type, visual, animation, transitions, notes, split and merge).
- Saving (`PUT /api/projects/[projectId]/storyboard`) validates the plan and writes a NEW version; earlier versions are never overwritten. Regenerating asks for confirmation if you have unsaved edits.
- Timeline, comparison and map visuals are edited as validated JSON for now.

## Step 7: Scene templates

All 17 templates exist: Title, Hook, Map, TerrainMap, TradeRoute, AnimatedBorders, BeforeAfterMap, Timeline, Bullet, Process, Comparison, Chart (line, bar, donut), Quote, Image, Stat, Summary, Cta.

Maps are schematic, not geographic: regions are stylised shapes placed by a deterministic layout, labels use their x/y, routes are animated curves, and terrain glyphs come from keywords (mountain, river, desert, sea). There is no real map data, so they show structure and sequence, not true borders. Real geography (for example GeoJSON via d3-geo) would be a separate step.

Image scenes show `imageUrl` when set and a branded gradient otherwise; Vidscript does not generate images.

## Step 8: Silent MP4 rendering

Run `npx prisma migrate dev --name render_jobs` (RenderJob gained `storyboardVersion` and `outputFiles`).

On a saved storyboard, "Render silent draft" creates a job (`POST /api/projects/[id]/render`) and opens `/renders/[id]`, which polls progress every 1.5s. Renders run one at a time in the Next.js server process using the Remotion Node renderer (H.264, CRF 18, muted, no captions) and write `draft.mp4`, `sceneTiming.json` and `storyboard.json` to `STORAGE_DIR/renders/<id>/` (default `./storage`). Files are served through an authorized route with Range support so the video can seek.

Notes:
- The first render downloads a Chrome build for Remotion, so it needs internet and takes longer; the first bundle is cached for later renders.
- Jobs can be canceled and retried. If the server restarts mid-render, the job is marked failed with a retry button.
- In-process rendering suits local use. S3 storage and Lambda come in step 14; scene-level regeneration is not built yet.
- CLI alternative: `npm run render:draft -- plan.json out/draft.mp4`.

## Step 9: Voiceover upload

Run `npx prisma migrate dev --name voiceover_storage` and `npm install` (adds `@remotion/media-parser`).

On a project page, upload MP3, WAV, M4A or AAC (up to 300 MB). The file streams straight to `STORAGE_DIR/projects/<id>/` (never held in memory) and the server reads the real duration with Remotion's media parser; a file that cannot be read as audio is rejected. If a container carries no duration (some raw `.aac` streams), the browser's measurement (`@remotion/media-utils`) is used as a fallback. The panel shows file name, size, duration and upload date, plays the audio, and compares the real length with your storyboard (the voiceover is the source of truth). Replace and Remove are supported; the voiceover is served through an authorized, Range-capable route.

The final-render duration will come from this stored value, never from the script word count. Aligning scenes to it is step 11.

## Step 10: Lafzaly captions

Run `npx prisma migrate dev --name caption_storage`.

Upload a Lafzaly `.srt` (preferred) or `.vtt` (UTF-8, up to 5 MB) on the project page. The original bytes are stored untouched and can be downloaded back; parsing is read-only, so caption text and timing are never edited. The panel shows file name, cue count, declared language (WebVTT `Language:` header) or detected writing system, and coverage against the voiceover.

Validation checks that timestamps parse, cues are in chronological order, each cue ends after it starts, and nothing runs past the voiceover. It is re-run against the current voiceover every time the page loads or the audio is replaced; with no voiceover the status is "not yet checked". Warnings (more than two lines, very short or overlapping cues) never block anything, and the cues are shown unchanged.

Style presets (Minimal, Bold, Lower third, Boxed, Outline; all high contrast, max two lines) and the burn-in toggle are saved per project. The preview plays your storyboard with the real voiceover and the cues, composed the way the final render will. No caption file means a render without captions.

Notes: Arabic-script captions (Urdu, Arabic, Persian) render right-to-left with the system fallback font; bundling a dedicated Urdu/Arabic font for the final render is a polish item for step 15. The render path will use `@remotion/captions` `parseSrt()` for SRT in step 12; the panel's parser is stricter on purpose, to report problems.

## Step 11: Timeline alignment

With a voiceover uploaded, the voiceover is the source of truth. Three ways to align (all in the project editor, none touches your saved versions until you click Save):

- **Proportional stretch**: scales every scene by one factor so the timeline ends exactly at the voiceover length (for example, 8% longer audio gives 8% longer scenes).
- **Manual**: drag scene boundaries on a timeline that shows the voiceover waveform (decoded in the browser; skipped for files over 80 MB) and the Lafzaly cues. Boundaries can snap to caption starts. Scenes cannot overlap or drop below 1.5s; split, merge and type/visual changes work as before. The timeline is as wide as the longer of storyboard and voiceover, so a mismatch is visible.
- **AI-assisted**: `POST /api/projects/[id]/alignment` sends Groq the script excerpts, current scenes and caption chunks, and asks which caption chunk each scene should start at. The start times come from those captions, not from the model, and are validated (one retry). The result is only a **suggestion**: you review old vs new times and click Apply, and nothing is saved or rendered until you save a version. It needs a valid caption file and a saved storyboard.

Applying any alignment converts the plan to `final-render` mode (`actualDurationSeconds` = voiceover length, voiceover and caption URLs set) and asks for confirmation if it would replace unsaved edits or an earlier alignment. The silent-draft render button is disabled for final-render plans; the final render is step 12, which will also derive caption style from the saved preset.

## Real photos and footage (stock assets)

The storyboard now asks Groq for a short search phrase and a Photo/Video choice per scene. Groq never picks or links files; it only writes the phrase.

- **Find visuals** (project page) searches and downloads one match for every scene that has a phrase and a Photo/Video setting but no visual yet. In the scene editor you can search yourself, choose from the results, use "Pick best match", or remove a visual.
- **Sources (all free):** Pexels and Pixabay (each needs a free API key: `PEXELS_API_KEY`, `PIXABAY_API_KEY`) and Wikimedia Commons photos (no key; only reusable licences are offered: public domain, CC0, CC BY, CC BY-SA). Video clips need a Pexels or Pixabay key.
- **Caching:** files are downloaded once, stored under their SHA-256 in `STORAGE_DIR/assets/<user>/`, and recorded with provider, creator, licence and page (table `MediaAsset`). Search results are cached for 24 hours, as Pixabay requires, which also protects the free rate limits.
- **Safety:** downloads are only accepted from the providers' own domains (redirects included), size-capped (25 MB images, 150 MB clips), and checked by their actual bytes, so a web page can never be saved as an image.
- **In the video:** a photo or clip sits behind title, hook, bullet, stat, quote, summary, CTA, image and timeline scenes, darkened for readability (photos push in slowly; short clips loop, muted). Charts, maps, process and comparison scenes keep a plain background so their detail stays crisp. When nothing is found, the scene keeps its plain animated background and the editor says why.
- **Credits:** every render also writes `credits.txt` listing the source and licence of each stock asset. Paste it into your video description; CC BY and CC BY-SA files require attribution.
- Pixabay asks that search results show their source, which the picker does ("via Pixabay"); chosen files are downloaded and hosted locally rather than hotlinked.

Run `npx prisma migrate dev --name add_media_assets` (adds one new table; nothing existing changes).
"# Vidscript" 
