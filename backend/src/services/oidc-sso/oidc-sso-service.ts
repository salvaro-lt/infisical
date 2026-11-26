import { ForbiddenError } from "@casl/ability";
import { createLocalJWKSet, errors as joseErrors, JWTPayload, jwtVerify } from "jose";

import { AccessScope, OrganizationActionScope, OrgMembershipStatus, TOidcConfigs, TUsers } from "@app/db/schemas";
import { KmsDataKey, TKmsDataKeyService } from "@app/domains/platform/kms-core/ce/module";
import { OrgPermissionSsoActions, OrgPermissionSubjects } from "@app/ee/services/permission/org-permission";
import { TPermissionServiceFactory } from "@app/ee/services/permission/permission-service-types";
import { DatabaseErrorCode } from "@app/lib/error-codes";
import { BadRequestError, DatabaseError, ForbiddenRequestError, NotFoundError } from "@app/lib/errors";
import { logger, sanitizeUrlForLog } from "@app/lib/logger";
import { isDisposableEmail, safeRequest, sanitizeEmail, validateEmail } from "@app/lib/validator";

import { TAuthTokenServiceFactory } from "../auth-token/auth-token-service";
import { TokenType } from "../auth-token/auth-token-types";
import { TAuthLoginFactory } from "../auth/auth-login-service";
import { AuthMethod } from "../auth/auth-type";
import { matchIdpMfaSignal } from "../auth/idp-mfa-signal";
import { TMembershipUserDALFactory } from "../membership-user/membership-user-dal";
import { TMembershipRoleDALFactory } from "../membership/membership-role-dal";
import { TOrgDALFactory } from "../org/org-dal";
import { getDefaultOrgMembershipRole } from "../org/org-role-fns";
import { SmtpTemplates, TSmtpService } from "../smtp/smtp-service";
import { TUserAliasDALFactory } from "../user-alias/user-alias-dal";
import { ensureSsoAccountVerified, isStaleSsoAlias } from "../user-alias/user-alias-fns";
import { UserAliasType } from "../user-alias/user-alias-types";
import { TUserDALFactory } from "../user/user-dal";
import { TOidcSsoDALFactory } from "./oidc-sso-dal";
import {
  buildAuthorizationUrl,
  createOidcLoginSecrets,
  extractIdentityClaims,
  isEmailDomainAllowed,
  isSameSecret,
  toDiscoveryDocumentUrl
} from "./oidc-sso-fns";
import {
  OidcSsoConfigurationType,
  OidcSsoSigningAlgorithm,
  TCompleteOidcSsoLoginDTO,
  TCreateOidcSsoConfigDTO,
  TGetOidcSsoConfigDTO,
  TOidcProviderMetadata,
  TOidcSsoLoginState,
  TStartOidcSsoLoginDTO,
  TUpdateOidcSsoConfigDTO
} from "./oidc-sso-types";

const STORED_SECRET_MASK = "********";
const IDP_REQUEST_TIMEOUT_MS = 10_000;

type TOidcSsoServiceFactoryDep = {
  oidcSsoDAL: TOidcSsoDALFactory;
  orgDAL: Pick<TOrgDALFactory, "findById" | "findOrgBySlug">;
  userDAL: Pick<TUserDALFactory, "findById" | "findOne" | "create" | "updateById" | "transaction">;
  userAliasDAL: Pick<TUserAliasDALFactory, "findOne" | "create" | "updateById">;
  membershipUserDAL: Pick<TMembershipUserDALFactory, "findOne" | "create">;
  membershipRoleDAL: Pick<TMembershipRoleDALFactory, "create">;
  permissionService: Pick<TPermissionServiceFactory, "getOrgPermission">;
  kmsDataKeyService: Pick<TKmsDataKeyService, "createCipherPairWithDataKey">;
  tokenService: Pick<TAuthTokenServiceFactory, "createTokenForUser">;
  smtpService: Pick<TSmtpService, "sendMail">;
  loginService: Pick<TAuthLoginFactory, "processProviderCallback">;
};

export type TOidcSsoServiceFactory = ReturnType<typeof oidcSsoServiceFactory>;

