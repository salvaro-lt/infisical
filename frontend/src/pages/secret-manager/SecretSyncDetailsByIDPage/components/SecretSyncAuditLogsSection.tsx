import { RefreshCwIcon } from "lucide-react";

import { createNotification } from "@app/components/notifications";
import { ProjectPermissionCan } from "@app/components/permissions";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@app/components/v3";
import { useProject, useSubscription } from "@app/context";
import { ProjectPermissionSecretSyncActions } from "@app/context/ProjectPermissionContext/types";
import { SECRET_SYNC_MAP } from "@app/helpers/secretSyncs";
import { EventType } from "@app/hooks/api/auditLogs/enums";
import { TSecretSync, useTriggerSecretSyncSyncSecrets } from "@app/hooks/api/secretSyncs";
import { getSecretSyncPermissionSubject } from "@app/lib/fn/permission";
import { LogsSection } from "@app/pages/organization/AuditLogsPage/components/LogsSection";

const INTEGRATION_EVENTS = [
  EventType.SECRET_SYNC_SYNC_SECRETS,
  EventType.SECRET_SYNC_REMOVE_SECRETS,
  EventType.SECRET_SYNC_IMPORT_SECRETS
];

type Props = {
  secretSync: TSecretSync;
};

export const SecretSyncAuditLogsSection = ({ secretSync }: Props) => {
  const { subscription } = useSubscription();
  const { currentProject } = useProject();

  const triggerSyncSecrets = useTriggerSecretSyncSyncSecrets();
  const destinationName = SECRET_SYNC_MAP[secretSync.destination].name;
  const permissionSubject = getSecretSyncPermissionSubject(secretSync);

  const auditLogsRetentionDays =
    subscription?.auditLogsRetentionDays === null
      ? Infinity
      : (subscription?.auditLogsRetentionDays ?? 30);

  const handleTriggerSync = async () => {
    await triggerSyncSecrets.mutateAsync({
      syncId: secretSync.id,
      destination: secretSync.destination,
      projectId: secretSync.projectId
    });

    createNotification({
      text: `Successfully triggered ${destinationName} Sync`,
      type: "success"
    });
  };

  if (!subscription?.auditLogs) return null;

  return (
    <Card className="max-h-full min-w-0">
      <CardHeader>
        <CardTitle>Sync Logs</CardTitle>
        <CardDescription>
          Displaying audit logs from the last {Math.min(auditLogsRetentionDays, 60)} days
        </CardDescription>
        <CardAction>
          <ProjectPermissionCan
            I={ProjectPermissionSecretSyncActions.SyncSecrets}
            a={permissionSubject}
          >
            {(isAllowed: boolean) => (
              <Button
                variant="outline"
                onClick={handleTriggerSync}
                isDisabled={!isAllowed}
                isPending={triggerSyncSecrets.isPending}
              >
                <RefreshCwIcon />
                Trigger Sync
              </Button>
            )}
          </ProjectPermissionCan>
        </CardAction>
      </CardHeader>
      <CardContent>
        <LogsSection
          refetchInterval={15_000}
          showFilters={false}
          project={currentProject}
          presets={{
            eventMetadata: { syncId: secretSync.id },
            startDate: new Date(
              new Date().setDate(new Date().getDate() - Math.min(auditLogsRetentionDays, 60))
            ),
            eventType: INTEGRATION_EVENTS
          }}
        />
      </CardContent>
    </Card>
  );
};
