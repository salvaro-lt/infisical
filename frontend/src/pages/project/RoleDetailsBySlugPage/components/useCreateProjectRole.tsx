import {
  ProjectPermissionActions,
  ProjectPermissionSub,
  useProject,
  useProjectPermission,
  useSubscription
} from "@app/context";
import { usePopUp } from "@app/hooks";
import { ProjectType } from "@app/hooks/api/projects/types";

import { RoleModal } from "./RoleModal";

export const useCreateProjectRole = () => {
  const { currentProject } = useProject();
  const { permission } = useProjectPermission();
  const { subscription } = useSubscription();
  const { popUp, handlePopUpOpen, handlePopUpToggle } = usePopUp(["role"] as const);

  const canCreateRole =
    currentProject?.type !== ProjectType.CertificateManager &&
    permission.can(ProjectPermissionActions.Create, ProjectPermissionSub.Role) &&
    Boolean(subscription?.rbac);

  const openCreateRole = () => handlePopUpOpen("role");

  const createRoleDialogs = <RoleModal popUp={popUp} handlePopUpToggle={handlePopUpToggle} />;

  return { canCreateRole, openCreateRole, createRoleDialogs };
};
