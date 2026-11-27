import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { twMerge } from "tailwind-merge";

import { createNotification } from "@app/components/notifications";
import { OrgPermissionCan } from "@app/components/permissions";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
  Toggle
} from "@app/components/v3";
import {
  OrgPermissionActions,
  OrgPermissionSubjects,
  useOrganization,
  useSubscription
} from "@app/context";
import { useLogoutUser, useUpdateOrg } from "@app/hooks/api";
import { usePopUp } from "@app/hooks/usePopUp";

import { SsoMfaTrustField } from "./SsoMfaTrustField";

enum EnforceAuthType {
  SAML = "saml",
  GOOGLE = "google",
  OIDC = "oidc"
}

export const OrgGeneralAuthSection = ({
  isSamlConfigured,
  isOidcConfigured,
  isGoogleConfigured,
  isSamlActive,
  isOidcActive,
  isLdapActive
}: {
  isSamlConfigured: boolean;
  isOidcConfigured: boolean;
  isGoogleConfigured: boolean;
  isSamlActive: boolean;
  isOidcActive: boolean;
  isLdapActive: boolean;
}) => {
  const { currentOrg } = useOrganization();
  const { subscription } = useSubscription();
  const { popUp, handlePopUpOpen, handlePopUpToggle } = usePopUp([
    "enforceSamlSsoConfirmation"
  ] as const);

  const { mutateAsync } = useUpdateOrg();

  const logout = useLogoutUser();
  const [bypassEnabledInModal, setBypassEnabledInModal] = useState(false);
  const [enforcementTypeInModal, setEnforcementTypeInModal] = useState<EnforceAuthType | null>(
    null
  );

  const handleEnforceSsoConfirm = async () => {
    if (!currentOrg?.id || !enforcementTypeInModal) return;

    try {
      if (bypassEnabledInModal && !currentOrg?.bypassOrgAuthEnabled) {
        await mutateAsync({
          orgId: currentOrg?.id,
          bypassOrgAuthEnabled: true
        });
      }

      if (enforcementTypeInModal === EnforceAuthType.SAML) {
        await mutateAsync({
          orgId: currentOrg?.id,
          authEnforced: true
        });

        createNotification({
          text: "Successfully enabled org-level SAML SSO enforcement",
          type: "success"
        });

        handlePopUpToggle("enforceSamlSsoConfirmation", false);
        setBypassEnabledInModal(false);
        setEnforcementTypeInModal(null);

        await logout.mutateAsync();
        window.open(`/api/v1/sso/redirect/saml2/organizations/${currentOrg.slug}`);
        window.close();
      } else if (enforcementTypeInModal === EnforceAuthType.GOOGLE) {
        await mutateAsync({
          orgId: currentOrg?.id,
          googleSsoAuthEnforced: true
        });

        createNotification({
          text: "Successfully enabled org-level Google SSO enforcement",
          type: "success"
        });

        handlePopUpToggle("enforceSamlSsoConfirmation", false);
        setBypassEnabledInModal(false);
        setEnforcementTypeInModal(null);

        await logout.mutateAsync();
        window.open(`/api/v1/sso/redirect/google?org_slug=${currentOrg.slug}`);
        window.close();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnforceOrgAuthToggle = async (value: boolean, type: EnforceAuthType) => {
    if (!currentOrg?.id) return;

    if (type === EnforceAuthType.SAML) {
      if (value) {
        setBypassEnabledInModal(true);
        setEnforcementTypeInModal(EnforceAuthType.SAML);
        handlePopUpOpen("enforceSamlSsoConfirmation");
        return;
      }

      await mutateAsync({
        orgId: currentOrg?.id,
        authEnforced: value
      });

      createNotification({
        text: "Successfully disabled org-level SAML SSO enforcement",
        type: "success"
      });
      return;
    }

    if (type === EnforceAuthType.GOOGLE) {
      if (value) {
        setBypassEnabledInModal(true);
        setEnforcementTypeInModal(EnforceAuthType.GOOGLE);
        handlePopUpOpen("enforceSamlSsoConfirmation");
        return;
      }

      await mutateAsync({
        orgId: currentOrg?.id,
        googleSsoAuthEnforced: value
      });

      createNotification({
        text: "Successfully disabled org-level Google SSO enforcement",
        type: "success"
      });
    } else if (type === EnforceAuthType.OIDC) {
      await mutateAsync({
        orgId: currentOrg?.id,
        authEnforced: value
      });

      createNotification({
        text: `Successfully ${value ? "enabled" : "disabled"} org-level OIDC SSO enforcement`,
        type: "success"
      });

      if (value) {
        await logout.mutateAsync();
        window.close();
      }
    } else {
      createNotification({
        text: `Invalid auth enforcement type ${type}`,
        type: "error"
      });
    }
  };

  const handleEnableBypassOrgAuthToggle = async (value: boolean) => {
    try {
      if (!currentOrg?.id) return;

      await mutateAsync({
        orgId: currentOrg?.id,
        bypassOrgAuthEnabled: value
      });

      createNotification({
        text: `Successfully ${value ? "enabled" : "disabled"} admin bypassing of org-level auth`,
        type: "success"
      });
    } catch (err) {
      console.error(err);
    }
  };

  const isGoogleOAuthEnforced = currentOrg.googleSsoAuthEnforced;
  const isAnySsoEnforced = Boolean(currentOrg?.authEnforced || isGoogleOAuthEnforced);
  const enforcementLabel = enforcementTypeInModal === EnforceAuthType.SAML ? "SAML" : "Google";

  // SAML and Google enforcement are paid; OIDC is implemented by this fork and always offered.
  const showSamlEnforcement =
    isSamlConfigured && Boolean(subscription?.samlSSO) && !isGoogleOAuthEnforced;
  const showOidcEnforcement = isOidcConfigured && !isGoogleOAuthEnforced;
  const showGoogleEnforcement =
    isGoogleConfigured &&
    Boolean(subscription?.enforceGoogleSSO) &&
    !isSamlActive &&
    !isOidcActive &&
    !isLdapActive;
  const showAdminBypass = Boolean(subscription?.samlSSO) || isOidcConfigured;

  if (
    !showSamlEnforcement &&
    !showOidcEnforcement &&
    !showGoogleEnforcement &&
    !showAdminBypass &&
    !subscription?.enforceMfa
  ) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>
            <ShieldCheck className="size-4 text-accent" />
            Enforcement
            {isAnySsoEnforced && <Badge variant="success">Active</Badge>}
          </CardTitle>
          <CardDescription>Require all members to sign in via your IdP.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal" className={twMerge(!showSamlEnforcement && "hidden")}>
              <FieldContent>
                <FieldTitle>Enforce SAML SSO</FieldTitle>
                <FieldDescription>Members can only sign in via SAML.</FieldDescription>
              </FieldContent>
              <OrgPermissionCan I={OrgPermissionActions.Edit} a={OrgPermissionSubjects.Sso}>
                {(isAllowed) => (
                  <Toggle
                    id="enforce-saml-auth"
                    variant="org"
                    checked={currentOrg?.authEnforced ?? false}
                    onCheckedChange={(value) =>
                      handleEnforceOrgAuthToggle(value, EnforceAuthType.SAML)
                    }
                    disabled={!isAllowed || currentOrg?.googleSsoAuthEnforced}
                  />
                )}
              </OrgPermissionCan>
            </Field>

            <Field orientation="horizontal" className={twMerge(!showOidcEnforcement && "hidden")}>
              <FieldContent>
                <FieldTitle>Enforce OIDC SSO</FieldTitle>
                <FieldDescription>Members can only sign in via OIDC.</FieldDescription>
              </FieldContent>
              <OrgPermissionCan I={OrgPermissionActions.Edit} a={OrgPermissionSubjects.Sso}>
                {(isAllowed) => (
                  <Toggle
                    id="enforce-oidc-auth"
                    variant="org"
                    checked={currentOrg?.authEnforced ?? false}
                    onCheckedChange={(value) =>
                      handleEnforceOrgAuthToggle(value, EnforceAuthType.OIDC)
                    }
                    disabled={!isAllowed}
                  />
                )}
              </OrgPermissionCan>
            </Field>

            <Field orientation="horizontal" className={twMerge(!showGoogleEnforcement && "hidden")}>
              <FieldContent>
                <FieldTitle>Enforce Google OAuth</FieldTitle>
                <FieldDescription>Members can only sign in via Google OAuth.</FieldDescription>
              </FieldContent>
              <OrgPermissionCan I={OrgPermissionActions.Edit} a={OrgPermissionSubjects.Sso}>
                {(isAllowed) => (
                  <Toggle
                    id="enforce-google-sso"
                    variant="org"
                    checked={currentOrg?.googleSsoAuthEnforced ?? false}
                    onCheckedChange={(value) =>
                      handleEnforceOrgAuthToggle(value, EnforceAuthType.GOOGLE)
                    }
                    disabled={!isAllowed || currentOrg?.authEnforced}
                  />
                )}
              </OrgPermissionCan>
            </Field>

            <div
              className={twMerge("ml-1 border-l border-border pl-4", !showAdminBypass && "hidden")}
            >
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Admin SSO Bypass</FieldTitle>
                  <FieldDescription>
                    Admins can sign in with a password at{" "}
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono underline underline-offset-2 hover:text-foreground"
                      href={`${window.location.origin}/login/admin`}
                    >
                      /login/admin
                    </a>{" "}
                    if your IdP is inaccessible.
                  </FieldDescription>
                </FieldContent>
                <OrgPermissionCan I={OrgPermissionActions.Edit} a={OrgPermissionSubjects.Sso}>
                  {(isAllowed) => (
                    <Toggle
                      id="allow-admin-bypass"
                      variant="org"
                      checked={currentOrg?.bypassOrgAuthEnabled ?? false}
                      onCheckedChange={(value) => handleEnableBypassOrgAuthToggle(value)}
                      disabled={!isAllowed}
                    />
                  )}
                </OrgPermissionCan>
              </Field>
              {isAnySsoEnforced && currentOrg?.bypassOrgAuthEnabled && !currentOrg?.enforceMfa && (
                <Alert variant="warning" className="mt-3">
                  <AlertTriangle />
                  <AlertDescription>
                    Org MFA is off, so bypass is password-only.
                    {subscription?.enforceMfa && (
                      <>
                        {" "}
                        <Link
                          to="/organizations/$orgId/settings"
                          params={{ orgId: currentOrg.id }}
                          search={{ selectedTab: "tab-org-security" }}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Enforce MFA
                        </Link>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <SsoMfaTrustField />
          </FieldGroup>
        </CardContent>
      </Card>

      <Dialog
        open={popUp.enforceSamlSsoConfirmation.isOpen}
        onOpenChange={(isOpen) => {
          handlePopUpToggle("enforceSamlSsoConfirmation", isOpen);
          setBypassEnabledInModal(currentOrg?.bypassOrgAuthEnabled ?? false);
          if (!isOpen) {
            setEnforcementTypeInModal(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enforce {enforcementLabel} SSO</DialogTitle>
          </DialogHeader>

          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>This action will enforce {enforcementLabel} SSO authentication</AlertTitle>
            <AlertDescription>
              <p>
                All users will be required to authenticate via {enforcementLabel} SSO to access this
                organization. Other authentication methods will be disabled.
              </p>
              <p className="font-medium">
                Before proceeding, ensure your {enforcementLabel} provider is available and properly
                configured to avoid access issues.
              </p>
              {enforcementTypeInModal !== EnforceAuthType.GOOGLE && (
                <p>
                  This also disables email & password signup for your verified domain(s) and skips
                  email verification for SSO sign-ins. Make sure a break-glass admin already has a
                  password and SSO bypass access before continuing — the signup block prevents
                  creating new password accounts for the domain afterwards.
                </p>
              )}
            </AlertDescription>
          </Alert>

          {!currentOrg?.bypassOrgAuthEnabled && (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Enable Admin SSO Bypass</FieldTitle>
                <FieldDescription>
                  Allow organization admins to bypass SSO login enforcement if they experience any
                  issues with their {enforcementLabel} provider.
                </FieldDescription>
              </FieldContent>
              <Toggle
                id="bypass-enabled-modal"
                variant="org"
                checked={bypassEnabledInModal}
                onCheckedChange={setBypassEnabledInModal}
              />
            </Field>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                onClick={() => {
                  handlePopUpToggle("enforceSamlSsoConfirmation", false);
                  setBypassEnabledInModal(currentOrg?.bypassOrgAuthEnabled ?? false);
                  setEnforcementTypeInModal(null);
                }}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button variant="org" onClick={handleEnforceSsoConfirm}>
              Enable Enforcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
