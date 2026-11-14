# Presentation preflight

The public fixture demonstration is at
https://szlholdings-szl-command-lab.hf.space/demos.

Before a presentation, run this dependency-free Python 3.11+ check from the
repository, with the approved deployed source SHA:

```sh
python scripts/check_public_demo.py \
  --expected-source 4d5e904a369a20839005f595c17188868f79b67c \
  --output /tmp/command-lab-preflight
```

Use a new output directory on each run. The example SHA is the verified
2026-11-11 baseline, not an instruction to deploy or roll back to it. For a
later deployment, use its approved exact source revision.

The command makes thirteen anonymous, read-only GET requests to the fixed public
Space origin, refuses redirects, and saves response bodies, HTTP headers,
timestamps, elapsed times, SHA-256 hashes, and semantic failures in `report.json`.
It exits nonzero for unavailable routes, source or adapter drift, wrong rankings,
incorrect receipt outcomes, and missing disclosure boundaries. It never signs
receipts, changes configuration, restarts a Space, or deploys source.

Expected results:

| Fixture | Result |
| --- | --- |
| Retrieval: inventory | Public Atlas inventory ranks first |
| Retrieval: product | Governed product runtime ranks first |
| Retrieval: proof | Independent proof registry ranks first |
| Receipt: intact | Integrity PASS; signature SKIP |
| Receipt: tampered | Integrity FAIL; signature SKIP |
| Receipt: unsigned | Integrity PASS; signature SKIP |

The tampered result is a successful negative demonstration. All three receipt
fixtures are unsigned; integrity PASS does not authenticate an issuer. Scientific
validity is NOT_EVALUATED and action authority is NONE. This presentation does
not demonstrate live agent execution or independently verified authorization.

The canonical publisher also checks HTTP reachability of all ten demo routes
alongside its existing checks. The manual preflight adds semantic checks; it is
not automatically run by the publisher. Passing checks establish only the
observations at their recorded time, not future uptime.

Keep a clearly labeled recorded offline copy available for the presentation.
If live access fails, say that the audience is seeing recorded fixture output;
do not represent it as current execution. Provider updates and restarts remain
separate explicit operator decisions.
