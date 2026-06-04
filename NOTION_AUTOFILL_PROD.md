# Notion Auto-fill — Production Setup

How to run the Notion auto-fill (geocoding, posters, slugs, palettes, etc.) on
the live Vercel site. It replaces the old local `npm run watch:notion` loop with
an on-demand button you click from Notion.

---

## One-time setup (3 steps)

### 1. Make up a password
Pick any random string, e.g. `af_8h3kd92ksla`. This is just a secret so randos
can't trigger your auto-fill. Call it your **key**.

### 2. Tell Vercel the password
- Vercel → your project → **Settings → Environment Variables**
- Add:
  - **Name:** `AUTOFILL_SECRET`
  - **Value:** the random string from step 1
- Save, then **redeploy** (Deployments → ⋯ → Redeploy) so it takes effect.

> The redeploy is only needed to teach the live site the password.
> ⚠️ If `AUTOFILL_SECRET` is left blank in production, the endpoint is **open** to
> anyone — so make sure you set it.

### 3. Make a button in Notion
- Open any auto-fill database (Locations, Music, Series, …).
- Add a property → type **Button**.
- One action: **Open link**, with this URL (swap in your real domain + key):

  ```
  https://your-site.com/api/notion-autofill?key=af_8h3kd92ksla
  ```

- Name it something like **"Run Auto-fill"**.

> The link is the same everywhere, so **one button in one DB triggers a run for
> all DBs**. You don't need a button in every database.

---

## Day-to-day use

1. Add/edit rows in Notion and tick **Needs Auto-fill** on the ones to fill.
2. Click your **Run Auto-fill** button.
3. A browser tab opens with a small `{"ok":true,...}` message — that's the
   confirmation. Your rows get filled a few seconds later.

---

## Good to know

- **Manual, not automatic.** You tick the boxes, then click the button (by
  design — on-demand).
- **Big batches:** a single run has a ~60-second budget and the pipeline is slow
  per row (GPT calls + ~1.1s geocoding politeness). If you ticked a lot and it
  times out, just click again — it's idempotent: already-filled fields are left
  alone, and a row's box is only unchecked once it succeeds.
- **This ≠ refreshing the site text.** The button does the *enrichment*. Your
  site separately re-pulls Notion content on its own (within ~1 hour in prod).
- **Local dev still works.** `npm run watch:notion` runs the same logic on a
  loop on your machine, and the route runs without a key locally (no secret set).
- **"Skipped" lines** in the response (e.g. `education skipped: Could not find
  property … Needs Auto-fill`) just mean that DB has no **Needs Auto-fill**
  checkbox column. Add the column to enable its auto-fill, or ignore it.

---

## Optional: run it automatically (no clicking)

Not set up. If you want it, add a Vercel Cron in `vercel.json` pointing at
`/api/notion-autofill` (it already accepts `Authorization: Bearer <CRON_SECRET>`).
Note: Hobby plan caps crons at once/day; Pro allows every few minutes.

---

## Technical reference

| Thing | Value |
|---|---|
| Route | `app/api/notion-autofill/route.js` |
| URL | `GET/POST /api/notion-autofill?key=<AUTOFILL_SECRET>` |
| Auth | `?key=` = `AUTOFILL_SECRET`, **or** `Authorization: Bearer <CRON_SECRET>`; open if neither is set (dev) |
| Core logic | `lib/notion-autofill.mjs` → `runAutofill()` |
| Local loop | `scripts/watch-notion.mjs` (`npm run watch:notion`) |
| Max duration | 60s per call |
| Env vars | `AUTOFILL_SECRET` (required in prod), plus the existing `NOTION_TOKEN`, `OPENAI_API_KEY`, and the per-DB IDs |
