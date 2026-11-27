import { AppWindow, ChevronLeft, Cog, KeyRound, Lock, Network, ShieldUser } from "lucide-react";

import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SubOrgIcon } from "@app/components/v3";
import { useOrganization, useSubscription } from "@app/context";

import { OrgNavLink } from "./OrgNavLink";
import type { OrgNavItem } from "./types";

// --- Org settings submenu (secondary sidebar) ---

export const OrgSettingsSubmenuView = ({ onBack }: { onBack: () => void }) => {
  const { isSubOrganization } = useOrganization();
  const { subscription } = useSubscription();

  const items: OrgNavItem[] = [
    {
      label: "General",
      icon: Cog,
      pathSuffix: "settings",
      search: { selectedTab: "tab-org-general" },
      isDefaultSearch: true
    },
    {
      label: "SSO & Provisioning",
      icon: ShieldUser,
      pathSuffix: "sso",
      hidden: isSubOrganization
    },
    {
      label: "OAuth Applications",
      icon: AppWindow,
      pathSuffix: "oauth-applications",
      hidden: isSubOrganization
    },
    {
      label: "Networking",
      icon: Network,
      pathSuffix: "networking",
      hidden: !subscription?.gateway
    },
    {
      label: "Security",
      icon: Lock,
      pathSuffix: "settings",
      search: { selectedTab: "tab-org-security" },
      hidden: isSubOrganization
    },
    {
      label: "Encryption",
      icon: KeyRound,
      pathSuffix: "settings",
      search: { selectedTab: "tab-org-encryption" },
      hidden: !subscription?.externalKms
    },
    {
      label: "Sub Organizations",
      icon: SubOrgIcon,
      pathSuffix: "settings",
      search: { selectedTab: "tab-sub-organizations" },
      hidden: isSubOrganization || !subscription?.subOrganization
    }
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel asChild>
        <button
          className="cursor-pointer hover:bg-foreground/[0.025]"
          type="button"
          onClick={onBack}
        >
          <ChevronLeft />
          <span>Settings</span>
        </button>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items
          .filter((item) => !item.hidden)
          .map((item) => (
            <OrgNavLink key={item.label} item={item} />
          ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
