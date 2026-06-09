import type { Types } from 'mongoose';

import { LibraryModel } from '@modules/library/library.models';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';

import { PlatformSubscriptionPlanModel } from './platform-subscription-plan.model';

const PLAN_KEY_PATTERN = /^[A-Z0-9_]{2,40}$/;

/** Canonical uppercase SKU stored on Library.subscriptionPlan and PlatformSubscriptionPlan.planKey. */
export function normalizePlanKey(planKey: string): string {
  return planKey.trim().toUpperCase();
}

/** Trim, replace spaces with underscores, strip invalid chars, uppercase. */
export function sanitizePlanKey(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function isValidPlanKey(planKey: string): boolean {
  return PLAN_KEY_PATTERN.test(planKey);
}

export function formatCatalogPlanDto(
  plan: Record<string, unknown> & { _id: unknown; planKey?: string; displayName?: string },
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...plan,
    ...extra,
    id: String(plan._id),
    planKey: normalizePlanKey(String(plan.planKey ?? '')),
    displayName: String(plan.displayName ?? '').trim(),
  };
}

/** Fix legacy rows where planKey was saved in title case (e.g. "Basic" === displayName). */
export async function repairPlanKeyCasing(): Promise<void> {
  const plans = await PlatformSubscriptionPlanModel.find({}).select('_id planKey').lean();
  for (const p of plans) {
    const upper = normalizePlanKey(p.planKey);
    if (upper === p.planKey) continue;
    const conflict = await PlatformSubscriptionPlanModel.findOne({
      planKey: upper,
      _id: { $ne: p._id },
    })
      .select('_id')
      .lean();
    if (conflict) continue;
    await PlatformSubscriptionPlanModel.updateOne({ _id: p._id }, { $set: { planKey: upper } });
  }
}

export function planKeyRegex(planKey: string): RegExp {
  const escaped = planKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Libraries linked by planId (primary) or legacy subscriptionPlan code. */
export async function countLibrariesUsingPlan(
  planId: Types.ObjectId,
  planKey: string,
): Promise<number> {
  const code = normalizePlanKey(planKey);
  const [fromPlanId, fromCode] = await Promise.all([
    LibrarySubscriptionModel.distinct('libraryId', { planId }),
    LibraryModel.find({ subscriptionPlan: code }).select('_id').lean(),
  ]);
  const ids = new Set<string>();
  for (const id of fromPlanId) ids.add(String(id));
  for (const lib of fromCode) ids.add(String(lib._id));
  return ids.size;
}

/**
 * Sync denormalized plan code/name on active subscriptions/libraries after catalog edit.
 * Historical invoices keep their snapshot planCode unchanged.
 */
export async function propagatePlanMetadataChange(input: {
  planId: Types.ObjectId;
  planKey: string;
  displayName: string;
  previousPlanKey?: string;
}): Promise<{ librariesUpdated: number }> {
  const { planId, planKey, displayName, previousPlanKey } = input;
  const newCode = normalizePlanKey(planKey);
  const oldCode = previousPlanKey ? normalizePlanKey(previousPlanKey) : null;

  await LibrarySubscriptionModel.updateMany(
    { planId },
    { $set: { planCode: newCode, planName: displayName } },
  );
  await LibrarySubscriptionModel.updateMany(
    { upcomingPlanId: planId },
    { $set: { upcomingPlanCode: newCode, upcomingPlanName: displayName } },
  );

  const linkedLibIds = await LibrarySubscriptionModel.distinct('libraryId', { planId });

  await LibraryModel.updateMany(
    { _id: { $in: linkedLibIds } },
    { $set: { subscriptionPlan: newCode } },
  );

  let legacyUpdated = 0;
  if (oldCode && oldCode !== newCode) {
    const legacyResult = await LibraryModel.updateMany(
      { subscriptionPlan: oldCode, _id: { $nin: linkedLibIds } },
      { $set: { subscriptionPlan: newCode } },
    );
    legacyUpdated = legacyResult.modifiedCount;
  }

  return { librariesUpdated: linkedLibIds.length + legacyUpdated };
}

/** @deprecated Use propagatePlanMetadataChange */
export async function propagatePlanKeyChange(input: {
  planId: Types.ObjectId;
  oldPlanKey: string;
  newPlanKey: string;
  displayName: string;
}): Promise<{ librariesUpdated: number }> {
  return propagatePlanMetadataChange({
    planId: input.planId,
    planKey: input.newPlanKey,
    displayName: input.displayName,
    previousPlanKey: input.oldPlanKey,
  });
}
