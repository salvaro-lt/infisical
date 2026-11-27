import { ChevronDownIcon, PlusIcon } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@app/components/v3";
import { OrgPermissionActions, OrgPermissionSubjects, useOrgPermission } from "@app/context";
import {
  ADD_MENU_CHANNEL_TYPES,
  ALERT_CHANNEL_TYPE_LABELS,
  AlertChannelType
} from "@app/hooks/api/alerts";

import { getChannelIcon } from "./channelIcons";

type Props = {
  onAdd: (channelType: AlertChannelType) => void;
  isDisabled?: boolean;
  // Channel types the plan doesn't include; they're left out of the menu.
  lockedChannelTypes?: AlertChannelType[];
  label?: string;
  contentClassName?: string;
};

export const AddChannelMenu = ({
  onAdd,
  isDisabled,
  lockedChannelTypes = [],
  label = "Add channel",
  contentClassName = "w-[var(--radix-dropdown-menu-trigger-width)]"
}: Props) => {
  const { permission } = useOrgPermission();
  const canPickSlackIntegration = permission.can(
    OrgPermissionActions.Read,
    OrgPermissionSubjects.Settings
  );
  const addChannel = (channelType: AlertChannelType) =>
    onAdd(
      channelType === AlertChannelType.SlackApp && !canPickSlackIntegration
        ? AlertChannelType.Slack
        : channelType
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" isDisabled={isDisabled}>
          <PlusIcon className="size-4" />
          {label}
          <ChevronDownIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className={contentClassName}>
        {ADD_MENU_CHANNEL_TYPES.filter(
          (channelType) => !lockedChannelTypes.includes(channelType)
        ).map((channelType) => {
          const Icon = getChannelIcon(channelType);
          return (
            <DropdownMenuItem key={channelType} onClick={() => addChannel(channelType)}>
              <Icon className="size-4" />
              {ALERT_CHANNEL_TYPE_LABELS[channelType]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
