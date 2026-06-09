import { Router, type RequestHandler } from 'express';

import { ZodError } from 'zod';



import { authenticate } from '@middlewares/auth.middleware';

import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { requireSubscriptionFeature } from '@middlewares/require-subscription-feature.middleware';

import { validate } from '@middlewares/validate.middleware';

import { PERMISSIONS } from '@constants/permissions.constants';

import { ApiError } from '@utils/ApiError';



import {

  conditionalLibraryMultipart,

  parseMultipartLibraryMiddleware,

  parseMultipartUpdateLibraryMiddleware,

} from './library-multipart.middleware';



import { libraryController } from './library.controller';

import {

  branchIdParamsSchema,

  createBranchSchema,

  createLibrarySchema,

  deleteLibraryBodySchema,

  listBranchesQuerySchema,

  listLibrariesQuerySchema,

  libraryIdParamsSchema,

  patchLibrarySettingsSchema,

  updateBranchSchema,

  updateLibrarySchema,

} from './library.validation';



const router = Router();



router.use(authenticate);



const validateLibraryCreateFlexible: RequestHandler = (req, res, next) => {

  if (req.validatedBody !== undefined) return next();

  try {

    req.validatedBody = createLibrarySchema.parse(req.body);

    return next();

  } catch (err) {

    if (err instanceof ZodError) next(ApiError.unprocessable('Validation failed', err.flatten()));

    else next(err);

  }

};



/** Params always parsed; multipart updates set validatedBody separately. */

const validateLibraryPatchFlexible: RequestHandler = (req, res, next) => {

  if (req.validatedBody !== undefined) return next();

  try {

    const params = libraryIdParamsSchema.parse(req.params);

    const body = updateLibrarySchema.parse(req.body);

    req.validatedParams = params;

    req.validatedBody = body;

    return next();

  } catch (err) {

    if (err instanceof ZodError) next(ApiError.unprocessable('Validation failed', err.flatten()));

    else next(err);

  }

};



router.get(

  '/libraries',

  authorize(PERMISSIONS.LIBRARY_READ),

  validate({ query: listLibrariesQuerySchema }),

  libraryController.listLibraries,

);



router.post(

  '/libraries',

  authorize(PERMISSIONS.LIBRARY_CREATE),

  conditionalLibraryMultipart,

  parseMultipartLibraryMiddleware,

  validateLibraryCreateFlexible,

  libraryController.createLibrary,

);



router.get(

  '/libraries/:libraryId',

  authorize(PERMISSIONS.LIBRARY_READ),

  validate({ params: libraryIdParamsSchema }),

  libraryController.getLibrary,

);



router.patch(

  '/libraries/:libraryId',

  authorize(PERMISSIONS.LIBRARY_UPDATE),

  validate({ params: libraryIdParamsSchema }),

  conditionalLibraryMultipart,

  parseMultipartUpdateLibraryMiddleware,

  validateLibraryPatchFlexible,

  libraryController.updateLibrary,

);



router.patch(

  '/libraries/:libraryId/settings',

  requireSubscriptionFeature('public_booking'),

  authorizeAny(PERMISSIONS.LIBRARY_UPDATE, PERMISSIONS.PUBLIC_PAGE_MANAGE),

  requireRoleCapability('public_booking', 'manage', PERMISSIONS.PUBLIC_PAGE_MANAGE),

  validate({ params: libraryIdParamsSchema, body: patchLibrarySettingsSchema }),

  libraryController.patchLibrarySettings,

);



router.delete(

  '/libraries/:libraryId',

  authorize(PERMISSIONS.LIBRARY_DELETE),

  validate({ params: libraryIdParamsSchema, body: deleteLibraryBodySchema }),

  libraryController.deleteLibrary,

);



router.get(

  '/libraries/:libraryId/branches/:branchId/delete-impact',

  authorize(PERMISSIONS.BRANCH_DELETE),

  validate({ params: branchIdParamsSchema }),

  libraryController.getBranchDeleteImpact,

);



router.get(

  '/libraries/:libraryId/branches',

  authorize(PERMISSIONS.BRANCH_READ),

  validate({ params: libraryIdParamsSchema, query: listBranchesQuerySchema }),

  libraryController.listBranches,

);



router.post(

  '/libraries/:libraryId/branches',

  authorize(PERMISSIONS.BRANCH_CREATE),

  validate({ params: libraryIdParamsSchema, body: createBranchSchema }),

  libraryController.createBranch,

);



router.get(

  '/libraries/:libraryId/branches/:branchId',

  authorize(PERMISSIONS.BRANCH_READ),

  validate({ params: branchIdParamsSchema }),

  libraryController.getBranch,

);



router.patch(

  '/libraries/:libraryId/branches/:branchId',

  authorize(PERMISSIONS.BRANCH_UPDATE),

  validate({ params: branchIdParamsSchema, body: updateBranchSchema }),

  libraryController.updateBranch,

);



router.delete(

  '/libraries/:libraryId/branches/:branchId',

  authorize(PERMISSIONS.BRANCH_DELETE),

  validate({ params: branchIdParamsSchema }),

  libraryController.deleteBranch,

);



export { router as libraryRoutes };

