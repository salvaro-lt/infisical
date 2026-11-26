# Community OIDC SSO

Org-level "Sign in with OIDC" for users, written from scratch under the repo's MIT license. It lives
beside the Enterprise implementation (`src/ee/services/oidc/`), which stays untouched and keeps its
own `/api/v1/sso/oidc/*` routes; this module is served at `/api/v1/sso/community-oidc/*` and the
frontend calls only these routes.

- **Never import from, or copy code out of, `src/ee/services/oidc/`.** Everything under `ee/` is
  under the Infisical Enterprise license, and modifications to it belong to Infisical. Shared
  primitives outside `ee/` (`processProviderCallback`, `user-alias-fns.ts`, `matchIdpMfaSignal`) are
  fine to use.
- **Both implementations read and write the same `oidc_configs` row.** `orgDAL` derives
  `orgAuthMethod` from it, so the org redirect, the login page and SSO enforcement keep working.
  Keep the client ID and secret encrypted with the org KMS data key in `encryptedOidcClientId` /
  `encryptedOidcClientSecret`.
- **The redirect URI is fixed** to `${SITE_URL}/api/v1/sso/community-oidc/callback`. It must match
  what admins registered at their IdP, so never derive it from the Host header.
- **Login state (state, nonce, PKCE verifier, org) lives only in the server-side session** that the
  SSO router registers (Redis, 10 minutes). The router is mounted inside `registerSsoRouter` for
  that reason. Compare state and nonce with `isSameSecret`.
- **Every IdP call goes through `safeRequest`** (SSRF pinning). Private IdPs need
  `ALLOW_INTERNAL_IP_CONNECTIONS`. JWKS are fetched the same way and verified with
  `jose.createLocalJWKSet`, never `createRemoteJWKSet`, which bypasses the SSRF guard.
- **Linking an SSO identity to an account that already exists is proven by that account's mailbox,
  not by the IdP.** A new alias on an existing user is created unverified, and a verification code
  is emailed. Any org admin controls their own IdP and could otherwise assert someone else's
  address to take over a global account. Only a user created by this login trusts `email_verified`.
- **Org membership is created `Invited`**; `processProviderCallback` accepts it only when it issues
  a session. A deactivated membership fails the login. No membership is created for a stale alias
  (`isStaleSsoAlias`).
- **Not implemented:** group membership sync (`manageGroupMemberships` is always false and
  `true` is rejected), sign-in by verified email domain (the login takes `orgSlug` only), and
  audit-log events for config changes (the event types live in `ee/`).
