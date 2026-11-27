import { useOrganization, useServerConfig, useSubscription } from "@app/context";
import { CrossProjectSharingSection } from "@app/pages/project/SettingsPage/components/CrossProjectSharingSection";

import { PointInTimeVersionLimitSection } from "../PointInTimeVersionLimitSection";
import { PreferencesSection } from "../PreferencesSection";
import { SecretDetectionIgnoreValuesSection } from "../SecretDetectionIgnoreValuesSection/SecretDetectionIgnoreValuesSection";
import { SecretValidationRulesSection } from "../SecretValidationRulesSection";

export const PoliciesTab = () => {
  const { config } = useServerConfig();
  const { currentOrg } = useOrganization();
  const { subscription } = useSubscription();

  return (
    <div>
      <PreferencesSection />
      <SecretValidationRulesSection />
      {currentOrg.allowCrossProjectSecretSharing && subscription?.crossProjectSecretSharing && (
        <CrossProjectSharingSection />
      )}
      <PointInTimeVersionLimitSection />
      {config.paramsFolderSecretDetectionEnabled && <SecretDetectionIgnoreValuesSection />}
    </div>
  );
};
