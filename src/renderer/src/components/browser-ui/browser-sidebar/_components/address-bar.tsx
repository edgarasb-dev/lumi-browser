import { cn } from "@/lib/utils";
import { Lock, SearchIcon } from "lucide-react";
import { memo, useCallback, useRef, type MouseEvent } from "react";
import { useAddressUrl, useFocusedTabId } from "@/components/providers/tabs-provider";
import { simplifyUrl } from "@/lib/url";
import { PinnedBrowserActions } from "./pinned-browser-actions";
import { useBrowserSidebar } from "@/components/browser-ui/browser-sidebar/provider";
import { BrowserActionList } from "@/components/browser-ui/browser-sidebar/_components/browser-action-list";
import { SiteControlsButton } from "./site-controls-popover";
import { FavouriteButton } from "./favourite-button";
import { PasswordToolbarButton } from "./password-button";
import { ReaderButton } from "./reader-button";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useWindowDrag } from "@/hooks/use-window-drag";

export const AddressBar = memo(function AddressBar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const addressUrl = useAddressUrl();
  const focusedTabId = useFocusedTabId();
  const { hasSidebar } = useBrowserSidebar();
  const { windowType } = useSpaces();

  const isPopupWindow = windowType === "popup";
  const simplifiedUrl = simplifyUrl(addressUrl);
  const isPlaceholder = !simplifiedUrl;
  const isHttps = addressUrl.startsWith("https://");

  const { handleMouseDown, hasDraggedRef } = useWindowDrag({
    shouldIgnoreTarget: (target) => {
      return Boolean(target.closest("button") || target.closest(".address-bar-actions"));
    }
  });

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (hasDraggedRef.current) {
        hasDraggedRef.current = false;
        return;
      }

      const el = containerRef.current;
      if (!el) return;

      const path = event.nativeEvent.composedPath();
      if (!path.includes(el)) {
        return;
      }

      const rect = el.getBoundingClientRect();

      // If it is in a popup window, do not show the omnibox
      if (isPopupWindow) {
        return;
      }

      const omniboxWidth = hasSidebar ? rect.width * 1.8 : Math.min(Math.max(rect.width, 480), 750);
      const omniboxX = hasSidebar ? rect.x : rect.x + Math.max(0, (rect.width - omniboxWidth) / 2);
      const omniboxY = hasSidebar ? rect.y : rect.bottom + 4;

      lumi.omnibox.show(
        {
          x: omniboxX,
          y: omniboxY,
          width: omniboxWidth,
          height: rect.height * 8
        },
        {
          currentInput: addressUrl,
          openIn: focusedTabId ? "current" : "new_tab"
        }
      );
    },
    [addressUrl, focusedTabId, hasSidebar, isPopupWindow, hasDraggedRef]
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={cn(
        "w-full min-w-0 h-9 rounded-xl select-none",
        "bg-white/55 dark:bg-white/[0.11] backdrop-blur-md",
        "border border-black/[0.08] dark:border-white/[0.14]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        !isPopupWindow && "hover:bg-white/75 dark:hover:bg-white/[0.16]",
        "transition-[background-color,border-color] duration-150",
        "flex items-center px-2.5 gap-1.5 overflow-hidden cursor-default",
        isPlaceholder ? "text-black/50 dark:text-white/50" : "text-black/85 dark:text-white/90"
      )}
    >
      {isPlaceholder ? (
        <SearchIcon strokeWidth={2} className="size-3.5 shrink-0 opacity-75" />
      ) : isHttps ? (
        <Lock className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : null}
      <p className={cn("text-[13px] font-medium min-w-0 flex-1 truncate")}>
        {isPlaceholder ? "Search or Enter URL..." : simplifiedUrl}
      </p>
      <div className="ml-auto flex items-center gap-0.5 shrink-0 remove-app-drag address-bar-actions">
        <ReaderButton />
        <PasswordToolbarButton />
        <FavouriteButton />
        <SiteControlsButton />
        <PinnedBrowserActions />
        <div>
          <BrowserActionList />
        </div>
      </div>
    </div>
  );
});
