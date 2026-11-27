import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getConfig } from "@app/lib/config/env";
import { BadRequestError } from "@app/lib/errors";
import { authRateLimit, readLimit, writeLimit } from "@app/server/config/rateLimiter";
import { verifyAuth } from "@app/server/plugins/auth/verify-auth";
import { AuthMode } from "@app/services/auth/auth-type";
import { createOidcSsoAuditLog, OidcSsoAuditEventType } from "@app/services/oidc-sso/oidc-sso-audit";
import { buildOidcSsoRedirectUri } from "@app/services/oidc-sso/oidc-sso-fns";
import {
  OidcSsoConfigurationType,
  OidcSsoSigningAlgorithm,
  TOidcSsoLoginState
} from "@app/services/oidc-sso/oidc-sso-types";

export const OIDC_SSO_ROUTE_PREFIX = "/community-oidc";
const LOGIN_STATE_SESSION_KEY = "communityOidcLoginState";

type TRegisterOidcSsoRouterOptions = {
  // The SSO router's shared redirect: sets the refresh cookie for a session, or sends the user to finish signup.
  handleLoginResult: (req: FastifyRequest, res: FastifyReply) => Promise<unknown>;
};

const endpointSchema = z.string().trim().url().max(2048);
const optionalEndpointSchema = z.union([endpointSchema, z.literal("")]).optional();

const ConfigInputSchema = z.object({
  configurationType: z.nativeEnum(OidcSsoConfigurationType),
  discoveryURL: optionalEndpointSchema,
  issuer: z.string().trim().max(2048).optional(),
  authorizationEndpoint: optionalEndpointSchema,
  tokenEndpoint: optionalEndpointSchema,
  jwksUri: optionalEndpointSchema,
  userinfoEndpoint: optionalEndpointSchema,
  clientId: z.string().trim().max(1024),
  clientSecret: z.string().trim().max(4096),
  allowedEmailDomains: z
    .string()
    .trim()
    .max(4096)
    .regex(
      /^[a-zA-Z0-9.,@*\s-]*$/,
      "Allowed email domains must be a comma-separated list of domains, such as 'example.com, *.example.com'"
    )
    .optional(),
  isActive: z.boolean(),
  jwtSignatureAlgorithm: z.nativeEnum(OidcSsoSigningAlgorithm).default(OidcSsoSigningAlgorithm.RS256),
  mfaClaimName: z.string().trim().min(1).max(128).optional(),
  mfaAmrValues: z.array(z.string().trim().min(1).max(64)).max(20).nullable().optional(),
  // Group membership sync is not part of the community implementation; accepted only so the
  // existing settings UI can keep sending it.
  manageGroupMemberships: z.literal(false).optional()
});

const ConfigResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  isActive: z.boolean(),
  configurationType: z.string(),
  discoveryURL: z.string(),
  issuer: z.string(),
  authorizationEndpoint: z.string(),
  tokenEndpoint: z.string(),
  jwksUri: z.string(),
  userinfoEndpoint: z.string(),
  allowedEmailDomains: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  jwtSignatureAlgorithm: z.string(),
  mfaClaimName: z.string(),
  mfaAmrValues: z.string().array().nullable(),
  manageGroupMemberships: z.boolean(),
  lastUsed: z.date().nullable(),
  redirectUri: z.string()
});

const toConfigAuditMetadata = (config: z.infer<typeof ConfigResponseSchema>) => ({
  oidcConfigId: config.id,
  isActive: config.isActive,
  configurationType: config.configurationType,
  discoveryURL: config.discoveryURL,
  issuer: config.issuer,
  allowedEmailDomains: config.allowedEmailDomains,
  jwtSignatureAlgorithm: config.jwtSignatureAlgorithm
});

