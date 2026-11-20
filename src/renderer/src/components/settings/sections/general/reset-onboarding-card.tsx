import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { SettingsRow } from "@/components/settings/components/setting-row";
import { RotateCcw } from "lucide-react";

export function ResetOnboardingCard({ highlighted = false }: { highlighted?: boolean }) {
  const [isResetting, setIsResetting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      lumi.onboarding.reset();
    } catch (error) {
      console.error("Failed to reset onboarding:", error);
    } finally {
      setIsResetting(false);
      setDialogOpen(false);
    }
  };

  return (
    <SettingsRow
      id="internal_resetOnboarding"
      highlighted={highlighted}
      icon={<RotateCcw className="size-4" />}
      label="Onboarding Setup Wizard"
      description="Reset and re-launch Lumi's initial setup flow on next restart."
    >
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isResetting}>
            Reset Onboarding
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Onboarding?</DialogTitle>
            <DialogDescription>
              {`This will close active windows and re-run the welcome walkthrough. Your spaces, history, and bookmarks remain intact.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={isResetting}>
              {isResetting ? "Resetting..." : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsRow>
  );
}
