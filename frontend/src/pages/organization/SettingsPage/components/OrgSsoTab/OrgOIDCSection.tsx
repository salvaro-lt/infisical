import type { JSX } from "react";
import { ArrowLeftRight, Info, MoreHorizontal, Pencil } from "lucide-react";

import { createNotification } from "@app/components/notifications";
import { OrgPermissionCan } from "@app/components/permissions";
import {
  Alert,
  AlertDescription,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
  IconButton,
  Toggle
} from "@app/components/v3";
import {
  OrgPermissionActions,
  OrgPermissionSubjects,
  useOrganization,
  useOrgPermission
} from "@app/context";
import { OauthGrantType, useGetOauthClients, useGetOIDCConfig } from "@app/hooks/api";
import { useUpdateOIDCConfig } from "@app/hooks/api/oidcConfig/mutations";
import { usePopUp } from "@app/hooks/usePopUp";

import { OIDCModal } from "./OIDCModal";

type Props = {
  onSwitchProvider?: () => void;
};

const TokenExchangeDependentsAlert = () => {
  const { currentOrg } = useOrganization();
  const { data: oauthClients } = useGetOauthClients(currentOrg?.id ?? "");

  const hasTokenExchangeClient = (oauthClients ?? []).some((client) =>
    client.grantTypes.includes(OauthGrantType.TokenExchange)
  );

  if (!hasTokenExchangeClient) return null;

  return (
    <Alert>
      <Info />
      <AlertDescription className="text-xs">
        <p>
          OAuth application depends on this configuration. Disabling OIDC will stop the application
          from exchanging tokens.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export const OrgOIDCSection = ({ onSwitchProvider }: Props): JSX.Element => {
  const { currentOrg } = useOrganization();
  const { permission } = useOrgPermission();

  const { data, isPending } = useGetOIDCConfig(currentOrg?.id ?? "");
  const { mutateAsync } = useUpdateOIDCConfig();

  const { popUp, handlePopUpOpen, handlePopUpClose, handlePopUpToggle } = usePopUp([
    "addOIDC"
  ] as const);

  const handleOIDCToggle = async (value: boolean) => {
    if (!currentOrg?.id) return;

    await mutateAsync({
      organizationId: currentOrg?.id,
      isActive: value
    });

    createNotification({
      text: `Successfully ${value ? "enabled" : "disabled"} OIDC SSO`,
      type: "success"
    });
  };

  const addOidcButtonClick = async () => {
    if (currentOrg) handlePopUpOpen("addOIDC");
  };

  const isGoogleOAuthEnabled = currentOrg.googleSsoAuthEnforced;
  const canReadOauthClients = permission.can(
    OrgPermissionActions.Read,
    OrgPermissionSubjects.OauthClients
  );

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>OIDC</CardTitle>
          <CardDescription>Manage OIDC authentication configuration.</CardDescription>
          {!isPending && (
            <CardAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton variant="ghost" size="sm" aria-label="OIDC configuration options">
                    <MoreHorizontal />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <OrgPermissionCan I={OrgPermissionActions.Create} a={OrgPermissionSubjects.Sso}>
                    {(isAllowed) => (
                      <DropdownMenuItem isDisabled={!isAllowed} onClick={addOidcButtonClick}>
                        <Pencil />
                        Edit Configuration
                      </DropdownMenuItem>
                    )}
                  </OrgPermissionCan>
                  {onSwitchProvider && (
                    <DropdownMenuItem onClick={onSwitchProvider}>
                      <ArrowLeftRight />
                      Switch Method
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {canReadOauthClients && <TokenExchangeDependentsAlert />}
            {data && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Enable OIDC</FieldTitle>
                  <FieldDescription>
                    Allow members to authenticate into Infisical with OIDC.
                  </FieldDescription>
                </FieldContent>
                {!isPending && (
                  <OrgPermissionCan
                    I={OrgPermissionActions.Edit}
                    a={OrgPermissionSubjects.Sso}
                    tooltipProps={{
                      className: "max-w-sm",
                      side: "left"
                    }}
                    allowedLabel={
                      isGoogleOAuthEnabled
                        ? "You cannot enable OIDC SSO while Google OAuth is enforced. Disable Google OAuth enforcement to enable OIDC SSO."
                        : undefined
                    }
                    renderTooltip={isGoogleOAuthEnabled}
                  >
                    {(isAllowed) => (
                      <div>
                        <Toggle
                          id="enable-oidc-sso"
                          variant="org"
                          checked={data.isActive}
                          onCheckedChange={(value) => handleOIDCToggle(value)}
                          disabled={!isAllowed || isGoogleOAuthEnabled}
                        />
                      </div>
                    )}
                  </OrgPermissionCan>
                )}
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
      <OIDCModal
        popUp={popUp}
        handlePopUpClose={handlePopUpClose}
        handlePopUpToggle={handlePopUpToggle}
      />
    </>
  );
};
