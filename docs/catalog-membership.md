<!-- SPDX-License-Identifier: Apache-2.0 -->
# Public catalog membership

The Hugging Face author listing currently omits the reserved
`SZLHOLDINGS/README` Space. This is the organization profile, and belongs in the
Space namespace count. It does not represent an additional model or product.

When the public Space author listing does not contain an explicitly public
profile entry, the catalog reads the exact
[`/api/spaces/SZLHOLDINGS/README`](https://huggingface.co/api/spaces/SZLHOLDINGS/README)
endpoint. The response must be HTTP 200 from that endpoint, contain the exact
repository ID, and explicitly declare `private: false`. The catalog retains
the response hash and includes the record once. The explorer labels it
**Organization profile**, and this role is searchable.

A 404 or explicit private response adds no public record. An unavailable or
inconsistent response keeps the other observed records and marks the catalog
PARTIAL; it never adds a fixed offset to the count. Records are keyed by
`(type, id)`, so native kernel/model overlap remains visible without duplicating
an entry inside one namespace. Counts are repository records, not unique
projects or trained models.

`tests/test_reserved_profile.py` covers presence, absence, duplication, private
and ambiguous visibility, failure, source mismatch, and cross-namespace overlap.
The existing hosted browser comparison includes a synthetic profile record and
checks that users can find it by its role. Fixtures are not deployment evidence.

## Failed provider observations

Each family reports its own `family_observations` state, count, observation time,
and latest check time. A failed lookup with no usable observation returns a null
count and **UNAVAILABLE**. The UI displays **—**, not zero. A successful empty
listing still returns and displays zero. The page also identifies unavailable,
partial, and cached families beside the observed-record total.

After a complete successful family observation, its normalized public records
can be reused for at most 900 seconds when that family's provider is unavailable.
These in-memory snapshots are never seeded from a fixed inventory count or a
source census. Cached records retain their original observation time and are
visibly labeled **Cached** in metrics, cards, kernel links, and search results.
The current error remains present, and the overall catalog remains PARTIAL.
Repeated failures cannot renew a snapshot, and the response cache cannot extend
its maximum lifetime. A restart clears the snapshots. Expired records disappear
from the current result, while `last_success_at` preserves the diagnostic time.
A fresh success replaces the family's previous membership, including a confirmed
empty listing. Totals may combine fresh and cached repository records; they are
not a simultaneous census or a readiness claim.

Native kernel membership is obtained from its own namespace. A model tag cannot
substitute for a failed native kernel observation. A partial Space listing caused
by an unavailable reserved-profile lookup does not overwrite its last complete
Space snapshot. If that complete snapshot is later reused, the profile evidence
also carries its old observation time and CACHED state.

On 2026-10-04, the public model author-list request timed out before response
headers with the existing full-metadata request, a minimal request, and explicit
identity-only and display-field projections. A single-model metadata request
succeeded during the same diagnostic period. This establishes a model-list
availability problem from the observed clients; it does not establish an internal
provider root cause or that payload size caused the failure. This change retains
the existing bounded request attempts, response size limit, and socket timeout.
It does not add retries or claim to repair the provider. The Hub's documented
[`list_models` projection options](https://huggingface.co/docs/huggingface_hub/package_reference/hf_api#huggingface_hub.HfApi.list_models)
were used for the smaller diagnostic requests.

`tests/test_catalog_observations.py` covers unknown versus empty, bounded reuse,
original timestamps, replacement, expiry through the response cache, private
exclusion, and native namespace membership. Hosted browser fixtures separately
exercise unavailable, cached, confirmed-zero, and older failure payloads at
320 pixels. The existing width, iframe, touch, and zoom checks remain in place.
