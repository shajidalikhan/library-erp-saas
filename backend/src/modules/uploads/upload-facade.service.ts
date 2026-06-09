import type { Request } from 'express';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { ApiError } from '@utils/ApiError';
import {
  uploadBranchLogo,
  uploadLibraryLogo,
  uploadPublicLibraryPhoto,
  uploadStudentDocument,
  uploadStudentProfilePhoto,
} from '@/services/upload.service';

const requireFile = (req: Request): Express.Multer.File => {
  const file = req.file;
  if (!file) throw ApiError.badRequest('No file uploaded');
  return file;
};

const previousFromBody = (req: Request): string | undefined => {
  const raw = (req.body as { previousPublicId?: string })?.previousPublicId;
  return raw?.trim() || undefined;
};

const assertLibraryUpdateAccess = (req: Request, libraryId?: string): void => {
  const user = req.user!;
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (user.role === ROLES.LIBRARY_OWNER) {
    if (!user.libraryId) throw ApiError.forbidden('No library assigned');
    if (libraryId && user.libraryId !== libraryId) {
      throw ApiError.forbidden('You cannot upload for another library');
    }
    return;
  }
  if (!user.permissions.includes(PERMISSIONS.LIBRARY_UPDATE)) {
    throw ApiError.forbidden('Insufficient permissions');
  }
};

const assertPublicPageManageAccess = (req: Request, libraryId?: string): string => {
  const user = req.user!;
  if (user.role === ROLES.SUPER_ADMIN) {
    if (!libraryId) throw ApiError.badRequest('libraryId is required for platform operators');
    return libraryId;
  }
  if (user.role === ROLES.LIBRARY_OWNER) {
    if (!user.libraryId) throw ApiError.forbidden('No library assigned');
    if (libraryId && user.libraryId !== libraryId) {
      throw ApiError.forbidden('You cannot upload for another library');
    }
    return user.libraryId;
  }
  if (user.permissions.includes(PERMISSIONS.PUBLIC_PAGE_MANAGE)) {
    if (!user.libraryId) throw ApiError.forbidden('No library assigned');
    if (libraryId && user.libraryId !== libraryId) {
      throw ApiError.forbidden('You cannot upload for another library');
    }
    return user.libraryId;
  }
  throw ApiError.forbidden('Insufficient permissions');
};

const assertBranchUpdateAccess = (req: Request): void => {
  const user = req.user!;
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.LIBRARY_OWNER) return;
  if (!user.permissions.includes(PERMISSIONS.BRANCH_UPDATE)) {
    throw ApiError.forbidden('Insufficient permissions');
  }
};

const assertStudentUploadAccess = (req: Request): void => {
  const user = req.user!;
  if (
    user.role === ROLES.SUPER_ADMIN ||
    user.role === ROLES.LIBRARY_OWNER ||
    user.permissions.includes(PERMISSIONS.STUDENT_CREATE) ||
    user.permissions.includes(PERMISSIONS.STUDENT_UPDATE)
  ) {
    return;
  }
  throw ApiError.forbidden('Insufficient permissions');
};

export const uploadFacadeService = {
  async uploadLibraryLogo(req: Request) {
    const libraryId = (req.query.libraryId as string | undefined)?.trim();
    assertLibraryUpdateAccess(req, libraryId);
    return uploadLibraryLogo(requireFile(req), previousFromBody(req));
  },

  async uploadBranchLogo(req: Request) {
    assertBranchUpdateAccess(req);
    return uploadBranchLogo(requireFile(req), previousFromBody(req));
  },

  async uploadStudentPhoto(req: Request) {
    assertStudentUploadAccess(req);
    return uploadStudentProfilePhoto(requireFile(req), previousFromBody(req));
  },

  async uploadStudentDocument(req: Request) {
    assertStudentUploadAccess(req);
    return uploadStudentDocument(requireFile(req), previousFromBody(req));
  },

  async uploadPublicLibraryPhoto(req: Request) {
    const requestedLibraryId = (req.query.libraryId as string | undefined)?.trim();
    const libraryId = assertPublicPageManageAccess(req, requestedLibraryId);
    return uploadPublicLibraryPhoto(requireFile(req), libraryId, previousFromBody(req));
  },
};
