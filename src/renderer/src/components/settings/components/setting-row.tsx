import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface SettingsSectionHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SettingsSectionHeader({ title, description, icon, actions, className }: SettingsSectionHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="size-9 rounded-xl bg-primary/12 dark:bg-primary/18 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

interface SettingsGroupProps {
  title?: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SettingsGroup({
  title,
  description,
  badge,
  actions,
  children,
  className,
  contentClassName
}: SettingsGroupProps) {
  return (
    <section className={cn("space-y-2 remove-app-drag", className)}>
      {(title || description || actions) && (
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            {title && (
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
                {badge}
              </div>
            )}
            {description && <p className="text-xs text-muted-foreground/85 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div
        className={cn(
          "lumi-glass-group rounded-2xl overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.07]",
          contentClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

interface SettingsRowProps {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  highlighted?: boolean;
  className?: string;
  onClick?: () => void;
}

export function SettingsRow({
  id,
  label,
  description,
  icon,
  children,
  highlighted = false,
  className,
  onClick
}: SettingsRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  return (
    <div
      ref={rowRef}
      data-setting-id={id}
      onClick={onClick}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 transition-colors",
        onClick && "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
        highlighted && "lumi-highlight-pulse",
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && (
          <div className="size-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          {typeof label === "string" ? (
            <Label htmlFor={id} className="text-sm font-medium text-foreground leading-snug">
              {label}
            </Label>
          ) : (
            <div className="text-sm font-medium text-foreground leading-snug">{label}</div>
          )}
          {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 shrink-0 sm:pl-4">{children}</div>}
    </div>
  );
}
