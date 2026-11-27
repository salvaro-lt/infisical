import { useSubscription } from "@app/context";

import { IdentityAuthTemplatesSection, IdentitySection } from "./components";

export const OrgIdentityTab = () => {
  const { subscription } = useSubscription();

  return (
    <div className="flex flex-col gap-4">
      <IdentitySection />
      {subscription?.machineIdentityAuthTemplates && <IdentityAuthTemplatesSection />}
    </div>
  );
};
