import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/components/v3";
import { useProject, useSubscription } from "@app/context";
import { EventType } from "@app/hooks/api/auditLogs/enums";
import { TIntegrationWithEnv } from "@app/hooks/api/integrations/types";
import { LogsSection } from "@app/pages/organization/AuditLogsPage/components/LogsSection";

// Add more events if needed
const INTEGRATION_EVENTS = [EventType.INTEGRATION_SYNCED];

type Props = {
  integration: TIntegrationWithEnv;
};

export const IntegrationAuditLogsSection = ({ integration }: Props) => {
  const { subscription } = useSubscription();
  const { currentProject } = useProject();

  const auditLogsRetentionDays =
    subscription?.auditLogsRetentionDays === null
      ? Infinity
      : (subscription?.auditLogsRetentionDays ?? 30);

  if (!subscription?.auditLogs) return null;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Integration Logs</CardTitle>
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
            eventMetadata: { integrationId: integration.id },
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
