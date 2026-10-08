# Fixed public demo evidence

`corpus.json` contains five short, original paraphrases of public SZL Command Lab route and domain roles. The Command Lab README at revision `54716b32f9515c99e15f3b677618a919202216e5` is the source for the Atlas, Launchpad, and anatomy facts; the two domain entries describe the public product and proof roots. This corpus is committed under the repository's Apache-2.0 license. It is demonstration material, not a benchmark or evidence of model quality.

`receipts/intact.json`, `tampered.json`, and `unsigned.json` are fixed synthetic records generated with `szl-guardrail-receipt==0.1.2` using a fixed timestamp and no private key. All envelopes are unsigned. The intact fixture has a two-record hash chain; tampered changes a decoded reason without updating the PAE hash; unsigned is a single intact record. Integrity PASS does not mean signature PASS, and no fixture establishes scientific validity, correct policy, or action authority.

Only named fixture IDs are served. Visitors cannot supply a corpus, receipt, URL, file, or arbitrary query.
