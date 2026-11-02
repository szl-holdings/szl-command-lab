# Demo receipt integrity

The in-browser receipt uses `szl.demo-receipt/v1` and the public
`WEBCRYPTO_HMAC_DEMO` signer. It demonstrates payload binding and verification;
it does not establish production signature authority.

`mintReceipt` accepts ordinary JSON payloads: null, booleans, strings, finite
numbers, dense arrays, and plain objects with enumerable data properties. It
rejects values that JSON would silently omit or coerce, including non-finite
numbers, undefined values, sparse arrays, accessors, symbol keys, and unsupported
object types. Cycles and nesting deeper than 128 levels are rejected. JSON's
existing equivalence between negative zero and zero is retained.

Valid JSON keeps the existing canonical key order. Minting snapshots the input
before asynchronous hashing, so later changes to the caller's input cannot alter
the returned receipt body. Invalid input rejects the mint operation.

`verifyReceipt` recomputes the digest and demo HMAC from a validated snapshot.
Malformed or lossy JSON and receipts changed during verification return
`ok: false`. A result is successful only when the schema, digest, MAC, signer
class, and evidence class checks all pass. A crypto failure also returns a failed
result. Callers should use `ok` for the combined verification outcome; individual
fields such as `digest_match` describe checks on the captured snapshot.

Run the offline regression suite with Node 22 or 24:

```sh
node --experimental-strip-types --test src/lib/receipt.test.ts
```

The suite covers valid round trips, payload tampering, lossy JSON collisions,
prototype-key preservation, and mutation while crypto is pending. The Node source
CI workflow runs it on both supported Node versions. This receipt contract does
not change deployment authority or production readiness gates.