export const registerOidcSsoRouter = async (server: FastifyZodProvider, opts: TRegisterOidcSsoRouterOptions) => {
  const appCfg = getConfig();
  const redirectUri = buildOidcSsoRedirectUri(appCfg.SITE_URL);

  server.route({
    method: "GET",
    url: "/login",
    config: { rateLimit: authRateLimit },
    schema: {
      hide: true,
      operationId: "startCommunityOidcLogin",
      querystring: z.object({
        orgSlug: z.string().trim().min(1).max(64).optional(),
        domain: z.string().trim().max(255).optional(),
        callbackPort: z
          .string()
          .trim()
          .regex(/^\d{1,5}$/)
          .optional()
      })
    },
    handler: async (req, res) => {
      if (!req.query.orgSlug) {
        throw new BadRequestError({
          message:
            "Sign in with your organization's slug. Finding the organization from an email domain is not supported."
        });
      }
      const { authorizationUrl, loginState } = await server.services.oidcSso.startLogin({
        orgSlug: req.query.orgSlug,
        redirectUri
      });
      await req.session.regenerate();
      req.session.set(LOGIN_STATE_SESSION_KEY, {
        ...loginState,
        callbackPort: req.query.callbackPort
      } satisfies TOidcSsoLoginState);
      return res.redirect(authorizationUrl);
    }
  });

  server.route({
    method: "GET",
    url: "/callback",
    config: { rateLimit: authRateLimit },
    schema: {
      hide: true,
      operationId: "communityOidcLoginCallback",
      querystring: z.object({
        code: z.string().trim().max(4096).optional(),
        state: z.string().trim().max(512).optional(),
        error: z.string().trim().max(256).optional(),
        error_description: z.string().trim().max(1024).optional()
      })
    },
    handler: async (req, res) => {
      const loginState = req.session.get(LOGIN_STATE_SESSION_KEY) as TOidcSsoLoginState | undefined;
      req.session.set(LOGIN_STATE_SESSION_KEY, undefined);

      if (req.query.error) {
        throw new BadRequestError({
          message: `Your identity provider ended the sign-in: ${req.query.error}${
            req.query.error_description ? ` (${req.query.error_description})` : ""
          }.`
        });
      }
      if (!loginState) {
        throw new BadRequestError({
          message: "This sign-in has expired or was started in another browser. Start it again."
        });
      }
      if (!req.query.code || !req.query.state) {
        throw new BadRequestError({
          message: "The sign-in response from your identity provider is missing its code or state."
        });
      }

      const result = await server.services.oidcSso.completeLogin({
        code: req.query.code,
        returnedState: req.query.state,
        loginState,
        ip: req.realIp,
        userAgent: req.headers["user-agent"] ?? ""
      });

      (req as FastifyRequest & { passportUser: unknown }).passportUser = result;
      return opts.handleLoginResult(req, res);
    }
  });

  server.route({
    method: "GET",
    url: "/config",
    config: { rateLimit: readLimit },
    onRequest: verifyAuth([AuthMode.JWT]),
    schema: {
      operationId: "getCommunityOidcConfig",
      querystring: z.object({ organizationId: z.string().trim().uuid() }),
      response: { 200: ConfigResponseSchema }
    },
    handler: async (req) =>
      server.services.oidcSso.getConfig({
        organizationId: req.query.organizationId,
        actor: req.permission.type,
        actorId: req.permission.id,
        actorAuthMethod: req.permission.authMethod,
        actorOrgId: req.permission.orgId
      })
  });

  server.route({
    method: "POST",
    url: "/config",
    config: { rateLimit: writeLimit },
    onRequest: verifyAuth([AuthMode.JWT]),
    schema: {
      operationId: "createCommunityOidcConfig",
      body: ConfigInputSchema.extend({ organizationId: z.string().trim().uuid() }),
      response: { 200: ConfigResponseSchema }
    },
    handler: async (req) => {
      const config = await server.services.oidcSso.createConfig({
        ...req.body,
        actor: req.permission.type,
        actorId: req.permission.id,
        actorAuthMethod: req.permission.authMethod,
        actorOrgId: req.permission.orgId
      });
      await createOidcSsoAuditLog(server.services.auditLog, {
        ...req.auditLogInfo,
        orgId: config.orgId,
        event: { type: OidcSsoAuditEventType.CreateConfig, metadata: toConfigAuditMetadata(config) }
      });
      return config;
    }
  });

  server.route({
    method: "PATCH",
    url: "/config",
    config: { rateLimit: writeLimit },
    onRequest: verifyAuth([AuthMode.JWT]),
    schema: {
      operationId: "updateCommunityOidcConfig",
      body: ConfigInputSchema.partial().extend({ organizationId: z.string().trim().uuid() }),
      response: { 200: ConfigResponseSchema }
    },
    handler: async (req) => {
      const { config, changedFields, isClientIdChanged, isClientSecretChanged } =
        await server.services.oidcSso.updateConfig({
          ...req.body,
          actor: req.permission.type,
          actorId: req.permission.id,
          actorAuthMethod: req.permission.authMethod,
          actorOrgId: req.permission.orgId
        });
      await createOidcSsoAuditLog(server.services.auditLog, {
        ...req.auditLogInfo,
        orgId: config.orgId,
        event: {
          type: OidcSsoAuditEventType.UpdateConfig,
          metadata: { ...toConfigAuditMetadata(config), changedFields, isClientIdChanged, isClientSecretChanged }
        }
      });
      return config;
    }
  });

  server.route({
    method: "GET",
    url: "/manage-group-memberships",
    config: { rateLimit: readLimit },
    onRequest: verifyAuth([AuthMode.JWT]),
    schema: {
      operationId: "getCommunityOidcManageGroupMemberships",
      querystring: z.object({ orgId: z.string().trim().uuid() }),
      response: { 200: z.object({ isEnabled: z.boolean() }) }
    },
    handler: async () => ({ isEnabled: false })
  });
};
