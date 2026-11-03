# Repository-local helper contracts

This guide documents the helpers already shipped in this repository. It is not
an upstream policy restoration, release authorization, or evidence of hosted
capability. The implementation and its unchanged contract tests are the source
for the brand-asset procedure below.

## Execution loop

1. Confirm the requested change and its source revision. Keep unrelated work
   and product identity intact.
2. Read the relevant implementation and tests before changing behavior.
3. Preserve the source and receipt controls in `template.lock.json`. A local
   helper guide does not authorize changing its pinned bytes.
4. Make the smallest source or documentation repair that satisfies the actual
   contract; do not substitute fabricated evidence or disabled assertions.
5. Run focused checks, then the applicable full checks. Report failures and
   unavailable tools separately from passes.
6. **Brand-asset pass:** when a separately launched brand task is producing
   assets, never `wait_tasks` or `get_task_output` for that task. Continue the
   parent's independent work and report unfinished assets honestly. The task
   owns `/workspace/.grok/og-pending`: it creates the marker when starting and
   removes it on completion or failure. Parent brand warnings are suppressed
   only while the marker is younger than 10 minutes; stale markers do not
   excuse missing assets. The task checks its own on-disk result with the OG
   skill's CLI procedure, which does not let the marker hide failures.
7. Hand off the exact changed source and check results. A passing local check
   does not authorize publication, deployment, or production activation.

## Brand helper references

Read `.grok/skills/og/SKILL.md` and its
`references/asset-handover.md` before a requested brand-asset change.
`/workspace` in those examples denotes the repository root used by the template;
substitute the actual checkout root elsewhere. Do not change the product's
existing title, card, authentication flags, or source identity just to make a
helper check pass.

`scripts/brand-check.mjs` documents and checks the custom-card/placeholder,
game metadata, banner and size contracts. `scripts/write-atomic.mjs` stages
outside `public/` and renames complete files; it refuses cross-filesystem
handover rather than copying partial bytes. These checks are not image-content
verification, permission to generate media, or production-readiness evidence.
