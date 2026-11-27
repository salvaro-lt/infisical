import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/components/v3";
import { useProject, useSubscription } from "@app/context";
import { EventType } from "@app/hooks/api/auditLogs/enums";
import { TPkiSync } from "@app/hooks/api/pkiSyncs";
import { LogsSection } from "@app/pages/organization/AuditLogsPage/components/LogsSection";

const PKI_SYNC_EVENTS = [
  EventType.PKI_SYNC_SYNC_CERTIFICATES,
  EventType.PKI_SYNC_IMPORT_CERTIFICATES,
  EventType.PKI_SYNC_REMOVE_CERTIFICATES,
  EventType.PKI_SYNC_HEALTH_CHECK
];

type Props = {
  pkiSync: TPkiSync;
};

export const PkiSyncAuditLogsSection = ({ pkiSync }: Props) => {
  const { subscription } = useSubscription();
  const { currentProject } = useProject();
  const auditLogsRetentionDays =
    subscription?.auditLogsRetentionDays === null
      ? Infinity
      : (subscription?.auditLogsRetentionDays ?? 30);

  if (!subscription?.auditLogs) return null;

  return (
    <Card className="max-h-full min-w-0">
      <CardHeader>
        <CardTitle>Sync Logs</CardTitle>
        <CardDescription>
          Displaying audit logs from the last {Math.min(auditLogsRetentionDays, 60)} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LogsSection
          refetchInterval={15_000}
          showFilters={false}
          project={currentProject}
          presets={{
            eventMetadata: { syncId: pkiSync.id },
            startDate: new Date(
              new Date().setDate(new Date().getDate() - Math.min(auditLogsRetentionDays, 60))
            ),
            eventType: PKI_SYNC_EVENTS
          }}
        />
      </CardContent>
    </Card>
  );
};
