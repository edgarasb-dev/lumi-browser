import { Button } from "@/components/ui/button";
import type { Profile } from "~/lumi/interfaces/sessions/profiles";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import {
  Trash2,
  ArrowLeft,
  Settings,
  Globe,
  Save,
  Loader2,
  Plus,
  Box,
  UsersIcon,
  ChevronRight,
  Download
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { SearchEnginesSettings } from "@/components/settings/sections/search/section";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { useSettingsNavigation } from "@/components/settings/settings-layout";

function ProfileRow({ profile, activateEdit }: { profile: Profile; activateEdit: () => void }) {
  return (
    <SettingsRow
      icon={<UsersIcon className="size-4" />}
      label={profile.name}
      description={`ID: ${profile.id}`}
      onClick={activateEdit}
    >
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        Configure
        <ChevronRight className="size-3.5" />
      </span>
    </SettingsRow>
  );
}

function BasicSettingsTab({
  profile,
  editedProfile,
  handleNameChange
}: {
  profile: Profile;
  editedProfile: Profile;
  handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <SettingsGroup title="Profile Details">
      <SettingsRow label="Profile Name" description="Shown when switching windows or creating spaces.">
        <Input
          id="profile-name"
          value={editedProfile.name}
          onChange={handleNameChange}
          placeholder="Enter profile name"
          className="w-56 h-8 text-xs"
        />
      </SettingsRow>
      <SettingsRow label="Profile ID" description="Directory identifier used for isolated cookies & storage.">
        <code className="text-[11px] font-mono text-muted-foreground bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 rounded-md border border-black/[0.05] dark:border-white/[0.08]">
          {profile.id}
        </code>
      </SettingsRow>
    </SettingsGroup>
  );
}

function SpacesTab({
  profile,
  spaces,
  onRefreshSpaces,
  navigateToSpace
}: {
  profile: Profile;
  spaces: Space[];
  onRefreshSpaces: () => void;
  navigateToSpace?: (profileId: string, spaceId: string) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;

    setIsCreating(true);
    try {
      await lumi.spaces.createSpace(profile.id, newSpaceName.trim());
      setNewSpaceName("");
      setCreateDialogOpen(false);
      onRefreshSpaces();
    } catch (error) {
      console.error("Failed to create space:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsGroup
        title="Spaces in This Profile"
        actions={
          <Button onClick={() => setCreateDialogOpen(true)} size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Plus className="size-3.5" /> New Space
          </Button>
        }
      >
        {spaces.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No spaces found in this profile yet.</div>
        ) : (
          spaces.map((space) => (
            <SettingsRow
              key={space.id}
              icon={<Box className="size-4" />}
              label={space.name}
              description={`ID: ${space.id}`}
              onClick={navigateToSpace ? () => navigateToSpace(profile.id, space.id) : undefined}
            >
              {navigateToSpace && <ChevronRight className="size-3.5 text-muted-foreground" />}
            </SettingsRow>
          ))
        )}
      </SettingsGroup>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Space</DialogTitle>
            <DialogDescription>{`Enter a name for the new space in "${profile.name}".`}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="space-name" className="text-right">
                Name
              </Label>
              <Input
                id="space-name"
                placeholder="Enter space name"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating && newSpaceName.trim()) {
                    void handleCreateSpace();
                  }
                }}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateSpace} disabled={isCreating || !newSpaceName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeleteConfirmDialog({
  isOpen,
  onClose,
  profileName,
  isDeleting,
  onConfirm
}: {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  profileName: string;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Profile</DialogTitle>
          <DialogDescription>
            {`Are you sure you want to delete "${profileName}"? All cookies, extensions, and spaces in this profile will be removed.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditor({
  profile,
  onClose,
  onDelete,
  onProfilesUpdate,
  navigateToSpace
}: {
  profile: Profile;
  onClose: () => void;
  onDelete: () => void;
  onProfilesUpdate: () => void;
  navigateToSpace?: (profileId: string, spaceId: string) => void;
}) {
  const [editedProfile, setEditedProfile] = useState<Profile>({ ...profile });
  const [activeTab, setActiveTab] = useState("basic");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLastProfile, setIsLastProfile] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);

  useEffect(() => {
    void lumi.profiles
      .getProfiles()
      .then((allProfiles) => {
        setIsLastProfile(allProfiles.filter((p) => !p.internal).length <= 1);
      })
      .catch(() => {});
  }, []);

  const refreshSpaces = async () => {
    setLoadingSpaces(true);
    try {
      const profileSpaces = await lumi.spaces.getSpacesFromProfile(profile.id);
      setSpaces(profileSpaces);
    } catch (error) {
      console.error("Failed to fetch spaces:", error);
    } finally {
      setLoadingSpaces(false);
    }
  };

  useEffect(() => {
    void refreshSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedFields: Partial<Profile> = {};
      if (editedProfile.name !== profile.name) {
        updatedFields.name = editedProfile.name;
      }
      if (Object.keys(updatedFields).length > 0) {
        await lumi.profiles.updateProfile(profile.id, updatedFields);
        onProfilesUpdate();
      }
      onClose();
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await lumi.profiles.deleteProfile(profile.id);
      onDelete();
      onClose();
    } catch (error) {
      console.error("Failed to delete profile:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 remove-app-drag">
      <div className="lumi-glass-panel rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8 shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="size-9 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <UsersIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{editedProfile.name || profile.name}</h2>
            <p className="text-xs text-muted-foreground">
              Manage profile identity, spaces &amp; search engine settings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isLastProfile}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            title={isLastProfile ? "Cannot delete the last remaining profile" : "Delete profile"}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Horizontal Segmented Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="basic" className="text-xs gap-1.5">
            <Settings className="size-3.5" />
            Details
          </TabsTrigger>
          <TabsTrigger value="spaces" className="text-xs gap-1.5">
            <Box className="size-3.5" />
            Spaces ({spaces.length})
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs gap-1.5">
            <Globe className="size-3.5" />
            Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="m-0">
          <BasicSettingsTab
            profile={profile}
            editedProfile={editedProfile}
            handleNameChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
          />
        </TabsContent>

        <TabsContent value="spaces" className="m-0">
          {loadingSpaces ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">Loading spaces...</div>
          ) : (
            <SpacesTab
              profile={profile}
              spaces={spaces}
              onRefreshSpaces={refreshSpaces}
              navigateToSpace={navigateToSpace}
            />
          )}
        </TabsContent>

        <TabsContent value="search" className="m-0">
          <SearchEnginesSettings embedded />
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen && !isLastProfile}
        onClose={setDeleteDialogOpen}
        profileName={profile.name}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

export interface ProfilesSettingsProps {
  navigateToSpaces?: (profileId: string) => void;
  navigateToSpace?: (profileId: string, spaceId: string) => void;
}

export function ProfilesSettings({ navigateToSpace }: ProfilesSettingsProps) {
  const { jumpToSetting } = useSettingsNavigation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const fetchedProfiles = await lumi.profiles.getProfiles();
      setProfiles(fetchedProfiles.filter((profile) => !profile.internal));
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfiles();
  }, []);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    setIsCreating(true);
    try {
      await lumi.profiles.createProfile(newProfileName.trim());
      setNewProfileName("");
      setCreateDialogOpen(false);
      await fetchProfiles();
    } catch (error) {
      console.error("Failed to create profile:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (activeProfile) {
    return (
      <ProfileEditor
        profile={activeProfile}
        onClose={() => setActiveProfile(null)}
        onDelete={() => setProfiles((prev) => prev.filter((p) => p.id !== activeProfile.id))}
        onProfilesUpdate={fetchProfiles}
        navigateToSpace={navigateToSpace}
      />
    );
  }

  return (
    <div className="space-y-6 remove-app-drag">
      <SettingsSectionHeader
        title="Profiles"
        description="Separate work, personal, and sandbox browsing sessions with isolated storage."
        icon={<UsersIcon className="size-4" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => jumpToSetting("import")} className="gap-1.5">
              <Download className="size-3.5" />
              Import Data
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="size-3.5" />
              New Profile
            </Button>
          </>
        }
      />

      <SettingsGroup title="Browser Profiles">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">Loading profiles...</div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">No user profiles configured.</div>
        ) : (
          profiles.map((profile) => (
            <ProfileRow key={profile.id} profile={profile} activateEdit={() => setActiveProfile(profile)} />
          ))
        )}
      </SettingsGroup>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Profile</DialogTitle>
            <DialogDescription>Enter a name for your new browser profile.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="profile-name" className="text-right">
                Name
              </Label>
              <Input
                id="profile-name"
                placeholder="Enter profile name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating && newProfileName.trim()) {
                    void handleCreateProfile();
                  }
                }}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateProfile} disabled={isCreating || !newProfileName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
