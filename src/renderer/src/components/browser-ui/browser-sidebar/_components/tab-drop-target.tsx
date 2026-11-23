import { DropIndicator } from "@/components/browser-ui/browser-sidebar/_components/drop-indicator";
import { useEffect, useRef, useState } from "react";
import { Space } from "~/lumi/interfaces/sessions/spaces";
import {
  dropTargetForElements,
  ElementDropTargetEventBasePayload
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { usePinnedTabs } from "@/components/providers/pinned-tabs-provider";
import {
  isFolderTabSource,
  isPinnedTabSource,
  isTabGroupSource
} from "@/components/browser-ui/browser-sidebar/_components/drag-utils";
import { useWindowDrag } from "@/hooks/use-window-drag";

type TabDropTargetProps = {
  spaceData: Space;
  isSpaceLight: boolean;
  moveTab: (tabId: number, newPos: number) => void;
  biggestIndex: number;
};

export function TabDropTarget({ spaceData, isSpaceLight, moveTab, biggestIndex }: TabDropTargetProps) {
  const [showDropIndicator, setShowDropIndicator] = useState(false);
  const dropTargetRef = useRef<HTMLDivElement>(null);
  const { unpinToTabList } = usePinnedTabs();
  const { handleMouseDown, hasDraggedRef } = useWindowDrag();

  const handleDoubleClick = () => {
    if (hasDraggedRef.current) return;
    lumi.newTab.open();
  };

  useEffect(() => {
    const el = dropTargetRef.current;
    if (!el) return () => {};

    function onDrop(args: ElementDropTargetEventBasePayload) {
      setShowDropIndicator(false);

      const sourceData = args.source.data;

      // Handle pinned tab drops — unpin and show in tab list at the end
      if (isPinnedTabSource(sourceData)) {
        unpinToTabList(sourceData.pinnedTabId, biggestIndex + 1);
        return;
      }

      const newPos = biggestIndex + 1;

      if (isFolderTabSource(sourceData)) {
        if (sourceData.profileId !== spaceData.profileId) return;
        if (sourceData.spaceId !== spaceData.id) {
          void lumi.tabs.moveTabToWindowSpace(sourceData.tabId, spaceData.id, newPos);
        } else {
          void lumi.tabs.removeTabFromFolder(sourceData.tabId, newPos);
        }
        return;
      }

      if (!isTabGroupSource(sourceData)) return;

      if (sourceData.mode === "folder") {
        if (sourceData.spaceId !== spaceData.id) {
          if (sourceData.profileId === spaceData.profileId) {
            void lumi.tabs.moveTabGroupToSpace(sourceData.tabGroupId, spaceData.id, newPos);
          }
        } else {
          void lumi.tabs.moveTabGroup(sourceData.tabGroupId, newPos);
        }
        return;
      }

      const sourceTabId = sourceData.primaryTabId;
      if (sourceData.spaceId !== spaceData.id) {
        if (sourceData.profileId === spaceData.profileId) {
          void lumi.tabs.moveTabToWindowSpace(sourceTabId, spaceData.id, newPos);
        }
      } else {
        moveTab(sourceTabId, newPos);
      }
    }

    function onChange() {
      setShowDropIndicator(true);
    }

    const cleanupDropTarget = dropTargetForElements({
      element: el,
      canDrop: (args) => {
        const sourceData = args.source.data;

        // Accept pinned tab drags (for unpinning)
        if (isPinnedTabSource(sourceData)) {
          return sourceData.profileId === spaceData.profileId;
        }

        if (isFolderTabSource(sourceData)) {
          return sourceData.profileId === spaceData.profileId;
        }

        // Accept tab group drags (existing behavior)
        if (!isTabGroupSource(sourceData)) {
          return false;
        }
        if (sourceData.profileId !== spaceData.profileId) {
          return false;
        }
        return true;
      },
      onDrop: onDrop,
      onDragEnter: onChange,
      onDrag: onChange,
      onDragLeave: () => setShowDropIndicator(false)
    });

    return cleanupDropTarget;
  }, [spaceData.profileId, isSpaceLight, moveTab, biggestIndex, spaceData.id, unpinToTabList]);

  return (
    <div
      className="relative flex-1 flex flex-col cursor-default"
      ref={dropTargetRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {showDropIndicator && (
        <div className="absolute top-0 left-0 right-0 -translate-y-1/2 z-elevated pointer-events-none">
          <DropIndicator isSpaceLight={isSpaceLight} />
        </div>
      )}
    </div>
  );
}
