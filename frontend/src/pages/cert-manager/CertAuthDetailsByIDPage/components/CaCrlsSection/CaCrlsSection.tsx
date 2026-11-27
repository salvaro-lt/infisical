import { useState } from "react";
import { subject } from "@casl/ability";
import { RefreshCwIcon } from "lucide-react";

import { createNotification } from "@app/components/notifications";
import { ProjectPermissionCan } from "@app/components/permissions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@app/components/v3";
import {
  ProjectPermissionCertificateAuthorityActions,
  ProjectPermissionSub,
  useSubscription
} from "@app/context";
import { CaStatus, CaType, useGetCa, useGetCaCrls, useRegenerateCaCrl } from "@app/hooks/api";
import { TInternalCertificateAuthority } from "@app/hooks/api/ca/types";

import { CaCrlsTable } from "./CaCrlsTable";

type Props = {
  caId: string;
};

export const CaCrlsSection = ({ caId }: Props) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { subscription } = useSubscription();
  const { data } = useGetCa({ caId, type: CaType.INTERNAL });
  const ca = data as TInternalCertificateAuthority | undefined;
  const { data: caCrls } = useGetCaCrls(caId);
  const regenerateCaCrl = useRegenerateCaCrl();

  if (!ca) return null;

  const caNotAfter = ca.configuration.notAfter;
  let regenerateBlockedReason: string | undefined;
  if (ca.status === CaStatus.PENDING_CERTIFICATE) {
    regenerateBlockedReason = "This CA has no certificate yet. Add one before regenerating the CRL";
  } else if (caNotAfter && new Date(caNotAfter) <= new Date()) {
    regenerateBlockedReason = "Renew this expired CA to regenerate the CRL";
  }

  const handleConfirm = () =>
    regenerateCaCrl.mutate(
      { caId },
      {
        onSuccess: () => {
          createNotification({ text: "CRL regenerated", type: "success" });
          setIsConfirmOpen(false);
        }
      }
    );

  return (
    <>
      <Card className="w-full">
        <CardHeader className="border-b">
          <CardTitle>CA Certificate Revocation Lists (CRLs)</CardTitle>
          <CardDescription>Each CRL is regenerated automatically before it expires</CardDescription>
          {Boolean(caCrls?.length) && subscription?.caCrl && (
            <CardAction>
              <ProjectPermissionCan
                I={ProjectPermissionCertificateAuthorityActions.Edit}
                a={subject(ProjectPermissionSub.CertificateAuthorities, { name: ca.name })}
              >
                {(isAllowed) => (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
                      <span tabIndex={0}>
                        <Button
                          variant="outline"
                          size="xs"
                          isDisabled={!isAllowed || Boolean(regenerateBlockedReason)}
                          onClick={() => setIsConfirmOpen(true)}
                        >
                          <RefreshCwIcon />
                          Regenerate CRL
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!isAllowed && (
                      <TooltipContent side="left">
                        You don&apos;t have permission to edit this CA
                      </TooltipContent>
                    )}
                    {isAllowed && regenerateBlockedReason && (
                      <TooltipContent side="left">{regenerateBlockedReason}</TooltipContent>
                    )}
                  </Tooltip>
                )}
              </ProjectPermissionCan>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <CaCrlsTable caId={caId} caName={ca.name} />
        </CardContent>
      </Card>

      <AlertDialog
        open={isConfirmOpen}
        isPending={regenerateCaCrl.isPending}
        onOpenChange={setIsConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate CRL</AlertDialogTitle>
            <AlertDialogDescription>
              A new CRL with the current list of revoked certificates replaces the one at the same
              URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="project"
              size="sm"
              isPending={regenerateCaCrl.isPending}
              onClick={handleConfirm}
            >
              Regenerate CRL
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
