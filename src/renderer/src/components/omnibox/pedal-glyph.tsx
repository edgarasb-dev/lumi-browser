import { cn } from "@/lib/utils";
import {
  HistoryIcon,
  AppWindowIcon,
  PuzzleIcon,
  SettingsIcon,
  ShieldIcon,
  LinkIcon,
  DownloadIcon,
  Trash2Icon,
  SparklesIcon,
  FocusIcon,
  PanelRightIcon,
  CropIcon,
  CameraIcon,
  RotateCcwIcon,
  BookmarkCheckIcon
} from "lucide-react";

export function PedalGlyph({ action, selected, className }: { action: string; selected: boolean; className?: string }) {
  const cls = cn(
    "size-4 shrink-0 transition-colors",
    selected ? "text-primary" : "text-zinc-500 dark:text-zinc-400",
    className
  );
  switch (action) {
    case "open_settings":
      return <SettingsIcon className={cls} strokeWidth={2} />;
    case "open_new_window":
      return <AppWindowIcon className={cls} strokeWidth={2} />;
    case "open_incognito_window":
      return <ShieldIcon className={cls} strokeWidth={2} />;
    case "open_extensions":
      return <PuzzleIcon className={cls} strokeWidth={2} />;
    case "open_history":
      return <HistoryIcon className={cls} strokeWidth={2} />;
    case "open_downloads":
      return <DownloadIcon className={cls} strokeWidth={2} />;
    case "clear_browsing_data":
      return <Trash2Icon className={cls} strokeWidth={2} />;
    case "open_bangs":
      return <SparklesIcon className={cls} strokeWidth={2} />;
    case "toggle_zen_mode":
      return <FocusIcon className={cls} strokeWidth={2} />;
    case "toggle_side_panel":
      return <PanelRightIcon className={cls} strokeWidth={2} />;
    case "capture_region":
      return <CropIcon className={cls} strokeWidth={2} />;
    case "capture_full_page":
      return <CameraIcon className={cls} strokeWidth={2} />;
    case "recently_closed":
      return <RotateCcwIcon className={cls} strokeWidth={2} />;
    case "save_snapshot":
      return <BookmarkCheckIcon className={cls} strokeWidth={2} />;
    default:
      return <LinkIcon className={cls} strokeWidth={2} />;
  }
}
