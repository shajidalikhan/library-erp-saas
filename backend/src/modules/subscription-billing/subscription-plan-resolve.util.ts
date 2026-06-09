import type { Types } from 'mongoose';

import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import type { IPlatformSubscriptionPlan } from '@modules/platform/platform-subscription-plan.model';
import { normalizePlanKey, planKeyRegex } from '@modules/platform/platform-catalog-plan.util';

import { normalizeLegacyPlanCode, planDisplayName } from './subscription-lifecycle.util';

type PlanLean = IPlatformSubscriptionPlan & { _id: Types.ObjectId };

export type ResolvedSubscriptionPlan = {
  planId: string | null;
  code: string;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxStudents: number;
  maxBranches: number;
  maxSeats: number;
  maxStaff: number;
  storageLimitMb: number;
  featureFlags: Record<string, boolean>;
};

function buildResolvedFromCatalog(
  catalog: PlanLean,
  fallback?: {
    planId?: Types.ObjectId | string | null;
    planCode?: string | null;
    planName?: string | null;
  },
): ResolvedSubscriptionPlan {
  return {
    planId: String(catalog._id),
    code: normalizePlanKey(catalog.planKey),
    displayName: catalog.displayName?.trim() || planDisplayName(catalog.planKey),
    monthlyPrice: catalog.monthlyPrice ?? 0,
    yearlyPrice: catalog.yearlyPrice ?? 0,
    maxStudents: catalog.maxStudents ?? 0,
    maxBranches: catalog.maxBranches ?? 0,
    maxSeats: catalog.maxSeats ?? 0,
    maxStaff: catalog.maxStaff ?? 0,
    storageLimitMb: catalog.storageLimitMb ?? 0,
    featureFlags: (catalog.featureFlags ?? {}) as Record<string, boolean>,
  };
}

function buildResolvedFallback(input: {
  planId?: Types.ObjectId | string | null;
  planCode?: string | null;
  planName?: string | null;
}): ResolvedSubscriptionPlan {
  const code = normalizeLegacyPlanCode(normalizePlanKey(String(input.planCode ?? ''))) || 'BASIC';
  const displayName = input.planName?.trim() || planDisplayName(code);
  return {
    planId: input.planId ? String(input.planId) : null,
    code,
    displayName,
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxStudents: 0,
    maxBranches: 0,
    maxSeats: 0,
    maxStaff: 0,
    storageLimitMb: 0,
    featureFlags: {},
  };
}

/**
 * Resolves live catalog metadata for a tenant subscription.
 * planId is the source of truth; planCode is legacy fallback only.
 */
export async function resolveSubscriptionPlan(input: {
  planId?: Types.ObjectId | string | null;
  planCode?: string | null;
  planName?: string | null;
}): Promise<ResolvedSubscriptionPlan> {
  if (input.planId) {
    const byId = (await PlatformSubscriptionPlanModel.findById(input.planId).lean()) as PlanLean | null;
    if (byId) return buildResolvedFromCatalog(byId, input);
  }

  const normalizedCode = normalizeLegacyPlanCode(normalizePlanKey(String(input.planCode ?? '')));
  if (normalizedCode) {
    const byCode = (await PlatformSubscriptionPlanModel.findOne({
      planKey: planKeyRegex(normalizedCode),
    }).lean()) as PlanLean | null;
    if (byCode) return buildResolvedFromCatalog(byCode, input);
  }

  return buildResolvedFallback(input);
}

/** @deprecated Prefer resolveSubscriptionPlan — kept for callers needing raw catalog lean doc. */
export async function resolveCatalogPlanForSubscription(input: {
  planId?: Types.ObjectId | string | null;
  planCode?: string | null;
}): Promise<PlanLean | null> {
  if (input.planId) {
    const byId = (await PlatformSubscriptionPlanModel.findById(input.planId).lean()) as PlanLean | null;
    if (byId) return byId;
  }

  const normalizedCode = normalizeLegacyPlanCode(normalizePlanKey(String(input.planCode ?? '')));
  if (!normalizedCode) return null;

  return (await PlatformSubscriptionPlanModel.findOne({
    planKey: planKeyRegex(normalizedCode),
  }).lean()) as PlanLean | null;
}

/** Batch-load catalog plans by id for list enrichment (planId-first, no code fallback). */
export async function loadCatalogPlansById(
  planIds: Array<Types.ObjectId | string>,
): Promise<Map<string, PlanLean>> {
  const unique = [...new Set(planIds.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();

  const docs = (await PlatformSubscriptionPlanModel.find({
    _id: { $in: unique },
  }).lean()) as PlanLean[];

  return new Map(docs.map((p) => [String(p._id), p]));
}

export function resolveSubscriptionPlanFromCatalogMap(input: {
  planId?: Types.ObjectId | string | null;
  planCode?: string | null;
  planName?: string | null;
  catalogById: Map<string, PlanLean>;
  catalogByCode?: Map<string, PlanLean>;
}): ResolvedSubscriptionPlan {
  if (input.planId) {
    const catalog = input.catalogById.get(String(input.planId));
    if (catalog) return buildResolvedFromCatalog(catalog, input);
  }

  const normalizedCode = normalizeLegacyPlanCode(normalizePlanKey(String(input.planCode ?? '')));
  if (normalizedCode && input.catalogByCode) {
    const catalog = input.catalogByCode.get(normalizedCode);
    if (catalog) return buildResolvedFromCatalog(catalog, input);
  }

  return buildResolvedFallback(input);
}
