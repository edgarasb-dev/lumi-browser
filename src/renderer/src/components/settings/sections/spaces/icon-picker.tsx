import { useState, useEffect, useMemo, memo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loadPhosphorIconsMetadata, SpaceIcon } from "@/lib/phosphor-icons";
import type { IconEntry } from "@phosphor-icons/core";

const INITIAL_RENDER_LIMIT = 96;
const RENDER_PAGE_STEP = 96;

// ==============================
// PhosphorIconPicker Component
// ==============================
interface SpaceIconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconId: string) => void;
}

export function SpaceIconPicker({ selectedIcon, onSelectIcon }: SpaceIconPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [iconList, setIconList] = useState<IconEntry[]>([]);
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);

  useEffect(() => {
    let cancelled = false;
    void loadPhosphorIconsMetadata().then((list) => {
      if (!cancelled) {
        setIconList(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredIcons = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return iconList;

    return iconList.filter((icon) => {
      if (icon.name.toLowerCase().includes(query) || icon.pascal_name.toLowerCase().includes(query)) {
        return true;
      }
      return (
        icon.tags.some((t) => t.toLowerCase().includes(query)) ||
        icon.categories.some((c) => c.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, iconList]);

  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT);
  }, [searchQuery]);

  const visibleIcons = useMemo(() => filteredIcons.slice(0, renderLimit), [filteredIcons, renderLimit]);
  const hasMore = visibleIcons.length < filteredIcons.length;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 z-10 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          id="icon-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search icons..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="h-[340px] overflow-y-auto rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.025] p-1.5 no-scrollbar">
        <div className="grid grid-cols-6 lg:grid-cols-6 xl:grid-cols-7 gap-1.5">
          {visibleIcons.map((icon) => (
            <MemoizedIconItem
              key={icon.name}
              icon={icon}
              isSelected={selectedIcon === icon.pascal_name}
              onSelect={() => {
                onSelectIcon(icon.pascal_name);
              }}
            />
          ))}
        </div>
        {hasMore && (
          <div className="p-2 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRenderLimit((prev) => prev + RENDER_PAGE_STEP)}
            >
              Show more ({filteredIcons.length - visibleIcons.length} remaining)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function IconItem({ icon, isSelected, onSelect }: { icon: IconEntry; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`flex flex-col items-center justify-center p-1.5 cursor-pointer rounded-lg transition-all duration-150 hover:scale-105 ${
        isSelected
          ? "bg-primary/15 border border-primary text-primary shadow-xs ring-1 ring-primary/30"
          : "border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-foreground/85"
      }`}
      onClick={onSelect}
      title={icon.name}
    >
      <div className="relative h-6 w-6 flex items-center justify-center">
        <SpaceIcon id={icon.pascal_name} className="h-5 w-5" />
      </div>
    </button>
  );
}

export const MemoizedIconItem = memo(IconItem);
