import { useCallback } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useOrganization, useSubscription } from "@app/context";
import { useGetAgentVaultAccess } from "@app/hooks/api/agentVault";
import { analytics, AnalyticsEvent } from "@app/lib/analytics";

// freeUsage is the org's free Agent Vault requests this month, and null unless the org is on the free tier.
export const useAgentVaultFreeUsage = (paywallKey: string) => {
  const { data: access } = useGetAgentVaultAccess();
  const { currentOrg, isRootOrganization } = useOrganization();
  const { subscription } = useSubscription();
  const route = useRouterState({
    select: (state) => state.matches.at(-1)?.routeId ?? "unknown"
  });
  const plan = subscription.slug ?? "free";

  const trackPaywall = useCallback(
    (event: typeof AnalyticsEvent.PaywallViewed, paywallText: string) =>
      analytics.captureForOrganization(event, currentOrg.id, {
        paywallKey,
        paywallText,
        route,
        isEnterpriseFeature: false,
        plan
      }),
    [currentOrg.id, paywallKey, route, plan]
  );

  return {
    freeUsage: access?.freeUsage ?? null,
    isLimitReached: access?.state === "limit-reached",
    warn: Boolean(access?.warn),
    isRootOrganization,
    trackPaywall
  };
};
