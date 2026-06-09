import type { Request, Response } from 'express';

import { ApiResponse } from '@utils/ApiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { platformService } from './platform.service';
import type {
  AuditLogsQuery,
  CreateSubscriptionPlanBody,
  PatchPlatformSettingsBody,
  PatchSubscriptionPlanBody,
  PatchLibraryFeatureOverridesBody,
  PatchTenantBody,
  PlatformAnnouncementBody,
  SuspendTenantBody,
  TenantsListQuery,
} from './platform.validation';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import type { RoleName } from '@constants/roles.constants';
import { roleCapabilityService } from './role-capability.service';
import type { PatchRoleCapabilitiesBody } from './platform.validation';

class PlatformController {
  dashboard = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await platformService.getDashboard(user);
    return ApiResponse.ok(res, data);
  });

  health = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await platformService.getHealth(user);
    return ApiResponse.ok(res, data);
  });

  getSettings = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await platformService.getSettings(user);
    return ApiResponse.ok(res, data);
  });

  patchSettings = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = req.validatedBody as PatchPlatformSettingsBody;
    const data = await platformService.patchSettings(user, body);
    return ApiResponse.ok(res, data, 'Settings updated');
  });

  listTenants = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const q = req.validatedQuery as TenantsListQuery;
    const data = await platformService.listTenants(user, q);
    return ApiResponse.ok(res, data);
  });

  getTenant = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const data = await platformService.getTenant(user, libraryId);
    return ApiResponse.ok(res, data);
  });

  patchTenant = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const body = req.validatedBody as PatchTenantBody;
    const data = await platformService.patchTenant(user, libraryId, body);
    return ApiResponse.ok(res, data, 'Tenant updated');
  });

  patchTenantFeatureOverrides = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const body = req.validatedBody as PatchLibraryFeatureOverridesBody;
    const data = await subscriptionFeatureService.patchLibraryFeatureOverrides(user.id, libraryId, body);
    return ApiResponse.ok(res, data, 'Feature overrides updated');
  });

  suspendTenant = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const body = req.validatedBody as SuspendTenantBody;
    const data = await platformService.suspendTenant(user, libraryId, body);
    return ApiResponse.ok(res, data, 'Tenant suspended');
  });

  activateTenant = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = req.validatedParams as { libraryId: string };
    const data = await platformService.activateTenant(user, libraryId);
    return ApiResponse.ok(res, data, 'Tenant activated');
  });

  listPlans = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await platformService.listPlans(user);
    return ApiResponse.ok(res, data);
  });

  getPlan = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { planId } = req.validatedParams as { planId: string };
    const data = await platformService.getPlan(user, planId);
    return ApiResponse.ok(res, data);
  });

  createPlan = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = req.validatedBody as CreateSubscriptionPlanBody;
    const data = await platformService.createPlan(user, body);
    return ApiResponse.created(res, data, 'Plan created');
  });

  patchPlan = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { planId } = req.validatedParams as { planId: string };
    const body = req.validatedBody as PatchSubscriptionPlanBody;
    const data = await platformService.patchPlan(user, planId, body);
    return ApiResponse.ok(res, data, 'Plan updated');
  });

  auditLogs = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const q = req.validatedQuery as AuditLogsQuery;
    const data = await platformService.listAuditLogs(user, q);
    return ApiResponse.ok(res, data);
  });

  usage = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await platformService.getUsage(user);
    return ApiResponse.ok(res, data);
  });

  usageSnapshots = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await platformService.recordSnapshots(user);
    return ApiResponse.ok(res, data, 'Snapshots recorded');
  });

  announcement = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = req.validatedBody as PlatformAnnouncementBody;
    const data = await platformService.postAnnouncement(user, body);
    return ApiResponse.ok(res, data, 'Announcement queued');
  });

  impersonationPolicy = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = platformService.impersonationPolicy(user);
    return ApiResponse.ok(res, data);
  });

  getRoleCapabilities = asyncHandler(async (req: Request, res: Response) => {
    requireAuthUser(req.user);
    const data = await roleCapabilityService.getConfigurableMatrix();
    return ApiResponse.ok(res, data);
  });

  patchRoleCapabilities = asyncHandler(async (req: Request, res: Response) => {
    requireAuthUser(req.user);
    const body = req.validatedBody as PatchRoleCapabilitiesBody;
    const updated = await roleCapabilityService.patchRoleCapabilities(body.role as RoleName, {
      modules: body.modules,
      actions: body.actions,
    });
    const matrix = await roleCapabilityService.getConfigurableMatrix();
    return ApiResponse.ok(res, { updated, ...matrix }, 'Role capabilities updated');
  });
}

export const platformController = new PlatformController();
