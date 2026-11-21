import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Fingerprint,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { InternalPageShell } from "@/components/main/internal-page-shell";
import { WebsiteFavicon } from "@/components/main/website-favicon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Profile } from "~/lumi/interfaces/sessions/profiles";
import type { NeverSaveSiteEntry, PasswordManagerStatus, SavedPasswordSummary } from "~/types/passwords";

function PasswordsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState<string>("main");
  const [status, setStatus] = useState<PasswordManagerStatus>({ encryptionAvailable: false, touchIdAvailable: false });
  const [items, setItems] = useState<SavedPasswordSummary[]>([]);
  const [neverSaveSites, setNeverSaveSites] = useState<NeverSaveSiteEntry[]>([]);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOrigin, setFormOrigin] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formNote, setFormNote] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(false);

  const loadInitialProfile = useCallback(async () => {
    try {
      const [allProfiles, usingProfile, mgrStatus] = await Promise.all([
        lumi.profiles.getProfiles(),
        lumi.profiles.getUsingProfile().catch(() => "main"),
        lumi.passwords.getStatus()
      ]);
      const visible = allProfiles.filter((p) => !p.internal);
      setProfiles(visible);
      setStatus(mgrStatus);
      const preferred = visible.find((p) => p.id === usingProfile)?.id ?? visible[0]?.id ?? "main";
      setProfileId(preferred);
    } catch {
      setProfileId("main");
    }
  }, []);

  const refreshVault = useCallback(async (pid: string) => {
    setIsLoading(true);
    try {
      const [list, neverList] = await Promise.all([lumi.passwords.list(pid), lumi.passwords.listNeverSaveSites(pid)]);
      setItems(list);
      setNeverSaveSites(neverList);
      setRevealedPasswords({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialProfile();
  }, [loadInitialProfile]);

  useEffect(() => {
    if (profileId) {
      void refreshVault(profileId);
    }
  }, [profileId, refreshVault]);

  // Support deep link ?add=<url> from Address Bar Key button
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addUrl = params.get("add");
    if (addUrl) {
      setEditingId(null);
      setFormOrigin(addUrl);
      setFormTitle("");
      setFormUsername("");
      setFormPassword("");
      setFormNote("");
      setShowFormPassword(false);
      setEditorOpen(true);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.host.toLowerCase().includes(q) ||
        item.origin.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q))
    );
  }, [items, search]);

  const handleRevealToggle = async (item: SavedPasswordSummary) => {
    if (revealedPasswords[item.id] !== undefined) {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }
    const res = await lumi.passwords.reveal(item.id, profileId);
    if (!res.authenticated || res.password === undefined) {
      toast.error(res.error || "Authentication required to reveal password.");
      return;
    }
    setRevealedPasswords((prev) => ({ ...prev, [item.id]: res.password! }));
  };

  const handleCopyPassword = async (item: SavedPasswordSummary) => {
    const res = await lumi.passwords.copyPassword(item.id, profileId);
    if (!res.authenticated || !res.copied) {
      toast.error(res.error || "Authentication required to copy password.");
      return;
    }
    toast.success(`Password for ${item.host} copied.`);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormOrigin("https://");
    setFormTitle("");
    setFormUsername("");
    setFormPassword("");
    setFormNote("");
    setShowFormPassword(false);
    setEditorOpen(true);
  };

  const handleOpenEdit = async (item: SavedPasswordSummary) => {
    let secret = revealedPasswords[item.id];
    if (secret === undefined) {
      const res = await lumi.passwords.reveal(item.id, profileId);
      if (!res.authenticated || res.password === undefined) {
        toast.error(res.error || "Authentication required to edit saved password.");
        return;
      }
      secret = res.password;
    }

    setEditingId(item.id);
    setFormOrigin(item.origin);
    setFormTitle(item.title ?? "");
    setFormUsername(item.username);
    setFormPassword(secret);
    setFormNote(item.note ?? "");
    setShowFormPassword(false);
    setEditorOpen(true);
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrigin.trim() || !formPassword) {
      toast.error("Site URL and password are required.");
      return;
    }
    try {
      await lumi.passwords.save(
        {
          id: editingId ?? undefined,
          origin: formOrigin.trim(),
          title: formTitle.trim() || null,
          username: formUsername.trim(),
          password: formPassword,
          note: formNote.trim() || null
        },
        profileId
      );
      setEditorOpen(false);
      await refreshVault(profileId);
      toast.success(editingId ? "Login updated." : "Login saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed saving login.");
    }
  };

  const handleGenerateInForm = async () => {
    const generated = await lumi.passwords.generate({ length: 18 });
    setFormPassword(generated);
    setShowFormPassword(true);
  };

  const handleDelete = async (item: SavedPasswordSummary) => {
    const ok = await lumi.passwords.delete(item.id, profileId);
    if (ok) {
      await refreshVault(profileId);
      toast.success(`Removed login for ${item.host}.`);
    }
  };

  const handleImportCsv = async () => {
    const res = await lumi.passwords.importCsv(profileId);
    if (res.canceled) return;
    if (res.error) {
      toast.error(res.error);
      return;
    }
    await refreshVault(profileId);
    toast.success(`Imported ${res.imported} password(s)${res.skipped > 0 ? ` (${res.skipped} skipped)` : ""}.`);
  };

  const handleExportCsv = async () => {
    const res = await lumi.passwords.exportCsv(profileId);
    if (res.canceled) return;
    if (!res.authenticated || res.error) {
      toast.error(res.error || "Export cancelled or authentication failed.");
      return;
    }
    toast.success(`Exported ${res.exported} password(s) to CSV.`);
  };

  const handleRemoveNeverSave = async (entry: NeverSaveSiteEntry) => {
    const ok = await lumi.passwords.removeNeverSaveSite(entry.id, profileId);
    if (ok) {
      await refreshVault(profileId);
    }
  };

  return (
    <InternalPageShell
      title="Passwords"
      subtitle={`${items.length.toLocaleString()} saved login${items.length === 1 ? "" : "s"}`}
      icon={<KeyRound className="size-4" />}
      maxWidth="4xl"
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search websites or usernames..."
            className="pl-9 h-9 bg-black/[0.03] dark:bg-white/[0.05]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      }
      headerActions={
        <div className="flex items-center gap-2">
          {profiles.length > 1 && (
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={!status.encryptionAvailable}
            title={!status.encryptionAvailable ? "OS Keychain / Keyring encryption is required" : undefined}
            onClick={() => void handleImportCsv()}
          >
            <FileUp className="size-3.5" />
            Import CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={items.length === 0}
            onClick={() => void handleExportCsv()}
          >
            <Download className="size-3.5" />
            Export
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={!status.encryptionAvailable}
            title={!status.encryptionAvailable ? "OS Keychain / Keyring encryption is required" : undefined}
            onClick={handleOpenAdd}
          >
            <Plus className="size-3.5" />
            Add Login
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-foreground/85 font-medium">
            <ShieldCheck className={`size-4 ${status.encryptionAvailable ? "text-emerald-500" : "text-amber-500"}`} />
            {status.encryptionAvailable
              ? "Encrypted via OS Keychain (zero plaintext fallback)"
              : "OS Keychain / Keyring required — plaintext storage disabled"}
          </span>
          {status.touchIdAvailable && (
            <span className="inline-flex items-center gap-1.5 text-indigo-500 dark:text-indigo-300 font-medium">
              <Fingerprint className="size-4" />
              Touch ID required to reveal or export
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void lumi.windows.openSettings("import")}
          className="text-xs font-medium text-primary hover:underline cursor-pointer"
        >
          Import from Chrome / Firefox…
        </button>
      </div>

      {isLoading ? (
        <Card className="bg-card/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading saved passwords...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-card/60">
          <CardContent className="py-14 flex flex-col items-center justify-center text-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {search ? "No matching passwords found" : "No saved passwords in this profile"}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {search
                  ? "Try clearing your search filter or checking another profile."
                  : "Sign into websites to save logins automatically, import from Chrome or a CSV file, or add one manually."}
              </p>
            </div>
            {!search && (
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => void lumi.windows.openSettings("import")}>
                  Import from Browser
                </Button>
                <Button size="sm" onClick={handleOpenAdd}>
                  Add Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/70 overflow-hidden py-0">
          <div className="divide-y divide-border/60">
            {filtered.map((item) => {
              const revealed = revealedPasswords[item.id];
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                      <WebsiteFavicon url={item.origin} className="size-5 rounded-sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{item.title || item.host}</span>
                        <span className="text-[11px] text-muted-foreground truncate hidden md:inline">
                          {item.origin}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{item.username || "(no username)"}</span>
                        {item.username && (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(item.username);
                              toast.success("Username copied.");
                            }}
                            title="Copy username"
                            className="p-0.5 rounded hover:text-foreground cursor-pointer"
                          >
                            <Copy className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end shrink-0">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-black/[0.04] dark:bg-white/[0.06] text-foreground/90 max-w-44 truncate">
                      {revealed !== undefined ? revealed : "••••••••••••"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title={revealed !== undefined ? "Hide password" : "Reveal password"}
                      onClick={() => void handleRevealToggle(item)}
                    >
                      {revealed !== undefined ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Copy password"
                      onClick={() => void handleCopyPassword(item)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Edit login"
                      onClick={() => void handleOpenEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      title="Delete login"
                      onClick={() => void handleDelete(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {neverSaveSites.length > 0 && (
        <div className="space-y-2 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Never Saved ({neverSaveSites.length})
          </h2>
          <Card className="bg-card/60 py-0">
            <div className="divide-y divide-border/60">
              {neverSaveSites.map((site) => (
                <div key={site.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-xs font-medium text-foreground">{site.host}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void handleRemoveNeverSave(site)}
                  >
                    Allow prompts again
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Saved Login" : "Add Saved Login"}</DialogTitle>
            <DialogDescription>
              Credentials are encrypted per profile and protected by your OS Keychain.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSaveEditor(e)} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pw-origin">Website URL</Label>
              <Input
                id="pw-origin"
                value={formOrigin}
                onChange={(e) => setFormOrigin(e.target.value)}
                placeholder="https://example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw-title">Name (optional)</Label>
              <Input
                id="pw-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Example Account"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw-user">Username or Email</Label>
              <Input
                id="pw-user"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw-secret">Password</Label>
                <button
                  type="button"
                  onClick={() => void handleGenerateInForm()}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                >
                  <Sparkles className="size-3" />
                  Generate strong password
                </button>
              </div>
              <div className="relative flex items-center">
                <Input
                  id="pw-secret"
                  type={showFormPassword ? "text" : "password"}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="pr-9 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword((v) => !v)}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showFormPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw-note">Note (optional)</Label>
              <Input
                id="pw-note"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Optional note"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? "Update" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </InternalPageShell>
  );
}

export default PasswordsPage;
