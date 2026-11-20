import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, OrbitIcon } from "lucide-react";
import { SpaceCard } from "./space-card";
import { UILayer } from "~/layers";
import { SpaceEditor } from "./space-editor";
import { CreateSpaceDialog } from "./space-dialogs";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import type { Profile } from "~/lumi/interfaces/sessions/profiles";
import { Reorder, useDragControls } from "motion/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsGroup, SettingsSectionHeader } from "@/components/settings/components/setting-row";

export interface SpacesSettingsProps {
  initialSelectedProfile?: string | null;
  initialSelectedSpace?: string | null;
}

export function SpacesSettings({ initialSelectedProfile, initialSelectedSpace }: SpacesSettingsProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(initialSelectedProfile || null);

  useEffect(() => {
    if (initialSelectedProfile) {
      setSelectedProfile(initialSelectedProfile);
    }
  }, [initialSelectedProfile]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedProfiles, fetchedSpaces] = await Promise.all([
        lumi.profiles.getProfiles(),
        lumi.spaces.getSpaces()
      ]);
      const internalProfileIds = new Set(
        fetchedProfiles.filter((profile) => profile.internal).map((profile) => profile.id)
      );
      const nonInternal = fetchedProfiles.filter((profile) => !profile.internal);
      setProfiles(nonInternal);
      setSpaces(fetchedSpaces.filter((space) => !internalProfileIds.has(space.profileId)));

      if (initialSelectedSpace) {
        const selectedSpace = fetchedSpaces.find((space) => space.id === initialSelectedSpace);
        if (selectedSpace) {
          setActiveSpace(selectedSpace);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [initialSelectedSpace]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (initialSelectedSpace && spaces.length > 0) {
      const selectedSpace = spaces.find((space) => space.id === initialSelectedSpace);
      if (selectedSpace) {
        setActiveSpace(selectedSpace);
      }
    }
  }, [initialSelectedSpace, spaces]);

  const handleDeleteSpace = async (deletedSpace: Space) => {
    setSpaces((prev) => prev.filter((space) => space.id !== deletedSpace.id));
  };

  const handleCreateSpace = async () => {
    const targetProfile = selectedProfile || profiles[0]?.id;
    if (!newSpaceName.trim() || !targetProfile) return;

    setIsCreating(true);
    try {
      await lumi.spaces.createSpace(targetProfile, newSpaceName.trim());
      setNewSpaceName("");
      setCreateDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Failed to create space:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleReorder = async (reorderedSpaces: Space[]) => {
    setSpaces(reorderedSpaces);
    const orderMap = reorderedSpaces.map((space, index) => ({
      profileId: space.profileId,
      spaceId: space.id,
      order: index
    }));
    try {
      await lumi.spaces.reorderSpaces(orderMap);
    } catch (error) {
      console.error("Failed to reorder spaces:", error);
    }
  };

  const filteredSpaces = selectedProfile ? spaces.filter((space) => space.profileId === selectedProfile) : spaces;
  const selectedProfileName = selectedProfile
    ? profiles.find((p) => p.id === selectedProfile)?.name || "Selected Profile"
    : "All Profiles";

  if (activeSpace) {
    return (
      <SpaceEditor
        space={activeSpace}
        onClose={() => setActiveSpace(null)}
        onDelete={() => handleDeleteSpace(activeSpace)}
        onSpacesUpdate={fetchData}
      />
    );
  }

  return (
    <div className="space-y-6 remove-app-drag">
      <SettingsSectionHeader
        title="Spaces"
        description={`Organize contexts, gradients, and tab groups (${selectedProfileName}).`}
        icon={<OrbitIcon className="size-4" />}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedProfile || "all"}
              onValueChange={(value) => setSelectedProfile(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Filter profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Profiles</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                if (!selectedProfile && profiles[0]) {
                  setSelectedProfile(profiles[0].id);
                }
                setCreateDialogOpen(true);
              }}
              size="sm"
            >
              <Plus className="size-3.5" />
              New Space
            </Button>
          </div>
        }
      />

      <SettingsGroup title="Configured Spaces" description="Drag the grip handle to reorder spaces in the switcher.">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">Loading spaces...</div>
        ) : filteredSpaces.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No spaces found. Click New Space to create one.
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={filteredSpaces}
            onReorder={handleReorder}
            className="divide-y divide-black/[0.06] dark:divide-white/[0.07]"
            layoutScroll
            layout
            transition={{ type: "spring", bounce: 0.1, duration: 0.25 }}
          >
            {filteredSpaces.map((space) => (
              <DraggableSpaceRow key={space.id} space={space} activateEdit={() => setActiveSpace(space)} />
            ))}
          </Reorder.Group>
        )}
      </SettingsGroup>

      <CreateSpaceDialog
        isOpen={createDialogOpen}
        onClose={setCreateDialogOpen}
        spaceName={newSpaceName}
        setSpaceName={setNewSpaceName}
        isCreating={isCreating}
        onCreate={handleCreateSpace}
        profiles={profiles}
        selectedProfile={selectedProfile}
        setSelectedProfile={setSelectedProfile}
      />
    </div>
  );
}

function DraggableSpaceRow({ space, activateEdit }: { space: Space; activateEdit: () => void }) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Reorder.Item
      value={space}
      dragControls={dragControls}
      className="list-none"
      whileDrag={{ scale: 1.01, zIndex: UILayer.ELEVATED }}
      dragListener={false}
      onDragEnd={() => setIsDragging(false)}
      transition={{ type: "spring", stiffness: 650, damping: 32 }}
    >
      <div className={`flex items-center pl-2 ${isDragging ? "opacity-90 bg-primary/5" : ""}`}>
        <div
          className={`p-2 text-muted-foreground hover:text-foreground ${isDragging ? "cursor-grabbing" : "cursor-grab"} touch-none`}
          onPointerDown={(event) => {
            setIsDragging(true);
            dragControls.start(event);
          }}
        >
          <GripVertical className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <SpaceCard space={space} activateEdit={activateEdit} />
        </div>
      </div>
    </Reorder.Item>
  );
}
