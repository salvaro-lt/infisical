import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@app/components/v3";

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

// Stands in for Infisical's upgrade and checkout flow, which this build does not offer. Paid
// features are hidden at their entry points; this only shows if one of those was missed.
export const UnavailableFeatureDialog = ({ isOpen, onOpenChange }: Props) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Not Available</DialogTitle>
        <DialogDescription>This feature is not available on this instance.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
