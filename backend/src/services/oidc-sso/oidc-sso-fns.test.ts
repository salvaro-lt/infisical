import { describe, expect, test } from "vitest";

import {
  buildAuthorizationUrl,
  createOidcLoginSecrets,
  extractIdentityClaims,
  isEmailDomainAllowed,
  isSameSecret,
  toDiscoveryDocumentUrl
} from "./oidc-sso-fns";

describe("toDiscoveryDocumentUrl", () => {
  test("appends the well-known path to an issuer URL", () => {
    expect(toDiscoveryDocumentUrl("https://idp.example.com/realms/acme/")).toBe(
      "https://idp.example.com/realms/acme/.well-known/openid-configuration"
    );
  });

  test("keeps a URL that already names the discovery document", () => {
    expect(toDiscoveryDocumentUrl("https://idp.example.com/.well-known/openid-configuration")).toBe(
      "https://idp.example.com/.well-known/openid-configuration"
    );
  });
});

describe("isEmailDomainAllowed", () => {
  test("allows everything when no domains are configured", () => {
    expect(isEmailDomainAllowed("a@anything.io", "")).toBe(true);
    expect(isEmailDomainAllowed("a@anything.io", null)).toBe(true);
  });

  test("matches the exact domain, case-insensitively, ignoring spaces and @", () => {
    expect(isEmailDomainAllowed("jane@Acme.com", " acme.com, @corp.io ")).toBe(true);
    expect(isEmailDomainAllowed("jane@corp.io", "acme.com,@corp.io")).toBe(true);
  });

  test("rejects subdomains and lookalikes", () => {
    expect(isEmailDomainAllowed("jane@evil.acme.com", "acme.com")).toBe(false);
    expect(isEmailDomainAllowed("jane@acme.com.evil.io", "acme.com")).toBe(false);
    expect(isEmailDomainAllowed("not-an-email", "acme.com")).toBe(false);
  });
});

describe("createOidcLoginSecrets / buildAuthorizationUrl", () => {
  test("produces an S256 PKCE challenge derived from the verifier", async () => {
    const secrets = createOidcLoginSecrets();
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(secrets.codeVerifier));
    expect(secrets.codeChallenge).toBe(Buffer.from(digest).toString("base64url"));
    expect(secrets.state).not.toBe(secrets.nonce);
  });

  test("keeps existing query params and sets the authorization code flow params", () => {
    const url = new URL(
      buildAuthorizationUrl({
        authorizationEndpoint: "https://idp.example.com/authorize?tenant=acme",
        clientId: "client-1",
        redirectUri: "https://app.example.com/api/v1/sso/community-oidc/callback",
        state: "s",
        nonce: "n",
        codeChallenge: "c"
      })
    );
    expect(url.searchParams.get("tenant")).toBe("acme");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/v1/sso/community-oidc/callback");
  });
});

describe("isSameSecret", () => {
  test("compares exactly", () => {
    expect(isSameSecret("abc", "abc")).toBe(true);
    expect(isSameSecret("abc", "abd")).toBe(false);
    expect(isSameSecret("abc", "abcd")).toBe(false);
  });
});

describe("extractIdentityClaims", () => {
  test("prefers ID token claims and falls back to userinfo", () => {
    expect(
      extractIdentityClaims(
        { sub: "u-1", given_name: "Jane" },
        { email: "jane@acme.com", email_verified: true, family_name: "Doe" }
      )
    ).toEqual({ sub: "u-1", email: "jane@acme.com", isEmailVerified: true, firstName: "Jane", lastName: "Doe" });
  });

  test("treats a missing email_verified claim as unverified", () => {
    expect(extractIdentityClaims({ sub: "u-1", email: "jane@acme.com" }).isEmailVerified).toBe(false);
  });

  test('accepts the string "true" for email_verified', () => {
    expect(extractIdentityClaims({ sub: "u-1", email: "jane@acme.com", email_verified: "true" }).isEmailVerified).toBe(
      true
    );
  });

  test("splits the display name when given/family names are absent", () => {
    const claims = extractIdentityClaims({ sub: "u-1", name: "Jane van Doe" });
    expect(claims.firstName).toBe("Jane");
    expect(claims.lastName).toBe("van Doe");
    expect(claims.email).toBeNull();
  });
});
