import { TOrgPermission } from "@app/lib/types";

export enum OidcSsoConfigurationType {
  Discovery = "discoveryURL",
  Custom = "custom"
}

export enum OidcSsoSigningAlgorithm {
  RS256 = "RS256",
  RS512 = "RS512",
  HS256 = "HS256",
  EdDSA = "EdDSA"
}

export type TOidcSsoConfigInput = {
  configurationType: OidcSsoConfigurationType;
  discoveryURL?: string;
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  jwksUri?: string;
  userinfoEndpoint?: string;
  clientId: string;
  clientSecret: string;
  allowedEmailDomains?: string;
  isActive: boolean;
  jwtSignatureAlgorithm: OidcSsoSigningAlgorithm;
  mfaClaimName?: string;
  mfaAmrValues?: string[] | null;
};

export type TGetOidcSsoConfigDTO = Omit<TOrgPermission, "orgId"> & { organizationId: string };

export type TCreateOidcSsoConfigDTO = TGetOidcSsoConfigDTO & TOidcSsoConfigInput;

export type TUpdateOidcSsoConfigDTO = TGetOidcSsoConfigDTO & Partial<TOidcSsoConfigInput>;

export type TOidcProviderMetadata = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  userinfoEndpoint?: string;
};

export type TStartOidcSsoLoginDTO = {
  orgSlug: string;
  redirectUri: string;
};

// Everything the callback needs to prove the response answers the request we sent; the router keeps
// it in the server-side session, never in a client-visible cookie.
export type TOidcSsoLoginState = {
  orgId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  callbackPort?: string;
};

export type TCompleteOidcSsoLoginDTO = {
  code: string;
  returnedState: string;
  loginState: TOidcSsoLoginState;
  ip: string;
  userAgent: string;
};

export type TOidcIdentityClaims = {
  sub: string;
  email: string;
  isEmailVerified: boolean;
  firstName: string;
  lastName: string;
};
