# OAuth popup validation

The Node frontend uses the Grok auth broker; the public Hugging Face Atlas is a separate Python surface.

`npm run test:ts` runs the popup regressions on both CI Node versions. The suite loads the actual Vite client module with isolated browser and HTTP fixtures. It covers completion during pre-sign-out, source/origin/message validation, failure, blocked popups, and dismissal. The client listens before sign-out yields and accepts completion only from the opened same-origin popup.

These local contracts do not prove live Google/X login. A complete live test still needs the configured Node deployment, its per-app broker registration and callback URLs, and an owner-operated identity-provider sign-in. Better Auth 1.7 sends `/api/auth/callback/<providerId>` as the OAuth redirect URI; the older `/api/auth/oauth2/callback/<providerId>` path is not a substitute.

The HF Atlas health/readiness responses do not validate this broker flow. No broker registrations, credentials, authentication flags, or publisher workflows are changed by the popup repair.
