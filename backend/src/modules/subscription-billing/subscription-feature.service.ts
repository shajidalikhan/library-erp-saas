import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { ApiError } from '@utils/ApiError';
import { LibraryModel } from '@modules/library/library.models';
import { resolveSubscriptionPlan } from './subscription-plan-resolve.util';
import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';

import { librarySubscriptionService } from './library-subscription.service';
import {
  SUBSCRIPTION_FEATURE_CATALOG,
  SUBSCRIPTION_FEATURE_KEYS,
  SUBSCRIPTION_FEATURE_KEYS_SET,
  SUBSCRIPTION_FEATURE_LEGACY_ALIASES,
  catalogFeatureLabel,
  defaultPlanFeatureFlags,
} from './subscription-feature-catalog';

export type EffectiveFeaturesResult = {
  libraryId: string;
  planCode: string;
  planName: string;
  planFeatures: Record<string, boolean>;
  features: Record<string, boolean>;
  enabledFeaturesOverride: string[];
  disabledFeaturesOverride: string[];
  included: Array<{ key: string; label: string }>;
  unavailable: Array<{ key: string; label: string }>;
};

function planFlagEnabled(planFlags: Record<string, boolean>, canonicalKey: string): boolean {
  if (planFlags[canonicalKey]) return true;
  const aliases = SUBSCRIPTION_FEATURE_LEGACY_ALIASES[canonicalKey] ?? [];
  return aliases.some((a) => Boolean(planFlags[a]));
}

function normalizePlanFlags(raw: Record<string, boolean> | undefined): Record<string, boolean> {
  const base = defaultPlanFeatureFlags();
  if (!raw) return base;
  for (const key of SUBSCRIPTION_FEATURE_KEYS) {
    base[key] = planFlagEnabled(raw, key);
  }
  return base;
}

function applyOverrides(
  planFeatures: Record<string, boolean>,
  enabled: string[],
  disabled: string[],
): Record<string, boolean> {
  const out = { ...planFeatures };
  for (const key of enabled) {
    if (SUBSCRIPTION_FEATURE_KEYS_SET.has(key)) out[key] = true;
  }
  for (const key of disabled) {
    if (SUBSCRIPTION_FEATURE_KEYS_SET.has(key)) out[key] = false;
  }
  return out;
}

class SubscriptionFeatureService {
  async resolveEffectiveFeatures(libraryId: string): Promise<EffectiveFeaturesResult> {
    const lib = await LibraryModel.findById(libraryId)
      .select('enabledFeaturesOverride disabledFeaturesOverride subscriptionPlan')
      .lean();
    if (!lib) throw ApiError.notFound('Library not found');

    const oid = lib._id as Types.ObjectId;
    await librarySubscriptionService.promoteScheduledIfDue(oid);
    const subRecord = await librarySubscriptionService.ensureFromLibrary(oid);

    const resolved = await resolveSubscriptionPlan({
      planId: subRecord.planId,
      planCode: subRecord.planCode ?? String(lib.subscriptionPlan ?? ''),
      planName: subRecord.planName,
    });

    const planCode = resolved.code;
    const planName = resolved.displayName;
    const rawPlanFlags = resolved.featureFlags;
    const planFeatures = normalizePlanFlags(rawPlanFlags);

    const enabledFeaturesOverride = [...(lib.enabledFeaturesOverride ?? [])];
    const disabledFeaturesOverride = [...(lib.disabledFeaturesOverride ?? [])];
    const features = applyOverrides(planFeatures, enabledFeaturesOverride, disabledFeaturesOverride);

    const included: EffectiveFeaturesResult['included'] = [];
    const unavailable: EffectiveFeaturesResult['unavailable'] = [];
    for (const def of SUBSCRIPTION_FEATURE_CATALOG) {
      const row = { key: def.key, label: def.label };
      if (features[def.key]) included.push(row);
      else unavailable.push(row);
    }

    return {
      libraryId,
      planCode,
      planName,
      planFeatures,
      features,
      enabledFeaturesOverride,
      disabledFeaturesOverride,
      included,
      unavailable,
    };
  }

  async hasFeature(libraryId: string, featureKey: string): Promise<boolean> {
    if (!SUBSCRIPTION_FEATURE_KEYS_SET.has(featureKey)) return false;
    const { features } = await this.resolveEffectiveFeatures(libraryId);
    return Boolean(features[featureKey]);
  }

  async assertFeature(libraryId: string, featureKey: string): Promise<void> {
    const effective = await this.resolveEffectiveFeatures(libraryId);
    if (effective.features[featureKey]) return;

    const message =
      featureKey === 'public_booking'
        ? 'Your current subscription plan does not include Public Booking.'
        : 'Your current subscription plan does not include this feature.';

    throw ApiError.forbidden(message, {
      feature: featureKey,
      featureLabel: catalogFeatureLabel(featureKey),
      planName: effective.planName,
      planCode: effective.planCode,
      upgradeRequired: true,
    });
  }

  async patchLibraryFeatureOverrides(
    actorUserId: string,
    libraryId: string,
    body: {
      enabledFeaturesOverride?: string[];
      disabledFeaturesOverride?: string[];
      reason: string;
    },
  ): Promise<EffectiveFeaturesResult> {
    const lib = await LibraryModel.findById(libraryId);
    if (!lib) throw ApiError.notFound('Library not found');

    const sanitize = (arr: string[] | undefined) =>
      [...new Set((arr ?? []).filter((k) => SUBSCRIPTION_FEATURE_KEYS_SET.has(k)))];

    if (body.enabledFeaturesOverride !== undefined) {
      lib.enabledFeaturesOverride = sanitize(body.enabledFeaturesOverride);
    }
    if (body.disabledFeaturesOverride !== undefined) {
      lib.disabledFeaturesOverride = sanitize(body.disabledFeaturesOverride);
    }
    await lib.save();

    const after = await this.resolveEffectiveFeatures(libraryId);
    await appendPlatformAuditLog({
      actorUserId,
      action: 'LIBRARY_FEATURE_OVERRIDE',
      entityType: 'LIBRARY',
      entityId: libraryId,
      libraryId,
      metadata: {
        reason: body.reason,
        enabledFeaturesOverride: after.enabledFeaturesOverride,
        disabledFeaturesOverride: after.disabledFeaturesOverride,
      },
    });

    return after;
  }
}

export const subscriptionFeatureService = new SubscriptionFeatureService();
