import { type LinkOptions, useNavigate } from "@tanstack/react-router";
import { LayoutTemplate, PlusIcon } from "lucide-react";

import { OrgPermissionCan } from "@app/components/permissions";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@app/components/v3";
import { OrgPermissionActions, OrgPermissionSubjects, useSubscription } from "@app/context";
import { ProjectType } from "@app/hooks/api/projects/types";
import { TProjectTemplate } from "@app/hooks/api/projectTemplates";
import { usePopUp } from "@app/hooks/usePopUp";

import { ProjectTemplateDetailsModal } from "./ProjectTemplateDetailsModal";
import { ProjectTemplatesTable } from "./ProjectTemplatesTable";

type Props = {
  projectType: ProjectType;
  getTemplateLink: (template: TProjectTemplate) => LinkOptions;
};

export const ProjectTemplatesSection = ({ projectType, getTemplateLink }: Props) => {
  const navigate = useNavigate();
  const { subscription } = useSubscription();

  const { popUp, handlePopUpOpen, handlePopUpToggle } = usePopUp(["addTemplate"] as const);

  if (!subscription?.projectTemplates) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <LayoutTemplate className="size-4 text-accent" />
            Project Templates
          </CardTitle>
          <CardDescription>
            Create and configure templates with predefined roles
            {projectType === ProjectType.SecretManager && " and environments"} to streamline project
            setup.
          </CardDescription>
          <CardAction>
            <OrgPermissionCan
              I={OrgPermissionActions.Create}
              a={OrgPermissionSubjects.ProjectTemplates}
            >
              {(isAllowed) => (
                <Button
                  variant="project"
                  isDisabled={!isAllowed}
                  onClick={() => {
                    handlePopUpOpen("addTemplate");
                  }}
                >
                  <PlusIcon />
                  Add Template
                </Button>
              )}
            </OrgPermissionCan>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ProjectTemplatesTable projectType={projectType} getTemplateLink={getTemplateLink} />
        </CardContent>
      </Card>
      <ProjectTemplateDetailsModal
        projectType={projectType}
        onComplete={(template) => navigate(getTemplateLink(template))}
        isOpen={popUp.addTemplate.isOpen}
        onOpenChange={(isOpen) => handlePopUpToggle("addTemplate", isOpen)}
      />
    </>
  );
};
