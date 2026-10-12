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

export function ResetOnboardingCard() {
  const [isResetting, setIsResetting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      flow.onboarding.reset();
    } catch (error) {
      console.error("Failed to reset onboarding:", error);
    } finally {
      setIsResetting(false);
      setDialogOpen(false);
    }
  };

  return (
    <div className="remove-app-drag rounded-2xl border border-border/50 p-6 bg-card/60 backdrop-blur-md shadow-xs">
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">Onboarding</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Reset the onboarding walkthrough</p>
      </div>
      <div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="w-full" disabled={isResetting}>
              Reset Onboarding
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Onboarding?</DialogTitle>
              <DialogDescription>
                {`Are you sure? This will close the app. Your data won't be reset, but any unsaved website data may be lost.`}
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
      </div>
    </div>
  );
}
