import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PendingPasswordSavePrompt } from "~/types/passwords";

interface PasswordsPromptContextValue {
  pendingPrompts: PendingPasswordSavePrompt[];
  acceptPrompt: (promptId: string, username: string, password: string) => Promise<boolean>;
  dismissPrompt: (promptId: string, neverForSite: boolean) => Promise<boolean>;
}

const PasswordsPromptContext = createContext<PasswordsPromptContextValue | null>(null);

export function usePasswordPrompts() {
  const context = useContext(PasswordsPromptContext);
  if (!context) {
    throw new Error("usePasswordPrompts must be used within a PasswordsPromptProvider");
  }
  return context;
}

export function PasswordsPromptProvider({ children }: { children: React.ReactNode }) {
  const [pendingPrompts, setPendingPrompts] = useState<PendingPasswordSavePrompt[]>([]);

  useEffect(() => {
    void lumi.passwords
      .getPendingSavePrompts()
      .then(setPendingPrompts)
      .catch(() => {});
    const unsub = lumi.passwords.onPendingSavePromptsUpdated((prompts) => {
      setPendingPrompts(prompts);
    });
    return () => unsub();
  }, []);

  const acceptPrompt = useCallback(async (promptId: string, username: string, password: string) => {
    return lumi.passwords.acceptSavePrompt(promptId, username, password);
  }, []);

  const dismissPrompt = useCallback(async (promptId: string, neverForSite: boolean) => {
    return lumi.passwords.dismissSavePrompt(promptId, neverForSite);
  }, []);

  const value = useMemo(
    () => ({ pendingPrompts, acceptPrompt, dismissPrompt }),
    [pendingPrompts, acceptPrompt, dismissPrompt]
  );

  return <PasswordsPromptContext.Provider value={value}>{children}</PasswordsPromptContext.Provider>;
}
