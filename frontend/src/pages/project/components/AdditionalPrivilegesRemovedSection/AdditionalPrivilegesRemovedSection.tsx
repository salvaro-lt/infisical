import { InfoIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@app/components/v3";

export const AdditionalPrivilegesRemovedSection = () => {
  return (
    <Alert variant="info">
      <InfoIcon />
      <AlertTitle>Additional Privileges Were Replaced by Folder-Level Access</AlertTitle>
      <AlertDescription>
        Folder-level access override roles and keep working when folders are renamed or moved.
      </AlertDescription>
    </Alert>
  );
};
