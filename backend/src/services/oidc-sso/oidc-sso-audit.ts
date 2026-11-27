import { Event, TAuditLogServiceFactory, TCreateAuditLogDTO } from "@app/ee/services/audit-log/audit-log-types";
import { logger } from "@app/lib/logger";

// Declared here rather than in ee/services/audit-log/audit-log-types.ts so this module never modifies
// Enterprise-licensed files. Types the ee enum does not know are classed as Management, which is
// always recorded.
export enum OidcSsoAuditEventType {
  CreateConfig = "create-oidc-sso-config",
  UpdateConfig = "update-oidc-sso-config",
  LoginFailed = "oidc-sso-login-failed",
  MemberProvisioned = "oidc-sso-member-provisioned",
  AccountLinkPending = "oidc-sso-account-link-pending"
}

type TOidcSsoConfigAuditMetadata = {
  oidcConfigId: string;
  isActive: boolean;
  configurationType: string;
  discoveryURL: string;
  issuer: string;
  allowedEmailDomains: string;
  jwtSignatureAlgorithm: string;
};

export type TOidcSsoAuditEvent =
  | { type: OidcSsoAuditEventType.CreateConfig; metadata: TOidcSsoConfigAuditMetadata }
  | {
      type: OidcSsoAuditEventType.UpdateConfig;
      metadata: TOidcSsoConfigAuditMetadata & {
        changedFields: string[];
        isClientIdChanged: boolean;
        isClientSecretChanged: boolean;
      };
    }
  | {
      type: OidcSsoAuditEventType.LoginFailed;
      metadata: { organizationId: string; reason: string; email?: string; idpSubject?: string };
    }
  | {
      type: OidcSsoAuditEventType.MemberProvisioned;
      metadata: { organizationId: string; userId: string; email: string; role: string; isNewAccount: boolean };
    }
  | {
      type: OidcSsoAuditEventType.AccountLinkPending;
      metadata: { organizationId: string; userId: string; email: string; userAliasId: string };
    };

export type TOidcSsoAuditLogDTO = Omit<TCreateAuditLogDTO, "event"> & { event: TOidcSsoAuditEvent };

export const createOidcSsoAuditLog = (
  auditLogService: Pick<TAuditLogServiceFactory, "createAuditLog">,
  dto: TOidcSsoAuditLogDTO
) => auditLogService.createAuditLog({ ...dto, event: dto.event as unknown as Event });

// For the sign-in path: a lost audit entry must never turn into a failed login.
export const createOidcSsoAuditLogSafely = async (
  auditLogService: Pick<TAuditLogServiceFactory, "createAuditLog">,
  dto: TOidcSsoAuditLogDTO
) => {
  try {
    await createOidcSsoAuditLog(auditLogService, dto);
  } catch (err) {
    logger.error(err, `OIDC SSO: failed to record audit event [event=${dto.event.type}] [orgId=${dto.orgId}]`);
  }
};
