import { useState } from "react";

import {
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@app/components/v3";
import { useScopeVariant } from "@app/hooks";
import { IdentityAuthMethod } from "@app/hooks/api/identities";
import { UsePopUpState } from "@app/hooks/usePopUp";

import { IdentityAuthMethodModalContent } from "./IdentityAuthMethodModalContent";
import { IDENTITY_AUTH_FORM_ID } from "./types";

type Props = {
  popUp: UsePopUpState<["identityAuthMethod"]>;
  /** Unused; kept so existing callers that still pass it keep compiling. */
  handlePopUpOpen?: (popUpName: "upgradePlan") => void;
  handlePopUpToggle: (
    popUpName: keyof UsePopUpState<["identityAuthMethod"]>,
    state?: boolean
  ) => void;
};

export const IdentityAuthMethodModal = ({ popUp, handlePopUpToggle }: Props) => {
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<IdentityAuthMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const primaryVariant = useScopeVariant();

  const initialAuthMethod = popUp?.identityAuthMethod?.data?.authMethod;

  const isSelectedAuthAlreadyConfigured =
    popUp?.identityAuthMethod?.data?.allAuthMethods?.includes(selectedAuthMethod);

  const title = isSelectedAuthAlreadyConfigured ? "Edit Auth Method" : "Add Auth Method";

  return (
    <Sheet
      open={popUp?.identityAuthMethod?.isOpen}
      onOpenChange={(isOpen) => {
        handlePopUpToggle("identityAuthMethod", isOpen);
        if (!isOpen) setIsSubmitting(false);
      }}
    >
      <SheetContent side="right" className="flex flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
          <IdentityAuthMethodModalContent
            handlePopUpToggle={handlePopUpToggle}
            identity={{
              name: popUp?.identityAuthMethod?.data?.name,
              authMethods: popUp?.identityAuthMethod?.data?.allAuthMethods,
              id: popUp?.identityAuthMethod.data?.identityId
            }}
            initialAuthMethod={initialAuthMethod}
            setSelectedAuthMethod={setSelectedAuthMethod}
            isUpdate={Boolean(isSelectedAuthAlreadyConfigured)}
            onSubmittingChange={setIsSubmitting}
          />
        </div>
        <SheetFooter className="justify-end border-t">
          <Button
            type="button"
            variant="ghost"
            isDisabled={isSubmitting}
            onClick={() => handlePopUpToggle("identityAuthMethod", false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={IDENTITY_AUTH_FORM_ID}
            variant={primaryVariant}
            isPending={isSubmitting}
            isDisabled={isSubmitting || !selectedAuthMethod}
          >
            {isSelectedAuthAlreadyConfigured ? "Update" : "Add"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
