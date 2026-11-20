import { useState, useMemo } from "react";
import { useSearchEngines } from "@/components/providers/search-engines-provider";
import { useSettingsNavigation } from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, MoreVertical, Star, Trash2, Edit2, RotateCcw, Globe } from "lucide-react";
import { toast } from "sonner";
import type { SearchEngine, SearchEngineInput } from "~/types/search-engines";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { cn } from "@/lib/utils";

export function SearchEnginesSettings({ embedded = false }: { embedded?: boolean }) {
  const { highlightedRowId } = useSettingsNavigation();
  const {
    searchEngines,
    defaultSearchEngine,
    isLoading,
    setDefaultSearchEngine,
    addSearchEngine,
    updateSearchEngine,
    deleteSearchEngine,
    resetSearchEngines
  } = useSearchEngines();

  const [filterQuery, setFilterQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEngine, setEditingEngine] = useState<SearchEngine | null>(null);

  const [formName, setFormName] = useState("");
  const [formShortcut, setFormShortcut] = useState("");
  const [formSearchUrl, setFormSearchUrl] = useState("");
  const [formSuggestUrl, setFormSuggestUrl] = useState("");
  const [formError, setFormError] = useState("");

  const filteredEngines = useMemo(() => {
    if (!filterQuery.trim()) return searchEngines;
    const query = filterQuery.toLowerCase();
    return searchEngines.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.shortcut.toLowerCase().includes(query) ||
        e.searchUrl.toLowerCase().includes(query)
    );
  }, [searchEngines, filterQuery]);

  const openAddDialog = () => {
    setFormName("");
    setFormShortcut("");
    setFormSearchUrl("");
    setFormSuggestUrl("");
    setFormError("");
    setIsAddOpen(true);
  };

  const openEditDialog = (engine: SearchEngine) => {
    setEditingEngine(engine);
    setFormName(engine.name);
    setFormShortcut(engine.shortcut);
    setFormSearchUrl(engine.searchUrl);
    setFormSuggestUrl(engine.suggestUrl || "");
    setFormError("");
  };

  const handleSaveAdd = async () => {
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!formSearchUrl.trim() || !formSearchUrl.includes("%s")) {
      setFormError("Search URL must contain %s in place of query.");
      return;
    }

    const input: SearchEngineInput = {
      name: formName.trim(),
      shortcut: formShortcut.trim().toLowerCase() || formName.trim().charAt(0).toLowerCase(),
      searchUrl: formSearchUrl.trim(),
      suggestUrl: formSuggestUrl.trim() || undefined
    };

    const created = await addSearchEngine(input);
    if (created) {
      toast.success(`Search engine "${created.name}" added`);
      setIsAddOpen(false);
    } else {
      toast.error("Failed to add search engine.");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEngine) return;
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!formSearchUrl.trim() || !formSearchUrl.includes("%s")) {
      setFormError("Search URL must contain %s in place of query.");
      return;
    }

    const updates: Partial<SearchEngineInput> = {
      name: formName.trim(),
      shortcut: formShortcut.trim().toLowerCase() || formName.trim().charAt(0).toLowerCase(),
      searchUrl: formSearchUrl.trim(),
      suggestUrl: formSuggestUrl.trim() || undefined
    };

    const success = await updateSearchEngine(editingEngine.id, updates);
    if (success) {
      toast.success(`Updated "${formName.trim()}"`);
      setEditingEngine(null);
    } else {
      toast.error("Failed to update search engine.");
    }
  };

  const handleSetDefault = async (id: string, name: string) => {
    const success = await setDefaultSearchEngine(id);
    if (success) {
      toast.success(`Default search set to ${name}`);
    } else {
      toast.error("Failed to update default search engine.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const success = await deleteSearchEngine(id);
    if (success) {
      toast.success(`Removed "${name}"`);
    } else {
      toast.error("Failed to remove search engine.");
    }
  };

  const handleReset = async () => {
    const success = await resetSearchEngines();
    if (success) {
      toast.success("Reset search engines to defaults");
    } else {
      toast.error("Failed to reset search engines.");
    }
  };

  return (
    <div className="space-y-6 remove-app-drag">
      {!embedded && (
        <SettingsSectionHeader
          title="Search Engines"
          description="Set your default provider and configure @keyword shortcuts for the Omnibox."
          icon={<Search className="size-4" />}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} title="Reset to defaults">
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="size-3.5" />
                Add Engine
              </Button>
            </div>
          }
        />
      )}

      {/* Default Provider */}
      <SettingsGroup title="Default Omnibox Engine">
        <SettingsRow
          id="defaultSearchEngine"
          highlighted={highlightedRowId === "defaultSearchEngine"}
          icon={<Globe className="size-4 text-primary" />}
          label={defaultSearchEngine?.name ?? "Google"}
          description={defaultSearchEngine?.searchUrl ?? "https://www.google.com/search?q=%s"}
        >
          <Select
            value={defaultSearchEngine?.id ?? "google"}
            onValueChange={(val) => {
              const target = searchEngines.find((e) => e.id === val);
              if (target) void handleSetDefault(val, target.name);
            }}
          >
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Select search engine" />
            </SelectTrigger>
            <SelectContent className="remove-app-drag z-popover">
              {searchEngines.map((engine) => (
                <SelectItem key={engine.id} value={engine.id} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span>{engine.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">@{engine.shortcut}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsGroup>

      {/* Engine Directory */}
      <SettingsGroup
        title="Configured Search Providers"
        description="Type @keyword + query in the address bar to search directly with any engine."
        actions={
          embedded ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAddDialog}>
              <Plus className="size-3.5" />
              Add Engine
            </Button>
          ) : undefined
        }
      >
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter search providers by name, shortcut, or URL..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading search engines...</div>
        ) : filteredEngines.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No search engines matching &quot;{filterQuery}&quot;.
          </div>
        ) : (
          filteredEngines.map((engine) => {
            const isDefault = engine.isDefault;
            return (
              <div
                key={engine.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 transition-colors",
                  isDefault ? "bg-primary/[0.04]" : "hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center shrink-0">
                    <Globe className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{engine.name}</span>
                      <span className="lumi-kbd text-[10px] h-4 px-1.5 min-w-0">@{engine.shortcut}</span>
                      {isDefault && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0">
                          Default
                        </Badge>
                      )}
                      {!engine.isBuiltIn && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 text-muted-foreground">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate max-w-md font-mono">{engine.searchUrl}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {!isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => void handleSetDefault(engine.id, engine.name)}
                    >
                      <Star className="size-3" />
                      Set Default
                    </Button>
                  )}

                  {!engine.isBuiltIn && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="remove-app-drag z-popover">
                        <DropdownMenuItem onClick={() => openEditDialog(engine)}>
                          <Edit2 className="size-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void handleDelete(engine.id, engine.name)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })
        )}
      </SettingsGroup>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="remove-app-drag z-popover sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Search Engine</DialogTitle>
            <DialogDescription>
              Use <code className="text-xs bg-muted px-1 py-0.5 rounded">%s</code> where the query should be inserted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="engine-name">Name</Label>
              <Input
                id="engine-name"
                placeholder="e.g. YouTube, GitHub, Wikipedia"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engine-shortcut">Keyword</Label>
              <Input
                id="engine-shortcut"
                placeholder="e.g. yt, gh, wiki"
                value={formShortcut}
                onChange={(e) => setFormShortcut(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engine-url">
                Search URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="engine-url"
                placeholder="https://www.youtube.com/results?search_query=%s"
                value={formSearchUrl}
                onChange={(e) => setFormSearchUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="engine-suggest">Suggestion URL (Optional)</Label>
              <Input
                id="engine-suggest"
                placeholder="https://suggestqueries.google.com/complete/search?client=chrome&q=%s"
                value={formSuggestUrl}
                onChange={(e) => setFormSuggestUrl(e.target.value)}
              />
            </div>
            {formError && <p className="text-xs text-destructive font-medium">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdd}>Save Engine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editingEngine !== null} onOpenChange={(open) => !open && setEditingEngine(null)}>
        <DialogContent className="remove-app-drag z-popover sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Search Engine</DialogTitle>
            <DialogDescription>Update custom search engine parameters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-shortcut">Keyword</Label>
              <Input id="edit-shortcut" value={formShortcut} onChange={(e) => setFormShortcut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-url">
                Search URL <span className="text-destructive">*</span>
              </Label>
              <Input id="edit-url" value={formSearchUrl} onChange={(e) => setFormSearchUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-suggest">Suggestion URL (Optional)</Label>
              <Input id="edit-suggest" value={formSuggestUrl} onChange={(e) => setFormSuggestUrl(e.target.value)} />
            </div>
            {formError && <p className="text-xs text-destructive font-medium">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEngine(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Update Engine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
