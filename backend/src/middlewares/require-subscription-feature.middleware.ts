import type { Request, Response, NextFunction } from 'express';

import { ROLES } from '@constants/roles.constants';
import { asyncHandler } from '@utils/asyncHandler';
import { ApiError } from '@utils/ApiError';
import { requireAuthUser } from '@middlewares/auth.middleware';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import { SUBSCRIPTION_FEATURE_KEYS_SET } from '@modules/subscription-billing/subscription-feature-catalog';

function resolveLibraryId(req: Request, user: ReturnType<typeof requireAuthUser>): string | null {
  const params = req.validatedParams as { libraryId?: string } | undefined;
  const query = req.validatedQuery as { libraryId?: string } | undefined;
  const body = req.validatedBody as { libraryId?: string } | undefined;
  return user.libraryId ?? params?.libraryId ?? query?.libraryId ?? body?.libraryId ?? null;
}

/** Subscription feature gate — use after `authenticate`. Super Admin bypasses. */
export function requireSubscriptionFeature(featureKey: string) {
  if (!SUBSCRIPTION_FEATURE_KEYS_SET.has(featureKey)) {
    throw new Error(`Unknown subscription feature key: ${featureKey}`);
  }

  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const user = requireAuthUser(req.user);
    if (user.role === ROLES.SUPER_ADMIN) {
      next();
      return;
    }

    const libraryId = resolveLibraryId(req, user);
    if (!libraryId) {
      throw ApiError.forbidden('Library context is required for this feature');
    }

    await subscriptionFeatureService.assertFeature(libraryId, featureKey);
    next();
  });
}
