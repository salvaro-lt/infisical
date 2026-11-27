export type OIDCConfigData = {
  id: string;
  issuer: string;
  authorizationEndpoint: string;
  configurationType: string;
  discoveryURL: string;
  jwksUri: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  isActive: boolean;
  orgId: string;
  clientId: string;
  clientSecret: string;
  allowedEmailDomains?: string;
  manageGroupMemberships: boolean;
  jwtSignatureAlgorithm: OIDCJWTSignatureAlgorithm;
  mfaClaimName: string;
  mfaAmrValues?: string[] | null;
  lastUsed?: string | null;
  // The callback URL admins register at their IdP, built by the server from SITE_URL.
  redirectUri?: string;
};

export enum OIDCJWTSignatureAlgorithm {
  RS256 = "RS256",
  HS256 = "HS256",
  RS512 = "RS512",
  EDDSA = "EdDSA"
}
