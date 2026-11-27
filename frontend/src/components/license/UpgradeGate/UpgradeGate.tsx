import type { BillingCadence } from "@app/hooks/api";

import type {
  CapabilityUpgradeAlternative,
  CapabilityUpgradeIntent
} from "./capability-upgrade-intents";
import { UnavailableFeatureDialog } from "./UnavailableFeatureDialog";
import type { UpgradeIntent } from "./upgrade-intents";

type Props = {
  intent: UpgradeIntent;
  paywallKey: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialTier?: string;
  initialCadence?: BillingCadence;
};

type CapabilityProps = Omit<Props, "intent" | "initialTier" | "initialCadence"> & {
  intent: CapabilityUpgradeIntent;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  alternative?: CapabilityUpgradeAlternative;
};

// This build has no upgrade, pricing or checkout flow; see UnavailableFeatureDialog.
export const UpgradeGate = ({ isOpen, onOpenChange }: Props | CapabilityProps) => (
  <UnavailableFeatureDialog isOpen={isOpen} onOpenChange={onOpenChange} />
);
