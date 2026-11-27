import type {
  CapabilityUpgradeAlternative,
  CapabilityUpgradeIntent
} from "./capability-upgrade-intents";
import { UnavailableFeatureDialog } from "./UnavailableFeatureDialog";

type Props = {
  intent: CapabilityUpgradeIntent;
  paywallKey: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  alternative?: CapabilityUpgradeAlternative;
};

// This build has no upgrade flow; see UnavailableFeatureDialog.
export const CapabilityUpgradeGate = ({ isOpen, onOpenChange }: Props) => (
  <UnavailableFeatureDialog isOpen={isOpen} onOpenChange={onOpenChange} />
);
