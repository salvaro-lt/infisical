import { PlusIcon } from "lucide-react";

import { OrgPermissionCan } from "@app/components/permissions";
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
import { OrgPermissionAuditLogsActions, OrgPermissionSubjects } from "@app/context";
import { withPermission } from "@app/hoc";
import { usePopUp, useScopeVariant } from "@app/hooks";

import { AddAuditLogStreamModal, AuditLogStreamAlertAction } from "./components";
import { AuditLogStreamTable } from "./components/AuditLogStreamTable";

export const AuditLogStreamsTab = withPermission(
  () => {
    const scopeVariant = useScopeVariant();

    const { popUp, handlePopUpOpen, handlePopUpToggle } = usePopUp(["auditLogStreamForm"] as const);

    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>
              Audit Log Streams
              <DocumentationLinkBadge href="https://infisical.com/docs/documentation/platform/audit-log-streams/audit-log-streams" />
            </CardTitle>
            <CardDescription>
              Send audit logs from Infisical to external logging providers via HTTP
            </CardDescription>
            <CardAction className="flex items-center gap-2">
              <AuditLogStreamAlertAction />
              <OrgPermissionCan
                I={OrgPermissionAuditLogsActions.Edit}
                a={OrgPermissionSubjects.AuditLogStreams}
              >
                {(isAllowed) => (
                  <Button
                    variant={scopeVariant}
                    isDisabled={!isAllowed}
                    onClick={() => {
                      handlePopUpOpen("auditLogStreamForm");
                    }}
                  >
                    <PlusIcon />
                    Add Log Stream
                  </Button>
                )}
              </OrgPermissionCan>
            </CardAction>
          </CardHeader>
          <CardContent>
            <AuditLogStreamTable />
          </CardContent>
        </Card>
        <AddAuditLogStreamModal
          isOpen={popUp.auditLogStreamForm.isOpen}
          onOpenChange={(isOpen) => handlePopUpToggle("auditLogStreamForm", isOpen)}
        />
      </>
    );
  },
  {
    action: OrgPermissionAuditLogsActions.Read,
    subject: OrgPermissionSubjects.AuditLogStreams,
    accessRestrictedMode: "dialog"
  }
);
