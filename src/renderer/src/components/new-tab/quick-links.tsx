import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, X, Save, RotateCcw, History, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WebsiteFavicon } from "@/components/main/website-favicon";
import { cn } from "@/lib/utils";

// Interface for quick links
export interface QuickLink {
  id: string;
  name: string;
  url: string;
  favicon?: string;
  extraClass?: string;
}

// Default quick links
export const defaultQuickLinks: QuickLink[] = [
  {
    id: "google",
    name: "Google",
    url: "https://www.google.com",
    favicon: "https://www.google.com/favicon.ico"
  },
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com",
    favicon: "https://www.youtube.com/favicon.ico"
  },
  {
    id: "gmail",
    name: "Gmail",
    url: "https://mail.google.com",
    favicon: "https://www.google.com/gmail/about/static/images/logo-gmail.png"
  },
  {
    id: "netflix",
    name: "Netflix",
    url: "https://netflix.com",
    favicon: "https://www.netflix.com/favicon.ico"
  },
  {
    id: "history",
    name: "History",
    url: "lumi://history"
  }
];

interface QuickLinksProps {
  className?: string;
}

export function QuickLinks({ className = "" }: QuickLinksProps) {
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [mounted, setMounted] = useState(false);

  // Load quicklinks from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedLinks = localStorage.getItem("quickLinks");
    if (savedLinks) {
      try {
        const parsedLinks = JSON.parse(savedLinks);
        setQuickLinks(parsedLinks);
      } catch (error) {
        console.error("Failed to parse saved links:", error);
        setQuickLinks(defaultQuickLinks);
      }
    } else {
      setQuickLinks(defaultQuickLinks);
    }
  }, []);

  // Save quicklinks to localStorage when they change
  useEffect(() => {
    if (mounted && quickLinks.length > 0) {
      localStorage.setItem("quickLinks", JSON.stringify(quickLinks));
    }
  }, [quickLinks, mounted]);

  const handleAddLink = () => {
    if (newLinkName.trim() && newLinkUrl.trim()) {
      let url = newLinkUrl.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("lumi://")) {
        url = "https://" + url;
      }

      const newLink: QuickLink = {
        id: Date.now().toString(),
        name: newLinkName.trim(),
        url
      };

      setQuickLinks([...quickLinks, newLink]);
      setNewLinkName("");
      setNewLinkUrl("");
      setIsAddDialogOpen(false);
    }
  };

  const handleDeleteLink = (id: string) => {
    setQuickLinks(quickLinks.filter((link) => link.id !== id));
  };

  const handleResetToDefaults = () => {
    setQuickLinks(defaultQuickLinks);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      // Reset form when dialog is closed
      setNewLinkName("");
      setNewLinkUrl("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className={cn("mx-auto w-full max-w-3xl", className)}
    >
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Speed Dial</h2>
        <div className="flex gap-1.5">
          <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2.5 text-xs">
                <Plus className="size-3.5" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-md">
              <DialogHeader>
                <DialogTitle>Add Speed Dial Link</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="name" className="text-right text-sm">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                    className="col-span-3"
                    placeholder="GitHub"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label htmlFor="url" className="text-right text-sm">
                    URL
                  </Label>
                  <Input
                    id="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="col-span-3"
                    placeholder="https://github.com"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddLink} disabled={!newLinkName.trim() || !newLinkUrl.trim()}>
                  <Save className="mr-1.5 size-4" />
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToDefaults}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            title="Reset Speed Dial to defaults"
          >
            <RotateCcw className="size-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {quickLinks.map((link) => (
          <div key={link.id} className="group relative">
            <button
              type="button"
              onClick={() => handleDeleteLink(link.id)}
              className="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full bg-zinc-900/80 text-white opacity-0 shadow-xs transition-opacity group-hover:opacity-100 hover:bg-destructive dark:bg-zinc-800"
              aria-label={`Remove ${link.name}`}
            >
              <X className="size-3" />
            </button>
            <a
              href={link.url}
              className="lumi-glass-panel flex flex-col items-center justify-center gap-2 px-3 py-3.5 text-center no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
            >
              <div className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-white/85 shadow-xs dark:bg-white/10">
                {link.url.startsWith("lumi://history") ? (
                  <History className="size-5 text-amber-500" />
                ) : link.url.startsWith("lumi://downloads") ? (
                  <Download className="size-5 text-primary" />
                ) : link.url.startsWith("lumi://bangs") ? (
                  <Sparkles className="size-5 text-violet-500" />
                ) : (
                  <WebsiteFavicon url={link.url} favicon={link.favicon} className="size-5 rounded-xs" />
                )}
              </div>
              <div className="w-full truncate text-xs font-medium text-foreground">{link.name}</div>
            </a>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
