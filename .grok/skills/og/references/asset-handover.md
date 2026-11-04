# Atomic handover of completed brand files

These are invocation examples for the existing `scripts/write-atomic.mjs`,
not commands to manufacture assets or change the product identity. First
prepare and inspect each complete file as part of the authorized change.

Run the helper from the repository root. Relative arguments resolve against
the helper's repository root, not the caller's current working directory.
In the template checkout that root is `/workspace`; substitute your actual
checkout's absolute path for the staged files elsewhere.

Stage outside `public/` but on the target's filesystem, for example under
`/workspace/.grok/`. The helper refuses a staged file inside `public/`, an
identical staged/target path, missing input, or a cross-filesystem rename.
Do not work around these refusals with a partial write or a copy into public
scratch space. A successful rename presents the complete old or new file to
concurrent readers; it does not validate the contents.

## Share card

After checking the authorized 1200x630 card's actual format, dimensions and
size, hand over the finished JPEG:

```sh
node scripts/write-atomic.mjs /workspace/.grok/og.jpg.tmp public/og.jpg
```

## Game feed banner

For an authorized game asset change, inspect the finished 1200x264 JPEG and
hand it over:

```sh
node scripts/write-atomic.mjs /workspace/.grok/x-banner.jpg.tmp public/x-banner.jpg
```

## Identity metadata

Stage a valid JSON document preserving the existing product identity and any
unrelated fields, with only the reviewed metadata changes. A custom card
requires `"card": "custom"`; games also require `"type": "x:game"`.

```sh
node scripts/write-atomic.mjs /workspace/.grok/site.json.tmp src/lib/og/site.json
```

Each file is handed over independently, not as a multi-file transaction.
After all intended handovers, run the appropriate self-check from the skill.
The task then removes its pending marker, including on failure, and reports
the real result. Neither a marker nor an atomic rename is evidence that the
assets meet their visual contract or that a deployed surface is updated.
