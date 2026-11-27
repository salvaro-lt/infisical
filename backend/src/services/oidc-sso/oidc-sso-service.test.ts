import { describe, expect, test, vi } from "vitest";

import { BadRequestError } from "@app/lib/errors";

import { OidcSsoAuditEventType } from "./oidc-sso-audit";
import { oidcSsoServiceFactory } from "./oidc-sso-service";

vi.mock("@app/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  sanitizeUrlForLog: (url: string) => url
}));

const buildService = (overrides: { createAuditLog?: ReturnType<typeof vi.fn> } = {}) => {
  const createAuditLog = overrides.createAuditLog ?? vi.fn().mockResolvedValue(undefined);
  const deps = {
    oidcSsoDAL: { findOne: vi.fn(), create: vi.fn(), updateById: vi.fn() },
    orgDAL: { findById: vi.fn().mockResolvedValue({ id: "org-1" }), findOrgBySlug: vi.fn() },
    userDAL: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn(), updateById: vi.fn(), transaction: vi.fn() },
    userAliasDAL: { findOne: vi.fn(), create: vi.fn(), updateById: vi.fn() },
    membershipUserDAL: { findOne: vi.fn(), create: vi.fn() },
    membershipRoleDAL: { create: vi.fn() },
    permissionService: { getOrgPermission: vi.fn() },
    kmsDataKeyService: { createCipherPairWithDataKey: vi.fn() },
    tokenService: { createTokenForUser: vi.fn() },
    smtpService: { sendMail: vi.fn() },
    loginService: { processProviderCallback: vi.fn() },
    auditLogService: { createAuditLog }
  };
  return { service: oidcSsoServiceFactory(deps as unknown as Parameters<typeof oidcSsoServiceFactory>[0]), deps };
};

const loginDTO = {
  code: "code",
  returnedState: "forged-state",
  loginState: {
    orgId: "org-1",
    state: "expected-state",
    nonce: "nonce",
    codeVerifier: "verifier",
    redirectUri: "https://app.example.com/api/v1/sso/community-oidc/callback"
  },
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0"
};

describe("completeLogin audit trail", () => {
  test("records a failed sign-in with the reason the user saw", async () => {
    const { service, deps } = buildService();

    await expect(service.completeLogin(loginDTO)).rejects.toBeInstanceOf(BadRequestError);

    expect(deps.auditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    const entry: unknown = deps.auditLogService.createAuditLog.mock.calls[0][0];
    expect(entry).toMatchObject({
      orgId: "org-1",
      ipAddress: "203.0.113.7",
      actor: { type: "unknownUser" },
      event: {
        type: OidcSsoAuditEventType.LoginFailed,
        metadata: {
          organizationId: "org-1",
          reason: "The sign-in response did not match this login attempt. Start the sign-in again."
        }
      }
    });
    expect(deps.oidcSsoDAL.findOne).not.toHaveBeenCalled();
  });

  test("still surfaces the login error when the audit log cannot be written", async () => {
    const { service } = buildService({ createAuditLog: vi.fn().mockRejectedValue(new Error("queue down")) });

    await expect(service.completeLogin(loginDTO)).rejects.toThrow("did not match this login attempt");
  });

  test("records nothing when the organization no longer exists", async () => {
    const { service, deps } = buildService();
    deps.orgDAL.findById.mockResolvedValue(undefined);

    await expect(service.completeLogin(loginDTO)).rejects.toBeInstanceOf(BadRequestError);
    expect(deps.auditLogService.createAuditLog).not.toHaveBeenCalled();
  });
});
