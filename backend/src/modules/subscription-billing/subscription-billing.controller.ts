import type { Request, Response } from 'express';

import { ApiError } from '@utils/ApiError';
import { ApiResponse } from '@utils/ApiResponse';
import { ROLES } from '@constants/roles.constants';
import { asyncHandler } from '@utils/asyncHandler';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { subscriptionBillingService } from './subscription-billing.service';
import { librarySubscriptionService } from './library-subscription.service';
import type {
  CancelPlatformSubscriptionInvoiceBody,
  CollectPlatformSubscriptionInvoiceBody,
  CreatePlatformSubscriptionInvoiceBody,
  OwnerSubscriptionInvoiceListQuery,
  PlatformSubscriptionInvoiceListQuery,
} from './subscription-billing.validation';
import type {
  AdjustLibrarySubscriptionBody,
  ExtendTrialBody,
} from './library-subscription.validation';

class SubscriptionBillingController {
  createPlatformInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = req.validatedBody as CreatePlatformSubscriptionInvoiceBody;
    const data = await subscriptionBillingService.createPlatformInvoice(user, body);
    return ApiResponse.created(res, data, 'Invoice created');
  });

  listPlatformInvoices = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = req.validatedQuery as PlatformSubscriptionInvoiceListQuery;
    const data = await subscriptionBillingService.listPlatformInvoices(user, query);
    return ApiResponse.ok(res, data);
  });

  getPlatformInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { invoiceId } = req.validatedParams as { invoiceId: string };
    const data = await subscriptionBillingService.getPlatformInvoice(user, invoiceId);
    return ApiResponse.ok(res, data);
  });

  collectPlatformInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { invoiceId } = req.validatedParams as { invoiceId: string };
    const body = req.validatedBody as CollectPlatformSubscriptionInvoiceBody;
    const data = await subscriptionBillingService.collectPlatformInvoice(user, invoiceId, body);
    return ApiResponse.ok(res, data, 'Payment recorded');
  });

  cancelPlatformInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { invoiceId } = req.validatedParams as { invoiceId: string };
    const body = (req.validatedBody ?? {}) as CancelPlatformSubscriptionInvoiceBody;
    const data = await subscriptionBillingService.cancelPlatformInvoice(user, invoiceId, body);
    return ApiResponse.ok(res, data, 'Invoice cancelled');
  });

  getEffectiveFeatures = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await subscriptionBillingService.getTenantEffectiveFeatures(user);
    return ApiResponse.ok(res, data);
  });

  ownerSubscription = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await subscriptionBillingService.buildOwnerSubscription(user);
    return ApiResponse.ok(res, data);
  });

  listOwnerInvoices = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = req.validatedQuery as OwnerSubscriptionInvoiceListQuery;
    const data = await subscriptionBillingService.listOwnerInvoices(user, query);
    return ApiResponse.ok(res, data);
  });

  getOwnerInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { invoiceId } = req.validatedParams as { invoiceId: string };
    const data = await subscriptionBillingService.getOwnerInvoice(user, invoiceId);
    return ApiResponse.ok(res, data);
  });

  getPlatformLibrarySubscription = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const data = await librarySubscriptionService.getPlatformSubscription(user, libraryId);
    return ApiResponse.ok(res, data);
  });

  getPlatformSubscriptionSnapshot = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    if (user.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Super admin access required');
    const data = await subscriptionBillingService.getSubscriptionSnapshot(libraryId);
    return ApiResponse.ok(res, data);
  });

  adjustPlatformLibrarySubscription = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const body = req.validatedBody as AdjustLibrarySubscriptionBody;
    const data = await librarySubscriptionService.adjustSubscription(user, libraryId, body);
    const snapshot = await subscriptionBillingService.getSubscriptionSnapshot(libraryId);
    return ApiResponse.ok(res, { ...data, snapshot }, 'Subscription adjusted');
  });

  extendPlatformTrial = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const body = req.validatedBody as ExtendTrialBody;
    const data = await librarySubscriptionService.extendTrial(user, libraryId, body);
    const snapshot = await subscriptionBillingService.getSubscriptionSnapshot(libraryId);
    return ApiResponse.ok(res, { ...data, snapshot }, 'Trial extended');
  });

  syncPlatformLibrarySubscription = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const data = await librarySubscriptionService.syncSubscription(user, libraryId);
    const snapshot = await subscriptionBillingService.getSubscriptionSnapshot(libraryId);
    return ApiResponse.ok(res, { ...data, snapshot }, 'Subscription synced');
  });
}

export const subscriptionBillingController = new SubscriptionBillingController();
