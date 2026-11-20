import { Card, CardContent } from "@/components/ui/card";
import { InternalPageShell } from "@/components/main/internal-page-shell";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Puzzle } from "lucide-react";
import { toast } from "sonner";

import ExtensionCard from "./components/extension-card";
import ExtensionDetails from "./components/extension-details";
import { ExtensionsProvider, useExtensions } from "@/components/providers/extensions-provider";
import { useQueryState } from "nuqs";

export const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/category/extensions?utm_source=ext_sidebar";

function ExtensionsPage() {
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [selectedExtensionId, setSelectedExtensionId] = useQueryState("id");

  const { extensions } = useExtensions();

  const [isProcessing, setIsProcessing] = useState(false);

  const setExtensionEnabled = async (id: string, enabled: boolean) => {
    setIsProcessing(true);

    const success = await lumi.extensions.setExtensionEnabled(id, enabled);
    if (success) {
      toast.success(`This extension has been successfully ${enabled ? "enabled" : "disabled"}!`);
    } else {
      toast.error(`Failed to ${enabled ? "enable" : "disable"} this extension!`);
    }

    setIsProcessing(false);
    return success;
  };

  const setExtensionPinned = async (id: string, pinned: boolean) => {
    setIsProcessing(true);

    const success = await lumi.extensions.setExtensionPinned(id, pinned);
    if (success) {
      toast.success(`This extension has been successfully ${pinned ? "pinned" : "unpinned"}!`);
    } else {
      toast.error(`Failed to ${pinned ? "pin" : "unpin"} this extension!`);
    }

    setIsProcessing(false);
    return success;
  };

  const handleDetailsClick = (id: string) => {
    setSelectedExtensionId(id);
  };

  const handleBack = () => {
    setSelectedExtensionId(null);
  };

  const selectedExtension = extensions.find((ext) => ext.id === selectedExtensionId);

  return (
    <InternalPageShell
      title="Extensions"
      subtitle={`${extensions.length} installed`}
      icon={<Puzzle className="size-4" />}
      maxWidth="4xl"
      headerActions={
        !selectedExtension ? (
          <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className="no-underline">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <ExternalLink className="size-3.5" />
              Chrome Web Store
            </Button>
          </a>
        ) : undefined
      }
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {!selectedExtension ? (
          <Card className="lumi-glass-panel">
            <CardContent className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch checked={isDeveloperMode} onCheckedChange={setIsDeveloperMode} disabled id="developer-mode" />
                  <label
                    htmlFor="developer-mode"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Developer mode
                  </label>
                </div>
                {isDeveloperMode && (
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      Load unpacked
                    </Button>
                    <Button variant="outline" size="sm">
                      Pack extension
                    </Button>
                    <Button variant="outline" size="sm">
                      Update
                    </Button>
                  </div>
                )}
              </div>

              {extensions.length > 0 ? (
                <div className="space-y-2">
                  {extensions.map((extension) => (
                    <ExtensionCard
                      key={extension.id}
                      extension={extension}
                      isProcessing={isProcessing}
                      setExtensionEnabled={setExtensionEnabled}
                      onDetailsClick={handleDetailsClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <h3 className="mb-2 text-lg font-medium">No extensions installed</h3>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Install extensions to enhance your browsing experience
                  </p>
                  <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer">
                    <Button className="gap-2">
                      <ExternalLink size={16} />
                      Browse Chrome Web Store
                    </Button>
                  </a>
                </div>
              )}

              <div className="mt-8 border-t border-black/8 py-4 text-center dark:border-white/10">
                <a
                  href={CHROME_WEB_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-sm text-primary hover:text-primary/80"
                >
                  <ExternalLink size={14} />
                  Browse more extensions in the Chrome Web Store
                </a>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="lumi-glass-panel">
            <CardContent className="p-6">
              <ExtensionDetails
                extension={selectedExtension}
                isDeveloperMode={isDeveloperMode}
                isProcessing={isProcessing}
                setExtensionEnabled={setExtensionEnabled}
                setExtensionPinned={setExtensionPinned}
                onBack={handleBack}
              />
            </CardContent>
          </Card>
        )}
      </motion.div>
    </InternalPageShell>
  );
}

function App() {
  return (
    <>
      <title>Extensions</title>
      <ExtensionsProvider>
        <ExtensionsPage />
      </ExtensionsProvider>
    </>
  );
}

export default App;
