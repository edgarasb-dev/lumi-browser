import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InternalPageShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  searchSlot?: ReactNode;
  headerActions?: ReactNode;
  subheaderSlot?: ReactNode;
  maxWidth?: "3xl" | "4xl";
  children: ReactNode;
  className?: string;
}

export function InternalPageShell({
  title,
  subtitle,
  icon,
  searchSlot,
  headerActions,
  subheaderSlot,
  maxWidth = "3xl",
  children,
  className
}: InternalPageShellProps) {
  const widthClass = maxWidth === "4xl" ? "max-w-4xl" : "max-w-3xl";

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-radial from-primary/10 via-transparent to-transparent"
        aria-hidden
      />

      <header className="sticky top-0 z-elevated border-b border-black/8 bg-background/80 backdrop-blur-2xl saturate-150 dark:border-white/10">
        <div className={cn(widthClass, "mx-auto flex items-center gap-4 px-6 py-3.5")}>
          <div className="flex shrink-0 items-center gap-2.5">
            {icon && (
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
                {icon}
              </span>
            )}
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>}
            </div>
          </div>

          {searchSlot && <div className="min-w-0 flex-1">{searchSlot}</div>}

          {headerActions && <div className="ml-auto flex shrink-0 items-center gap-2">{headerActions}</div>}
        </div>

        {subheaderSlot && <div className={cn(widthClass, "mx-auto px-6 pb-3")}>{subheaderSlot}</div>}
      </header>

      <main className={cn(widthClass, "relative mx-auto flex w-full flex-1 flex-col gap-4 px-6 py-6", className)}>
        {children}
      </main>
    </div>
  );
}
