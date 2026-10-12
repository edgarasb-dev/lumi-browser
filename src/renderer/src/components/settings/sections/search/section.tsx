import { useState, useMemo } from "react";
import { useSearchEngines } from "@/components/providers/search-engines-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SearchEnginesSettings() {
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

  // Form states
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
    if (!formSearchUrl.trim()) {
      setFormError("URL is required.");
      return;
    }
    if (!formSearchUrl.includes("%s")) {
      setFormError("Search URL must contain %s in place of query (e.g. https://example.com/search?q=%s).");
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
      toast.error("Failed to add search engine. Please check your inputs.");
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
      toast.success(`Search engine "${formName}" updated`);
      setEditingEngine(null);
    } else {
      toast.error("Failed to update search engine.");
    }
  };

  const handleSetDefault = async (id: string, name: string) => {
    const success = await setDefaultSearchEngine(id);
    if (success) {
      toast.success(`Set ${name} as default search engine`);
    } else {
      toast.error(`Failed to set default search engine`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const success = await deleteSearchEngine(id);
    if (success) {
      toast.success(`Removed "${name}"`);
    } else {
      toast.error("Failed to remove search engine");
    }
  };

  const handleReset = async () => {
    const success = await resetSearchEngines();
    if (success) {
      toast.success("Reset search engines to default");
    } else {
      toast.error("Failed to reset search engines");
    }
  };

  return (
    <div className="space-y-6">
      {/* Default Search Engine Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Default Search Engine</CardTitle>
          <CardDescription>
            Choose the search engine used for searches from the address bar and context menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <span className="font-semibold text-base">{defaultSearchEngine?.name ?? "Google"}</span>
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-md">
                {defaultSearchEngine?.searchUrl ?? "https://www.google.com/search?q=%s"}
              </p>
            </div>
            <div className="w-full sm:w-auto min-w-[200px]">
              <Select
                value={defaultSearchEngine?.id ?? "google"}
                onValueChange={(val) => {
                  const target = searchEngines.find((e) => e.id === val);
                  if (target) handleSetDefault(val, target.name);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select search engine" />
                </SelectTrigger>
                <SelectContent className="remove-app-drag z-popover">
                  {searchEngines.map((engine) => (
                    <SelectItem key={engine.id} value={engine.id}>
                      <span className="flex items-center gap-2">
                        <span>{engine.name}</span>
                        <span className="text-xs text-muted-foreground">({engine.shortcut})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manage Search Engines Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Search Engines</CardTitle>
            <CardDescription>
              Manage built-in search engines and configure your own custom search providers.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} title="Reset to defaults">
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Engine
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search/Filter Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, shortcut, or URL..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Search Engines List */}
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading search engines...</div>
          ) : filteredEngines.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">
              No search engines found matching &quot;{filterQuery}&quot;.
            </div>
          ) : (
            <div className="divide-y rounded-lg border bg-card overflow-hidden">
              {filteredEngines.map((engine) => {
                const isDefault = engine.isDefault;
                return (
                  <div
                    key={engine.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <Globe className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{engine.name}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border">
                            {engine.shortcut}
                          </span>
                          {isDefault && (
                            <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0 font-medium">
                              Default
                            </Badge>
                          )}
                          {!engine.isBuiltIn && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 text-muted-foreground">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-md sm:max-w-lg font-mono">
                          {engine.searchUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {!isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleSetDefault(engine.id, engine.name)}
                        >
                          <Star className="h-3.5 w-3.5 mr-1" />
                          Make default
                        </Button>
                      )}

                      {!engine.isBuiltIn ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="remove-app-drag z-popover">
                            <DropdownMenuItem onClick={() => openEditDialog(engine)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(engine.id, engine.name)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Search Engine Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="remove-app-drag z-popover sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Search Engine</DialogTitle>
            <DialogDescription>
              Add a new custom search engine. Use <code className="text-xs bg-muted px-1 py-0.5 rounded">%s</code> in
              the URL where the search terms should go.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
              <Label htmlFor="engine-shortcut">Shortcut / Keyword</Label>
              <Input
                id="engine-shortcut"
                placeholder="e.g. yt, gh, wiki"
                value={formShortcut}
                onChange={(e) => setFormShortcut(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Type this shortcut in the omnibox followed by your search query.
              </p>
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
              <p className="text-xs text-muted-foreground">Must contain %s as the placeholder for query words.</p>
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

      {/* Edit Search Engine Dialog */}
      <Dialog open={editingEngine !== null} onOpenChange={(open) => !open && setEditingEngine(null)}>
        <DialogContent className="remove-app-drag z-popover sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Search Engine</DialogTitle>
            <DialogDescription>Update search engine parameters.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-shortcut">Shortcut / Keyword</Label>
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
