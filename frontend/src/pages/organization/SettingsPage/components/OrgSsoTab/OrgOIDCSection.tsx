import type { JSX } from "react";
import { format } from "date-fns";
import { ArrowLeftRight, BanIcon, CheckIcon, Info, MoreHorizontal, Pencil } from "lucide-react";

import { createNotification } from "@app/components/notifications";
import { OrgPermissionCan } from "@app/components/permissions";
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  Detail,
  DetailGroup,
  DetailLabel,
  DetailValue,
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
  Skeleton,
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
import { OIDCConfigData } from "@app/hooks/api/oidcConfig/types";
import { usePopUp } from "@app/hooks/usePopUp";

import { OIDCModal } from "./OIDCModal";

type Props = {
  onSwitchProvider?: () => void;
};

const NotSet = () => <span className="text-muted">—</span>;

// The host is what admins recognize; the full URL is in the configuration sheet.
const describeIdentityProvider = (config: OIDCConfigData) => {
  const url = config.configurationType === "custom" ? config.issuer : config.discoveryURL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const OIDCSummarySkeleton = () => (
  <DetailGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {["provider", "client", "redirect", "last"].map((key) => (
      <Detail key={key}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-40" />
      </Detail>
    ))}
  </DetailGroup>
);

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
  const { mutateAsync, isPending: isToggling } = useUpdateOIDCConfig();

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
      text: value ? "OIDC SSO enabled" : "OIDC SSO disabled",
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
          <CardTitle className="flex items-center gap-1.5">
            OIDC
            {data &&
              (data.isActive ? (
                <Badge variant="success">
                  <CheckIcon />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="neutral">
                  <BanIcon />
                  Disabled
                </Badge>
              ))}
          </CardTitle>
          <CardDescription>
            Members sign in through your OpenID Connect identity provider.
          </CardDescription>
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
            {isPending && <OIDCSummarySkeleton />}
            {data && (
              <DetailGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Detail>
                  <DetailLabel>Identity Provider</DetailLabel>
                  <DetailValue>{describeIdentityProvider(data) ?? <NotSet />}</DetailValue>
                </Detail>
                <Detail>
                  <DetailLabel>Client ID</DetailLabel>
                  <DetailValue className="font-mono">{data.clientId || <NotSet />}</DetailValue>
                </Detail>
                {data.redirectUri && (
                  <Detail className="sm:col-span-2">
                    <DetailLabel>Redirect URI</DetailLabel>
                    <DetailValue className="flex items-center gap-1.5 font-mono">
                      <span className="min-w-0 wrap-anywhere">{data.redirectUri}</span>
                      <CopyButton value={data.redirectUri} ariaLabel="Copy redirect URI" />
                    </DetailValue>
                  </Detail>
                )}
                <Detail>
                  <DetailLabel>Last Sign-In</DetailLabel>
                  <DetailValue>
                    {data.lastUsed ? format(new Date(data.lastUsed), "PPpp") : <NotSet />}
                  </DetailValue>
                </Detail>
              </DetailGroup>
            )}
            {data && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Enable OIDC</FieldTitle>
                  <FieldDescription>
                    Allow members to sign in to Infisical through this identity provider.
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
                          disabled={!isAllowed || isGoogleOAuthEnabled || isToggling}
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
