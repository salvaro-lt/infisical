import { useEffect, useRef, useState } from "react";
import { TriangleAlertIcon, XIcon } from "lucide-react";

import { Alert, AlertDescription, IconButton } from "@app/components/v3";
import { AnalyticsEvent } from "@app/lib/analytics";

import { formatFreeUsageCount } from "./free-usage-format";
import { useAgentVaultFreeUsage } from "./useAgentVaultFreeUsage";

// Shown from 75% of the free requests to every member, closable once per visit.
export const AgentVaultFreeUsageNotice = () => {
  const [isClosed, setIsClosed] = useState(false);
  const hasTrackedView = useRef(false);
  const { freeUsage, isLimitReached, warn, isRootOrganization, trackPaywall } =
    useAgentVaultFreeUsage("agent-vault.free-usage-notice");

  const isShown = Boolean(freeUsage) && warn && !isClosed;
  const limit = freeUsage ? formatFreeUsageCount(freeUsage.limit) : "";
  const until = "until the month resets";
  // A sub-org shares its root organization's free requests.
  const owner = isRootOrganization ? "This organization" : "Your root organization";
  const message = isLimitReached
    ? `${owner} used its ${limit} free Agent Vault requests this month. Agent requests are refused ${until}.`
    : `${owner} used ${freeUsage ? formatFreeUsageCount(freeUsage.used) : ""} of its ${limit} free Agent Vault requests this month. Once they're used, agent requests are refused ${until}.`;

  useEffect(() => {
    if (!isShown || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackPaywall(AnalyticsEvent.PaywallViewed, message);
  }, [isShown, message, trackPaywall]);

  if (!isShown) return null;

  return (
    <Alert variant={isLimitReached ? "danger" : "warning"} className="mb-6 pr-10">
      <TriangleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
      <IconButton
        variant="ghost"
        size="xs"
        aria-label="Dismiss notice"
        onClick={() => setIsClosed(true)}
        className="absolute top-1.5 right-1.5 text-current"
      >
        <XIcon />
      </IconButton>
    </Alert>
  );
};