type TResolvedConfig = Omit<TOidcConfigs, "encryptedOidcClientId" | "encryptedOidcClientSecret"> & {
  clientId: string;
  clientSecret: string;
};

const describeIdpError = (err: unknown) => {
  const response = (err as { response?: { status?: number; data?: { error?: unknown; error_description?: unknown } } })
    ?.response;
  if (!response) return "it could not be reached";
  const code = typeof response.data?.error === "string" ? response.data.error : `HTTP ${response.status}`;
  const description =
    typeof response.data?.error_description === "string" ? `: ${response.data.error_description.slice(0, 300)}` : "";
  return `it answered ${code}${description}`;
};

export const oidcSsoServiceFactory = ({
  oidcSsoDAL,
  orgDAL,
  userDAL,
  userAliasDAL,
  membershipUserDAL,
  membershipRoleDAL,
  permissionService,
  kmsDataKeyService,
  tokenService,
  smtpService,
  loginService
}: TOidcSsoServiceFactoryDep) => {
  const assertCan = async (dto: TGetOidcSsoConfigDTO, action: OrgPermissionSsoActions) => {
    const { permission } = await permissionService.getOrgPermission({
      scope: OrganizationActionScope.Any,
      actor: dto.actor,
      actorId: dto.actorId,
      orgId: dto.organizationId,
      actorAuthMethod: dto.actorAuthMethod,
      actorOrgId: dto.actorOrgId
    });
    ForbiddenError.from(permission).throwUnlessCan(action, OrgPermissionSubjects.Sso);
  };

  const decryptConfig = async (config: TOidcConfigs): Promise<TResolvedConfig> => {
    const { decryptor } = await kmsDataKeyService.createCipherPairWithDataKey({
      type: KmsDataKey.Organization,
      orgId: config.orgId
    });
    const { encryptedOidcClientId, encryptedOidcClientSecret, ...rest } = config;
    return {
      ...rest,
      clientId: encryptedOidcClientId ? decryptor({ cipherTextBlob: encryptedOidcClientId }).toString() : "",
      clientSecret: encryptedOidcClientSecret ? decryptor({ cipherTextBlob: encryptedOidcClientSecret }).toString() : ""
    };
  };

  const toResponse = (config: TResolvedConfig) => ({
    id: config.id,
    orgId: config.orgId,
    isActive: config.isActive,
    configurationType: config.configurationType,
    discoveryURL: config.discoveryURL ?? "",
    issuer: config.issuer ?? "",
    authorizationEndpoint: config.authorizationEndpoint ?? "",
    tokenEndpoint: config.tokenEndpoint ?? "",
    jwksUri: config.jwksUri ?? "",
    userinfoEndpoint: config.userinfoEndpoint ?? "",
    allowedEmailDomains: config.allowedEmailDomains ?? "",
    clientId: config.clientId,
    // The UI only needs to know a secret is stored; the secret itself never leaves the server.
    clientSecret: config.clientSecret ? STORED_SECRET_MASK : "",
    jwtSignatureAlgorithm: config.jwtSignatureAlgorithm,
    mfaClaimName: config.mfaClaimName,
    mfaAmrValues: config.mfaAmrValues ?? null,
    manageGroupMemberships: false,
    lastUsed: config.lastUsed ?? null
  });

  const assertRootOrg = async (orgId: string) => {
    const org = await orgDAL.findById(orgId);
    if (!org) throw new NotFoundError({ message: `Organization with ID '${orgId}' not found` });
    if (org.rootOrgId) {
      throw new BadRequestError({
        message: "OIDC SSO is configured on the root organization. Configure it there instead of on a sub-organization."
      });
    }
    return org;
  };

  const assertConfigComplete = (config: {
    isActive: boolean;
    configurationType: string;
    discoveryURL?: string | null;
    issuer?: string | null;
    authorizationEndpoint?: string | null;
    tokenEndpoint?: string | null;
    jwksUri?: string | null;
    clientId: string;
    clientSecret: string;
  }) => {
    if (!config.isActive) return;
    if (!config.clientId || !config.clientSecret) {
      throw new BadRequestError({ message: "A client ID and client secret are required to enable OIDC SSO." });
    }
    if (config.configurationType === OidcSsoConfigurationType.Discovery) {
      if (!config.discoveryURL)
        throw new BadRequestError({ message: "A discovery URL is required to enable OIDC SSO." });
      return;
    }
    const missing = (["issuer", "authorizationEndpoint", "tokenEndpoint", "jwksUri"] as const).filter(
      (field) => !config[field]
    );
    if (missing.length) {
      throw new BadRequestError({
        message: `A custom OIDC configuration needs these fields to be enabled: ${missing.join(", ")}.`
      });
    }
  };

  const getConfig = async (dto: TGetOidcSsoConfigDTO) => {
    await assertCan(dto, OrgPermissionSsoActions.Read);
    const config = await oidcSsoDAL.findOne({ orgId: dto.organizationId });
    if (!config) {
      throw new NotFoundError({ message: `No OIDC configuration found for organization '${dto.organizationId}'` });
    }
    return toResponse(await decryptConfig(config));
  };

  const createConfig = async (dto: TCreateOidcSsoConfigDTO) => {
    await assertCan(dto, OrgPermissionSsoActions.Create);
    await assertRootOrg(dto.organizationId);

    const existing = await oidcSsoDAL.findOne({ orgId: dto.organizationId });
    if (existing) {
      throw new BadRequestError({
        message: "This organization already has an OIDC configuration. Update it instead of creating a new one."
      });
    }

    assertConfigComplete(dto);

    const { encryptor } = await kmsDataKeyService.createCipherPairWithDataKey({
      type: KmsDataKey.Organization,
      orgId: dto.organizationId
    });

    const created = await oidcSsoDAL.create({
      orgId: dto.organizationId,
      isActive: dto.isActive,
      configurationType: dto.configurationType,
      discoveryURL: dto.discoveryURL || null,
      issuer: dto.issuer || null,
      authorizationEndpoint: dto.authorizationEndpoint || null,
      tokenEndpoint: dto.tokenEndpoint || null,
      jwksUri: dto.jwksUri || null,
      userinfoEndpoint: dto.userinfoEndpoint || null,
      allowedEmailDomains: dto.allowedEmailDomains || null,
      jwtSignatureAlgorithm: dto.jwtSignatureAlgorithm,
      mfaClaimName: dto.mfaClaimName || "amr",
      mfaAmrValues: dto.mfaAmrValues?.length ? dto.mfaAmrValues : null,
      manageGroupMemberships: false,
      encryptedOidcClientId: encryptor({ plainText: Buffer.from(dto.clientId) }).cipherTextBlob,
      encryptedOidcClientSecret: encryptor({ plainText: Buffer.from(dto.clientSecret) }).cipherTextBlob
    });

    return toResponse(await decryptConfig(created));
  };

  const updateConfig = async (dto: TUpdateOidcSsoConfigDTO) => {
    await assertCan(dto, OrgPermissionSsoActions.Edit);
    await assertRootOrg(dto.organizationId);

    const existingRow = await oidcSsoDAL.findOne({ orgId: dto.organizationId });
    if (!existingRow) {
      throw new NotFoundError({ message: `No OIDC configuration found for organization '${dto.organizationId}'` });
    }
    const existing = await decryptConfig(existingRow);

    const clientId = dto.clientId ?? existing.clientId;
    // A blank secret on update means "keep the stored one", except when the whole configuration is
    // being cleared (the UI's delete sends every field blank).
    const isClearing = dto.clientId === "" && dto.isActive === false;
    const clientSecret = dto.clientSecret || (isClearing ? "" : existing.clientSecret);

    const merged = {
      isActive: dto.isActive ?? existing.isActive,
      configurationType: dto.configurationType ?? existing.configurationType,
      discoveryURL: dto.discoveryURL ?? existing.discoveryURL,
      issuer: dto.issuer ?? existing.issuer,
      authorizationEndpoint: dto.authorizationEndpoint ?? existing.authorizationEndpoint,
      tokenEndpoint: dto.tokenEndpoint ?? existing.tokenEndpoint,
      jwksUri: dto.jwksUri ?? existing.jwksUri,
      userinfoEndpoint: dto.userinfoEndpoint ?? existing.userinfoEndpoint,
      allowedEmailDomains: dto.allowedEmailDomains ?? existing.allowedEmailDomains,
      jwtSignatureAlgorithm: dto.jwtSignatureAlgorithm ?? existing.jwtSignatureAlgorithm,
      mfaClaimName: dto.mfaClaimName || existing.mfaClaimName,
      mfaAmrValues: dto.mfaAmrValues === undefined ? existing.mfaAmrValues : dto.mfaAmrValues,
      clientId,
      clientSecret
    };
    assertConfigComplete(merged);

    const { encryptor } = await kmsDataKeyService.createCipherPairWithDataKey({
      type: KmsDataKey.Organization,
      orgId: dto.organizationId
    });

    const { clientId: mergedClientId, clientSecret: mergedClientSecret, ...columns } = merged;
    const updated = await oidcSsoDAL.updateById(existing.id, {
      ...columns,
      discoveryURL: columns.discoveryURL || null,
      issuer: columns.issuer || null,
      authorizationEndpoint: columns.authorizationEndpoint || null,
      tokenEndpoint: columns.tokenEndpoint || null,
      jwksUri: columns.jwksUri || null,
      userinfoEndpoint: columns.userinfoEndpoint || null,
      allowedEmailDomains: columns.allowedEmailDomains || null,
      mfaAmrValues: columns.mfaAmrValues?.length ? columns.mfaAmrValues : null,
      manageGroupMemberships: false,
      encryptedOidcClientId: encryptor({ plainText: Buffer.from(mergedClientId) }).cipherTextBlob,
      encryptedOidcClientSecret: encryptor({ plainText: Buffer.from(mergedClientSecret) }).cipherTextBlob
    });

    return toResponse(await decryptConfig(updated));
  };

  const resolveProviderMetadata = async (config: TResolvedConfig): Promise<TOidcProviderMetadata> => {
    if (config.configurationType !== OidcSsoConfigurationType.Discovery) {
      return {
        issuer: config.issuer as string,
        authorizationEndpoint: config.authorizationEndpoint as string,
        tokenEndpoint: config.tokenEndpoint as string,
        jwksUri: config.jwksUri as string,
        userinfoEndpoint: config.userinfoEndpoint || undefined
      };
    }

    const discoveryUrl = toDiscoveryDocumentUrl(config.discoveryURL as string);
    let doc: Record<string, unknown>;
    try {
      ({ data: doc } = await safeRequest.get<Record<string, unknown>>(discoveryUrl, {
        timeout: IDP_REQUEST_TIMEOUT_MS
      }));
    } catch (err) {
      logger.warn(err, `OIDC SSO: discovery failed for org ${config.orgId} [url=${sanitizeUrlForLog(discoveryUrl)}]`);
      throw new BadRequestError({
        message: `Could not load the OIDC discovery document from your identity provider: ${describeIdpError(err)}. Check the discovery URL in Organization Settings > SSO.`
      });
    }

    const field = (name: string) => (typeof doc[name] === "string" ? (doc[name] as string) : "");
    const metadata = {
      issuer: field("issuer"),
      authorizationEndpoint: field("authorization_endpoint"),
      tokenEndpoint: field("token_endpoint"),
      jwksUri: field("jwks_uri"),
      userinfoEndpoint: field("userinfo_endpoint") || undefined
    };
    if (!metadata.issuer || !metadata.authorizationEndpoint || !metadata.tokenEndpoint || !metadata.jwksUri) {
      throw new BadRequestError({
        message:
          "The OIDC discovery document from your identity provider is missing issuer, authorization_endpoint, token_endpoint or jwks_uri."
      });
    }
    return metadata;
  };

  const findActiveConfigForOrg = async (orgId: string) => {
    const config = await oidcSsoDAL.findOne({ orgId });
    if (!config || !config.isActive) {
      throw new BadRequestError({ message: "OIDC SSO is not enabled for this organization." });
    }
    return decryptConfig(config);
  };

  const startLogin = async ({ orgSlug, redirectUri }: TStartOidcSsoLoginDTO) => {
    const org = await orgDAL.findOrgBySlug(orgSlug);
    if (!org) throw new NotFoundError({ message: `Organization with slug '${orgSlug}' not found` });

    const config = await findActiveConfigForOrg(org.id);
    const metadata = await resolveProviderMetadata(config);
    const { state, nonce, codeVerifier, codeChallenge } = createOidcLoginSecrets();

    return {
      authorizationUrl: buildAuthorizationUrl({
        authorizationEndpoint: metadata.authorizationEndpoint,
        clientId: config.clientId,
        redirectUri,
        state,
        nonce,
        codeChallenge
      }),
      loginState: { orgId: org.id, state, nonce, codeVerifier, redirectUri } satisfies TOidcSsoLoginState
    };
  };

  const exchangeCode = async (
    config: TResolvedConfig,
    metadata: TOidcProviderMetadata,
    { code, loginState }: Pick<TCompleteOidcSsoLoginDTO, "code" | "loginState">
  ) => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: loginState.redirectUri,
      code_verifier: loginState.codeVerifier,
      client_id: config.clientId
    });
    // client_secret_basic is the one client authentication method every OIDC provider must support.
    const basic = Buffer.from(
      `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`
    ).toString("base64");

    try {
      const { data } = await safeRequest.post<{ id_token?: string; access_token?: string }>(
        metadata.tokenEndpoint,
        body.toString(),
        {
          timeout: IDP_REQUEST_TIMEOUT_MS,
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
          }
        }
      );
      return data;
    } catch (err) {
      logger.warn(err, `OIDC SSO: token exchange failed for org ${config.orgId}`);
      throw new BadRequestError({
        message: `Your identity provider refused to complete the sign-in: ${describeIdpError(err)}. Check the client ID, client secret and redirect URI configured for Infisical.`
      });
    }
  };

  const verifyIdToken = async (
    idToken: string,
    config: TResolvedConfig,
    metadata: TOidcProviderMetadata,
    expectedNonce: string
  ) => {
    const algorithm = config.jwtSignatureAlgorithm as OidcSsoSigningAlgorithm;
    let payload: JWTPayload;
    try {
      if (algorithm === OidcSsoSigningAlgorithm.HS256) {
        ({ payload } = await jwtVerify(idToken, new TextEncoder().encode(config.clientSecret), {
          issuer: metadata.issuer,
          audience: config.clientId,
          algorithms: [algorithm],
          clockTolerance: 60
        }));
      } else {
        const { data: jwks } = await safeRequest.get<{ keys: unknown[] }>(metadata.jwksUri, {
          timeout: IDP_REQUEST_TIMEOUT_MS
        });
        ({ payload } = await jwtVerify(idToken, createLocalJWKSet(jwks as Parameters<typeof createLocalJWKSet>[0]), {
          issuer: metadata.issuer,
          audience: config.clientId,
          algorithms: [algorithm],
          clockTolerance: 60
        }));
      }
    } catch (err) {
      logger.warn(err, `OIDC SSO: ID token rejected for org ${config.orgId}`);
      let reason = "its signature could not be verified";
      if (err instanceof joseErrors.JWTClaimValidationFailed) {
        reason = `its '${err.claim}' claim did not match the configuration`;
      } else if (err instanceof joseErrors.JOSEAlgNotAllowed) {
        reason = `it was not signed with ${algorithm}, the algorithm configured for this organization`;
      }
      throw new BadRequestError({ message: `The ID token from your identity provider was rejected: ${reason}.` });
    }

    if (typeof payload.nonce !== "string" || !isSameSecret(expectedNonce, payload.nonce)) {
      throw new BadRequestError({
        message: "The sign-in response did not match this login attempt. Start the sign-in again."
      });
    }
    // OIDC Core 3.1.3.7: with several audiences the token must name us as its authorized party.
    if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId) {
      throw new BadRequestError({ message: "The ID token from your identity provider was issued to another client." });
    }
    return payload as Record<string, unknown>;
  };

  const fetchUserinfo = async (accessToken: string | undefined, metadata: TOidcProviderMetadata, sub: string) => {
    if (!accessToken || !metadata.userinfoEndpoint) return {};
    try {
      const { data } = await safeRequest.get<Record<string, unknown>>(metadata.userinfoEndpoint, {
        timeout: IDP_REQUEST_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
      });
      // OIDC Core 5.3.2: userinfo for another subject must not be used.
      return data && data.sub === sub ? data : {};
    } catch (err) {
      logger.warn(err, "OIDC SSO: userinfo request failed; continuing with ID token claims");
      return {};
    }
  };

  const provisionUser = async ({
    orgId,
    defaultMembershipRole,
    sub,
    email,
    isEmailVerifiedByIdp,
    firstName,
    lastName
  }: {
    orgId: string;
    defaultMembershipRole: string;
    sub: string;
    email: string;
    isEmailVerifiedByIdp: boolean;
    firstName: string;
    lastName: string;
  }) => {
    let userAlias = await userAliasDAL.findOne({ externalId: sub, orgId, aliasType: UserAliasType.OIDC });
    let user: TUsers | undefined;
    if (userAlias) {
      user = await userDAL.findById(userAlias.userId);
      if (!user) throw new NotFoundError({ message: "The account linked to this SSO identity no longer exists." });
    } else {
      try {
        ({ user, userAlias } = await userDAL.transaction(async (tx) => {
          const existingUser = await userDAL.findOne({ username: email }, tx);
          if (existingUser?.isGhost) {
            throw new BadRequestError({ message: "This email belongs to a system account and cannot sign in." });
          }
          if (!existingUser && isDisposableEmail(email)) {
            throw new BadRequestError({
              message: `Email address '${email}' is from a disposable email provider. Use an account with a different email address.`
            });
          }

          const accountUser =
            existingUser ??
            (await userDAL.create(
              {
                username: email,
                email,
                firstName,
                lastName,
                isEmailVerified: isEmailVerifiedByIdp,
                isAccepted: isEmailVerifiedByIdp,
                authMethods: [AuthMethod.OIDC],
                isGhost: false
              },
              tx
            ));

          // Linking to an account that already exists must be proven by its mailbox, not by the IdP:
          // any org admin controls their own IdP and could otherwise assert someone else's address.
          const alias = await userAliasDAL.create(
            {
              userId: accountUser.id,
              aliasType: UserAliasType.OIDC,
              externalId: sub,
              emails: [email],
              orgId,
              isEmailVerified: !existingUser && isEmailVerifiedByIdp
            },
            tx
          );
          return { user: accountUser, userAlias: alias };
        }));
      } catch (err) {
        if (
          err instanceof DatabaseError &&
          (err.error as { code?: string })?.code === DatabaseErrorCode.UniqueViolation
        ) {
          throw new BadRequestError({
            message: "Another sign-in for this account is in progress. Try again in a moment."
          });
        }
        throw err;
      }
    }

    const isStale = isStaleSsoAlias({ user, userAlias, assertedEmail: email });

    const membership = await membershipUserDAL.findOne({
      actorUserId: user.id,
      scopeOrgId: orgId,
      scope: AccessScope.Organization
    });
    if (membership && !membership.isActive) {
      throw new ForbiddenRequestError({ message: "Your membership in this organization has been deactivated." });
    }
    if (!membership && !isStale) {
      const { role, roleId } = await getDefaultOrgMembershipRole(defaultMembershipRole);
      const accountUser = user;
      await userDAL.transaction(async (tx) => {
        // Invited, not accepted: processProviderCallback accepts it only when it issues a session.
        const created = await membershipUserDAL.create(
          {
            actorUserId: accountUser.id,
            inviteEmail: email,
            scopeOrgId: orgId,
            scope: AccessScope.Organization,
            status: OrgMembershipStatus.Invited,
            isActive: true
          },
          tx
        );
        await membershipRoleDAL.create({ membershipId: created.id, role, customRoleId: roleId }, tx);
      });
    }

    if (userAlias.isEmailVerified) {
      ({ user, userAlias } = await ensureSsoAccountVerified({
        user,
        userAlias,
        assertedEmail: email,
        userDAL,
        userAliasDAL
      }));
      if (!user.authMethods?.includes(AuthMethod.OIDC) || (!user.firstName && firstName)) {
        user = await userDAL.updateById(user.id, {
          authMethods: Array.from(new Set([...(user.authMethods ?? []), AuthMethod.OIDC])),
          ...(!user.firstName && firstName ? { firstName, lastName } : {})
        });
      }
    } else if (user.email) {
      const code = await tokenService.createTokenForUser({
        type: TokenType.TOKEN_EMAIL_VERIFICATION,
        userId: user.id,
        aliasId: userAlias.id
      });
      await smtpService.sendMail({
        template: SmtpTemplates.EmailVerification,
        subjectLine: `Infisical confirmation code: ${code}`,
        recipients: [user.email],
        substitutions: { code }
      });
    }

    return { user, userAlias };
  };

  const completeLogin = async ({ code, returnedState, loginState, ip, userAgent }: TCompleteOidcSsoLoginDTO) => {
    if (!isSameSecret(loginState.state, returnedState)) {
      throw new BadRequestError({
        message: "The sign-in response did not match this login attempt. Start the sign-in again."
      });
    }

    const org = await orgDAL.findById(loginState.orgId);
    if (!org) throw new NotFoundError({ message: "The organization for this sign-in no longer exists." });

    const config = await findActiveConfigForOrg(org.id);
    const metadata = await resolveProviderMetadata(config);
    const tokens = await exchangeCode(config, metadata, { code, loginState });
    if (!tokens.id_token) {
      throw new BadRequestError({
        message:
          "Your identity provider did not return an ID token. Make sure the 'openid' scope is allowed for Infisical."
      });
    }

    const idTokenClaims = await verifyIdToken(tokens.id_token, config, metadata, loginState.nonce);
    const sub = typeof idTokenClaims.sub === "string" ? idTokenClaims.sub : "";
    if (!sub) throw new BadRequestError({ message: "The ID token from your identity provider has no 'sub' claim." });

    const hasProfileInIdToken = typeof idTokenClaims.email === "string";
    const userinfo = hasProfileInIdToken ? {} : await fetchUserinfo(tokens.access_token, metadata, sub);
    const claims = extractIdentityClaims(idTokenClaims, userinfo);
    if (!claims.email) {
      throw new BadRequestError({
        message: "Your identity provider did not share an email address. Allow the 'email' scope for Infisical."
      });
    }

    const email = sanitizeEmail(claims.email);
    validateEmail(email);
    if (!isEmailDomainAllowed(email, config.allowedEmailDomains)) {
      throw new ForbiddenRequestError({
        message: `Sign-in with '${email.split("@")[1]}' email addresses is not allowed for this organization.`
      });
    }

    const wasAcceptedBefore = Boolean((await userDAL.findOne({ username: email }))?.isAccepted);
    const { user, userAlias } = await provisionUser({
      orgId: org.id,
      defaultMembershipRole: org.defaultMembershipRole,
      sub,
      email,
      isEmailVerifiedByIdp: claims.isEmailVerified,
      firstName: claims.firstName,
      lastName: claims.lastName
    });

    const result = await loginService.processProviderCallback({
      user,
      authMethod: AuthMethod.OIDC,
      isEmailVerified: Boolean(userAlias.isEmailVerified),
      aliasId: userAlias.id,
      ip,
      userAgent,
      organizationId: org.id,
      callbackPort: loginState.callbackPort ? Number(loginState.callbackPort) : undefined,
      idpMfa: matchIdpMfaSignal({
        kind: "oidc",
        claims: idTokenClaims,
        config: { mfaClaimName: config.mfaClaimName, mfaAmrValues: config.mfaAmrValues }
      })
    });

    await oidcSsoDAL.updateById(config.id, { lastUsed: new Date() });

    return {
      ...result,
      user: { ...user, hashedPassword: null },
      didCompleteSignup: !wasAcceptedBefore && Boolean(user.isAccepted),
      wasInvited: false,
      authMethod: AuthMethod.OIDC,
      orgId: org.id
    };
  };

  return { getConfig, createConfig, updateConfig, startLogin, completeLogin };
};
