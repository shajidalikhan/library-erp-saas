import { Router } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { requireSubscriptionFeature } from '@middlewares/require-subscription-feature.middleware';
import { authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  uploadLogoFile,
  uploadPublicPagePhoto,
  uploadProfilePhoto,
  uploadStudentDocument,
} from '@middlewares/upload.middleware';

import { uploadController } from './upload.controller';
import {
  uploadLibraryLogoQuerySchema,
  uploadPublicLibraryPhotoQuerySchema,
} from './upload.validation';

const router = Router();

/** Per-route auth only — router-level `authenticate` broke all other public API routes mounted after this router (e.g. POST /demo-requests). */
router.post(
  '/uploads/library-logo',
  authenticate,
  validate({ query: uploadLibraryLogoQuerySchema }),
  uploadLogoFile,
  uploadController.libraryLogo,
);

router.post(
  '/uploads/branch-logo',
  authenticate,
  uploadLogoFile,
  uploadController.branchLogo,
);

router.post(
  '/uploads/student-photo',
  authenticate,
  uploadProfilePhoto,
  uploadController.studentPhoto,
);

router.post(
  '/uploads/student-document',
  authenticate,
  uploadStudentDocument,
  uploadController.studentDocument,
);

router.post(
  '/uploads/public-library-photo',
  authenticate,
  requireSubscriptionFeature('public_booking'),
  authorizeAny(PERMISSIONS.PUBLIC_PAGE_MANAGE, PERMISSIONS.LIBRARY_UPDATE),
  requireRoleCapability('public_booking', 'manage', PERMISSIONS.PUBLIC_PAGE_MANAGE),
  validate({ query: uploadPublicLibraryPhotoQuerySchema }),
  uploadPublicPagePhoto,
  uploadController.publicLibraryPhoto,
);

export { router as uploadRoutes };
