import { createFileRoute, redirect } from "@tanstack/react-router";

// Billing is removed from this build; old links and bookmarks land on the organization's projects.
export const Route = createFileRoute(
  "/_authenticate/_inject-org-details/_org-layout/organizations/$orgId/billing"
)({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/organizations/$orgId/projects", params: { orgId: params.orgId } });
  }
});
