---
name: og
description: Document the existing local OG brand checks and atomic asset handover.
---

# Local OG helper procedure

Use this procedure for an authorized brand-asset change. It describes the
existing `scripts/brand-check.mjs`, `scripts/write-atomic.mjs`, and
`scripts/grok-pwa-shared.mjs` behavior, not a recovered upstream policy or a
claim that an image-generation/background-task tool is available.

## Brand-asset pass: independent task contract

For a separately launched brand task, never `wait_tasks` or `get_task_output`
for that task. The parent continues independent checks and reports pending work
without claiming completion. The brand task creates
`/workspace/.grok/og-pending` when starting and removes it on completion or
failure. A marker younger than 10 minutes suppresses parent brand warnings;
after that bound it no longer suppresses them. Do not refresh an abandoned
marker to conceal a failed or unfinished pass.

The task's own CLI check ignores that suppression and judges the assets on
disk. If no suitable asset-generation tool or approved source art is available,
report the limitation; do not create a fake card or claim a successful pass.

## On-disk contracts and self-check

Run from the repository root. `/workspace` means that root in the template
environment; adapt the absolute examples to the actual checkout.

- A custom share card is a 1200x630 image from the app's own authorized art,
  normally `public/og.jpg`. The checker also recognizes `public/og.png`.
  Keep the card at or below 600 KiB; the helper recommends JPEG encoding with
  `ffmpeg -q:v 4`. Check dimensions and visual correctness separately: the
  script checks presence, size and metadata, not image decoding or quality.
- Preserve the existing identity in `src/lib/og/site.json`. A custom card
  requires `"card": "custom"` there. Do not replace the whole document with
  example metadata or invent source/product claims.
- Games, including DOM games without a canvas, additionally need
  `"type": "x:game"` and `public/x-banner.jpg`, a 1200x264 (50:11) JPEG feed
  banner at or below 600 KiB. Do not substitute `x:type` or `twitter:card` for
  the game signal. Pass the game flag explicitly when the caller knows it is
  a game.

For a custom-card pass:

```sh
node scripts/brand-check.mjs
```

For a game pass:

```sh
node scripts/brand-check.mjs --game
```

Only a plain utility intentionally retaining the platform placeholder uses:

```sh
node scripts/brand-check.mjs --placeholder-ok
```

The placeholder flag does not excuse a missing game card. Exit status 1 or
`ok: false` is a failure, even while the pending marker exists. A passing
result is only the listed local helper checks, not runtime, research, image
quality, deployment, or production qualification.

## Complete-file handover

Follow [asset-handover.md](references/asset-handover.md) for the three supported
card, banner and identity-file examples. Keep the entire `.grok` scratch area
ignored except this guide and that reference. Do not place temporary assets in
`public/`, which Vite copies verbatim into the built app.
