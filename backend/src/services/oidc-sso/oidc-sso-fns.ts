import { crypto } from "@app/lib/crypto";

import { TOidcIdentityClaims } from "./oidc-sso-types";

const WELL_KNOWN_SUFFIX = "/.well-known/openid-configuration";

export const OIDC_SSO_CALLBACK_PATH = "/api/v1/sso/community-oidc/callback";

// Fixed rather than derived from the Host header: it must match the redirect URI registered at the IdP.
export const buildOidcSsoRedirectUri = (siteUrl?: string) =>
  `${(siteUrl ?? "").replace(/\/+$/, "")}${OIDC_SSO_CALLBACK_PATH}`;

export const buildOidcSsoLoginUrl = (siteUrl: string | undefined, orgSlug: string) =>
  `${(siteUrl ?? "").replace(/\/+$/, "")}/api/v1/sso/community-oidc/login?orgSlug=${encodeURIComponent(orgSlug)}`;

export const toDiscoveryDocumentUrl = (discoveryUrl: string) => {
  const trimmed = discoveryUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith(WELL_KNOWN_SUFFIX) ? trimmed : `${trimmed}${WELL_KNOWN_SUFFIX}`;
};

export const parseAllowedEmailDomains = (allowedEmailDomains?: string | null) =>
  (allowedEmailDomains ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

export const isEmailDomainAllowed = (email: string, allowedEmailDomains?: string | null) => {
  const allowed = parseAllowedEmailDomains(allowedEmailDomains);
  if (!allowed.length) return true;
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 0) return false;
  const domain = email.slice(atIndex + 1).toLowerCase();
  // "*.example.com" admits subdomains only; list "example.com" as well to admit the apex.
  return allowed.some((entry) => (entry.startsWith("*.") ? domain.endsWith(entry.slice(1)) : domain === entry));
};

const toBase64Url = (buf: Buffer) => buf.toString("base64url");

export const createOidcLoginSecrets = () => {
  const codeVerifier = toBase64Url(crypto.randomBytes(32));
  const codeChallenge = toBase64Url(crypto.nativeCrypto.createHash("sha256").update(codeVerifier).digest());
  return {
    state: toBase64Url(crypto.randomBytes(24)),
    nonce: toBase64Url(crypto.randomBytes(24)),
    codeVerifier,
    codeChallenge
  };
};

export const buildAuthorizationUrl = ({
  authorizationEndpoint,
  clientId,
  redirectUri,
  state,
  nonce,
  codeChallenge
}: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}) => {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
};

// Constant-time so a forged callback cannot learn the expected state byte by byte.
export const isSameSecret = (expected: string, received: string) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.nativeCrypto.timingSafeEqual(a, b);
};

const asTrimmedString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Some IdPs (Cognito, older ADFS) send email_verified as the string "true".
const asBoolean = (value: unknown) => value === true || value === "true";

export const extractIdentityClaims = (
  idTokenClaims: Record<string, unknown>,
  userinfoClaims: Record<string, unknown> = {}
): Omit<TOidcIdentityClaims, "email"> & { email: string | null } => {
  const claim = (name: string) => idTokenClaims[name] ?? userinfoClaims[name];

  const displayName = asTrimmedString(claim("name"));
  const [displayFirst, ...displayRest] = displayName.split(/\s+/).filter(Boolean);

  const email = asTrimmedString(claim("email"));
  return {
    sub: asTrimmedString(idTokenClaims.sub),
    email: email || null,
    isEmailVerified: Boolean(email) && asBoolean(claim("email_verified")),
    firstName: asTrimmedString(claim("given_name")) || displayFirst || "",
    lastName: asTrimmedString(claim("family_name")) || displayRest.join(" ")
  };
};
