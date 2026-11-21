import { memo, useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Settings2, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useAddressUrl, useFocusedTab } from "@/components/providers/tabs-provider";
import { cn } from "@/lib/utils";
import type { SiteCredentialMatch } from "~/types/passwords";

export const PasswordToolbarButton = memo(function PasswordToolbarButton() {
  const addressUrl = useAddressUrl();
  const focusedTab = useFocusedTab();
  const { isCurrentSpaceLight } = useSpaces();
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<SiteCredentialMatch[]>([]);
  const [generated, setGenerated] = useState<string>("");

  const isWebUrl = Boolean(addressUrl && (addressUrl.startsWith("http://") || addressUrl.startsWith("https://")));
  const focusedProfileId = focusedTab?.profileId;

  const refreshMatches = useCallback(async () => {
    if (!isWebUrl || !addressUrl) {
      setMatches([]);
      return;
    }
    try {
      const creds = await lumi.passwords.getForSite(addressUrl, focusedProfileId);
      setMatches(creds);
    } catch {
      setMatches([]);
    }
  }, [isWebUrl, addressUrl, focusedProfileId]);

  useEffect(() => {
    void refreshMatches();
  }, [refreshMatches]);

  useEffect(() => {
    if (open) {
      void refreshMatches();
      void lumi.passwords
        .generate({ length: 18 })
        .then(setGenerated)
        .catch(() => {});
    }
  }, [open, refreshMatches]);

  const hasSaved = matches.length > 0;
  if (!isWebUrl || (!hasSaved && !open)) return null;

  const darkClass = isCurrentSpaceLight ? "" : "dark";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={true}
        onClick={(e) => e.stopPropagation()}
        title={hasSaved ? `${matches.length} saved password(s)` : "Passwords"}
        className={cn(
          "size-6 flex items-center justify-center rounded-md shrink-0 transition-colors cursor-pointer relative",
          hasSaved
            ? "text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/15"
            : "text-black/40 dark:text-white/40 hover:text-black/80 dark:hover:text-white/85 hover:bg-black/10 dark:hover:bg-white/10"
        )}
      >
        <KeyRound className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2.5 select-none space-y-2" positionerClassName={darkClass}>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-foreground">Passwords for this site</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void lumi.tabs.newTab("lumi://passwords", true);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Settings2 className="size-3" />
            Manage
          </button>
        </div>

        {matches.length > 0 ? (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {matches.map((cred) => (
              <button
                key={cred.id}
                type="button"
                onClick={async () => {
                  if (focusedTab?.id) {
                    await lumi.passwords.fillCredentialInTab(focusedTab.id, cred.id);
                  }
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="size-7 rounded-md bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <KeyRound className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{cred.username || "(no username)"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">Click to autofill · {cred.host}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 py-2 text-xs text-muted-foreground">No saved passwords match this site yet.</p>
        )}

        <div className="border-t border-border/60 pt-2 space-y-1">
          {generated && focusedTab?.id && (
            <button
              type="button"
              onClick={async () => {
                await lumi.passwords.fillGeneratedPasswordInTab(focusedTab.id, generated);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Sparkles className="size-3.5 text-indigo-400" />
                Fill generated password
              </span>
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-24">{generated}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              const q = addressUrl ? `?add=${encodeURIComponent(addressUrl)}` : "";
              void lumi.tabs.newTab(`lumi://passwords${q}`, true);
            }}
            className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            Add login manually
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
