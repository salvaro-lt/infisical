import { Globe, Plus } from "lucide-react";

import { OrgPermissionCan, PermissionDeniedBanner } from "@app/components/permissions";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DocumentationLinkBadge
} from "@app/components/v3";
import {
  OrgPermissionEmailDomainActions,
  OrgPermissionSubjects,
  useOrgPermission,
  useSubscription
} from "@app/context";
import { TEmailDomain } from "@app/hooks/api";
import { UsePopUpState } from "@app/hooks/usePopUp";

import { AddEmailDomainModal } from "./AddEmailDomainModal";
import { EmailDomainVerificationModal } from "./EmailDomainVerificationModal";
import { OrgEmailDomainsTable } from "./OrgEmailDomainsTable";

type EmailDomainPopUps = ["addDomain", "verifyDomain"];

type Props = {
  popUp: UsePopUpState<EmailDomainPopUps>;
  handlePopUpOpen: (popUpName: keyof UsePopUpState<EmailDomainPopUps>, data?: unknown) => void;
  handlePopUpClose: (popUpName: keyof UsePopUpState<EmailDomainPopUps>) => void;
  handlePopUpToggle: (popUpName: keyof UsePopUpState<EmailDomainPopUps>, state?: boolean) => void;
};

export const OrgEmailDomainsSection = ({
  popUp,
  handlePopUpOpen,
  handlePopUpClose,
  handlePopUpToggle
}: Props) => {
  const { permission } = useOrgPermission();
  const { subscription } = useSubscription();

  const hasEmailDomainVerification = Boolean(subscription?.emailDomainVerification);

  const handleVerifyDomain = (emailDomain: TEmailDomain) =>
    handlePopUpOpen("verifyDomain", emailDomain);

  const renderBody = () => {
    if (!permission.can(OrgPermissionEmailDomainActions.Read, OrgPermissionSubjects.EmailDomains)) {
      return <PermissionDeniedBanner />;
    }

    return <OrgEmailDomainsTable onVerifyDomain={handleVerifyDomain} />;
  };

  if (!hasEmailDomainVerification) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <Globe className="size-4 text-accent" />
            Email Domains
            <DocumentationLinkBadge href="https://infisical.com/docs/documentation/platform/email-domain" />
          </CardTitle>
          <CardDescription>Verified domains for your IDP.</CardDescription>
          <CardAction>
            <OrgPermissionCan
              I={OrgPermissionEmailDomainActions.Create}
              a={OrgPermissionSubjects.EmailDomains}
            >
              {(isAllowed) => (
                <Button
                  variant="outline"
                  isDisabled={!isAllowed}
                  onClick={() => handlePopUpOpen("addDomain")}
                >
                  <Plus />
                  Add Domain
                </Button>
              )}
            </OrgPermissionCan>
          </CardAction>
        </CardHeader>
        <CardContent>{renderBody()}</CardContent>
      </Card>
      <AddEmailDomainModal
        popUp={popUp}
        handlePopUpClose={handlePopUpClose}
        handlePopUpToggle={handlePopUpToggle}
        onCreated={handleVerifyDomain}
      />
      <EmailDomainVerificationModal
        popUp={popUp}
        handlePopUpClose={handlePopUpClose}
        handlePopUpToggle={handlePopUpToggle}
      />
    </>
  );
};
