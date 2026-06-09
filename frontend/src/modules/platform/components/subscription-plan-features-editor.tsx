'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  SUBSCRIPTION_FEATURE_CATALOG,
  SUBSCRIPTION_FEATURE_CATEGORIES,
  type SubscriptionFeatureCategory,
} from '@/modules/subscription/subscription-feature-catalog';
import type { SubscriptionPlanFeatureFlagsFormValues } from '@/modules/platform/subscription-plan-feature-flags.constants';

type Props = {
  values: SubscriptionPlanFeatureFlagsFormValues;
  setValue: (key: keyof SubscriptionPlanFeatureFlagsFormValues, value: boolean) => void;
};

export function SubscriptionPlanFeaturesEditor({ values, setValue }: Props) {
  const [search, setSearch] = useState('');

  const selectedCount = useMemo(
    () => Object.values(values).filter(Boolean).length,
    [values],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SUBSCRIPTION_FEATURE_CATALOG;
    return SUBSCRIPTION_FEATURE_CATALOG.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q),
    );
  }, [search]);

  const byCategory = useMemo(() => {
    const map = new Map<SubscriptionFeatureCategory, typeof SUBSCRIPTION_FEATURE_CATALOG>();
    for (const cat of SUBSCRIPTION_FEATURE_CATEGORIES) map.set(cat, []);
    for (const f of filtered) {
      map.get(f.category)?.push(f);
    }
    return map;
  }, [filtered]);

  const setCategory = (category: SubscriptionFeatureCategory, enabled: boolean) => {
    for (const f of SUBSCRIPTION_FEATURE_CATALOG) {
      if (f.category === category) {
        setValue(f.key as keyof SubscriptionPlanFeatureFlagsFormValues, enabled);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {selectedCount} of {SUBSCRIPTION_FEATURE_CATALOG.length} features selected
        </p>
        <Input
          placeholder="Search features…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      {SUBSCRIPTION_FEATURE_CATEGORIES.map((category) => {
        const items = byCategory.get(category) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={category} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{category}</p>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setCategory(category, true)}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCategory(category, false)}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((f) => (
                <label
                  key={f.key}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-md border p-3 transition-colors',
                    values[f.key as keyof SubscriptionPlanFeatureFlagsFormValues]
                      ? 'border-primary/40 bg-primary/5'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(values[f.key as keyof SubscriptionPlanFeatureFlagsFormValues])}
                    onChange={(e) =>
                      setValue(f.key as keyof SubscriptionPlanFeatureFlagsFormValues, e.target.checked)
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
