import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FileUp, Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/components/providers/settings-provider";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { useSettingsNavigation } from "@/components/settings/settings-layout";
import type { PasswordManagerStatus } from "~/types/passwords";

export function PasswordsSettings() {
  const { getSetting, setSetting } = useSettings();
  const { jumpToSetting, highlightedRowId } = useSettingsNavigation();
  const [status, setStatus] = useState<PasswordManagerStatus>({ encryptionAvailable: false, touchIdAvailable: false });
  const [savedCount, setSavedCount] = useState<number>(0);

  const offerSave = getSetting<boolean>("passwordsOfferSave") ?? true;
  const autofill = getSetting<boolean>("passwordsAutofill") ?? true;

  const loadVaultSummary = useCallback(async () => {
    try {
      const [s, items] = await Promise.all([lumi.passwords.getStatus(), lumi.passwords.list()]);
      setStatus(s);
      setSavedCount(items.length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadVaultSummary();
  }, [loadVaultSummary]);

  const handleImportCsv = async () => {
    const res = await lumi.passwords.importCsv();
    if (res.canceled) return;
    if (res.error) {
      toast.error(res.error);
      return;
    }
    await loadVaultSummary();
    toast.success(`Imported ${res.imported} password(s) from CSV.`);
  };

  const handleExportCsv = async () => {
    const res = await lumi.passwords.exportCsv();
    if (res.canceled) return;
    if (!res.authenticated || res.error) {
      toast.error(res.error || "Authentication required or export failed.");
      return;
    }
    toast.success(`Exported ${res.exported} password(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="Passwords"
        description="Manage encrypted saved logins, autofill suggestions, and browser/CSV imports."
      />

      <SettingsGroup title="Password Vault">
        <SettingsRow
          id="openPasswordVault"
          highlighted={highlightedRowId === "openPasswordVault"}
          icon={<KeyRound className="size-4" />}
          label="Open Password Manager"
          description={`${savedCount.toLocaleString()} saved login${savedCount === 1 ? "" : "s"} in the active profile.`}
        >
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => void lumi.tabs.newTab("lumi://passwords", true)}
          >
            <ExternalLink className="size-3.5" />
            Manage Passwords
          </Button>
        </SettingsRow>

        <SettingsRow
          icon={status.touchIdAvailable ? <Fingerprint className="size-4" /> : <ShieldCheck className="size-4" />}
          label="Vault Security"
          description={
            status.touchIdAvailable
              ? "Passwords are encrypted with OS Keychain (plaintext storage disabled) and require Touch ID to reveal or export."
              : status.encryptionAvailable
                ? "Passwords are encrypted locally via OS Keychain / Keyring. Plaintext storage is disabled."
                : "OS Keychain / Keyring encryption is unavailable. Password saving is paused to prevent plaintext storage."
          }
        >
          <span
            className={
              status.encryptionAvailable
                ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                : "text-xs font-medium text-amber-600 dark:text-amber-400"
            }
          >
            {status.encryptionAvailable ? "OS Encrypted" : "Keyring Required"}
          </span>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Autofill & Saving">
        <SettingsRow
          id="passwordsOfferSave"
          highlighted={highlightedRowId === "passwordsOfferSave"}
          label="Offer to Save Passwords"
          description="Show a non-intrusive prompt to save or update credentials when signing in."
          onClick={() => void setSetting("passwordsOfferSave", !offerSave)}
        >
          <Switch
            checked={Boolean(offerSave)}
            onCheckedChange={(val) => void setSetting("passwordsOfferSave", val)}
            onClick={(e) => e.stopPropagation()}
          />
        </SettingsRow>

        <SettingsRow
          id="passwordsAutofill"
          highlighted={highlightedRowId === "passwordsAutofill"}
          label="Autofill Saved Passwords"
          description="Show saved logins and strong password generator suggestions on website forms."
          onClick={() => void setSetting("passwordsAutofill", !autofill)}
        >
          <Switch
            checked={Boolean(autofill)}
            onCheckedChange={(val) => void setSetting("passwordsAutofill", val)}
            onClick={(e) => e.stopPropagation()}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Import & Export">
        <SettingsRow
          label="Import from Chrome or Firefox"
          description="Import saved passwords (plus cookies and sessions) directly from another browser."
        >
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => jumpToSetting("import", "browserImporter")}
          >
            Open Browser Importer
          </Button>
        </SettingsRow>

        <SettingsRow
          label="CSV Passwords File"
          description="Import or export a standard Chrome-compatible passwords CSV file."
        >
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => void handleImportCsv()}>
              <FileUp className="size-3.5" />
              Import CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              disabled={savedCount === 0}
              onClick={() => void handleExportCsv()}
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
