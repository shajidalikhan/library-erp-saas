import { formatEntityLabel, type EntityLabelType } from '@/lib/entity-label';
import { cn } from '@/lib/utils';

type EntityLabelProps = {
  type: EntityLabelType;
  id?: string | null;
  label?: string | null;
  secondary?: string | null;
  fallback?: string;
  className?: string;
  secondaryClassName?: string;
};

export function EntityLabel({
  type,
  id,
  label,
  secondary,
  fallback,
  className,
  secondaryClassName,
}: EntityLabelProps) {
  const primary = label?.trim() || formatEntityLabel(null, type);
  const resolvedFallback = fallback ?? formatEntityLabel(null, type);
  const displayPrimary = label?.trim() ? primary : resolvedFallback;
  const displaySecondary = secondary?.trim() || null;

  return (
    <span className={cn('inline-flex flex-col', className)} data-entity-id={id ?? undefined} data-entity-type={type}>
      <span>{displayPrimary}</span>
      {displaySecondary ? (
        <span className={cn('text-xs text-muted-foreground', secondaryClassName)}>{displaySecondary}</span>
      ) : null}
    </span>
  );
}
