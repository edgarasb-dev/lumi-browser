import { useSpaces } from "@/components/providers/spaces-provider";
import { DownloadsButton } from "../downloads-button";
import { SpaceDropdownSwitcher } from "./space-dropdown-switcher";
import { WorkspaceProfileMenu } from "./workspace-profile-menu";

/**
 * Streamlined sidebar bottom dock matching the 3-slot workspace footer:
 * [ Downloads (with unseen indicator) | Centered Space Dropdown | Workspace & Profile Menu ]
 */
export function BottomDock() {
  const { spaces, isCurrentSpaceInternal } = useSpaces();
  const hasVisibleSpaces = !isCurrentSpaceInternal && spaces.length > 0;

  return (
    <div data-no-drag className="shrink-0 mt-1 mb-2 w-full min-w-0">
      <div className="flex h-8 w-full min-w-0 items-center justify-between gap-1.5 px-0.5">
        <DownloadsButton size="sm" />
        {hasVisibleSpaces ? <SpaceDropdownSwitcher /> : <div className="flex-1" />}
        <WorkspaceProfileMenu />
      </div>
    </div>
  );
}
