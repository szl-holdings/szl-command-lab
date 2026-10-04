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
