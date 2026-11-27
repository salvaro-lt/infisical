import { FileText, Key, LayoutDashboard, Settings, Shield } from "lucide-react";

import { useSubscription } from "@app/context";

import { ProjectNavList } from "./ProjectNavLink";
import { PROJECT_ACCESS_CONTROL_SUBMENU } from "./submenus";
import type { NavItem, Submenu } from "./types";

export const KmsNav = ({ onSubmenuOpen }: { onSubmenuOpen: (submenu: Submenu) => void }) => {
  const { subscription } = useSubscription();
  const items: NavItem[] = [
    { label: "Overview", icon: LayoutDashboard, pathSuffix: "overview" },
    { label: "KMIP", icon: Key, pathSuffix: "kmip", hidden: !subscription?.kmip },
    {
      label: "Access Control",
      icon: Shield,
      pathSuffix: "access-management",
      activeMatch: /\/groups\/|\/identities\/|\/members\/|\/roles\//,
      submenu: PROJECT_ACCESS_CONTROL_SUBMENU
    },
    {
      label: "Audit Logs",
      icon: FileText,
      pathSuffix: "audit-logs",
      hidden: !subscription?.auditLogs
    },
    { label: "Settings", icon: Settings, pathSuffix: "settings" }
  ];
  return <ProjectNavList items={items} onSubmenuOpen={onSubmenuOpen} />;
};
