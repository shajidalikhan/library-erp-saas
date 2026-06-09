import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { libraryService } from './library.service';
import type {
  CreateBranchInput,
  CreateLibraryInput,
  ListBranchesQuery,
  ListLibrariesQuery,
  PatchLibrarySettingsInput,
  UpdateBranchInput,
  UpdateLibraryInput,
} from './library.validation';

class LibraryController {
  listLibraries = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListLibrariesQuery;
    const { items, meta } = await libraryService.listLibraries(user, query);
    return ApiResponse.ok(res, { items }, 'Libraries retrieved', meta);
  });

  createLibrary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CreateLibraryInput;
    const created = await libraryService.createLibrary(user, body, req.file ?? undefined);
    return ApiResponse.created(res, { library: created }, 'Library created');
  });

  getLibrary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = (req.validatedParams ?? req.params) as { libraryId: string };
    const library = await libraryService.getLibraryById(user, libraryId);
    return ApiResponse.ok(res, { library }, 'Library retrieved');
  });

  updateLibrary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = (req.validatedParams ?? req.params) as { libraryId: string };
    const body = (req.validatedBody ?? req.body) as UpdateLibraryInput;
    const library = await libraryService.updateLibrary(user, libraryId, body, req.file ?? undefined);
    return ApiResponse.ok(res, { library }, 'Library updated');
  });

  patchLibrarySettings = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = (req.validatedParams ?? req.params) as { libraryId: string };
    const body = (req.validatedBody ?? req.body) as PatchLibrarySettingsInput;
    const library = await libraryService.patchSettings(user, libraryId, body);
    return ApiResponse.ok(res, { library }, 'Library settings updated');
  });

  deleteLibrary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = (req.validatedParams ?? req.params) as { libraryId: string };
    const body = (req.validatedBody ?? req.body) as { confirmPhrase?: string };
    const result = await libraryService.deleteLibrary(user, libraryId, {
      confirmPhrase: body.confirmPhrase,
    });
    return ApiResponse.ok(res, result, 'Library deleted');
  });

  getBranchDeleteImpact = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId, branchId } = (req.validatedParams ?? req.params) as {
      libraryId: string;
      branchId: string;
    };
    const impact = await libraryService.getBranchDeleteImpactSummary(user, libraryId, branchId);
    return ApiResponse.ok(res, impact, 'Branch delete impact');
  });

  listBranches = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = (req.validatedParams ?? req.params) as { libraryId: string };
    const query = (req.validatedQuery ?? req.query) as ListBranchesQuery;
    const { items, meta } = await libraryService.listBranches(user, libraryId, query);
    return ApiResponse.ok(res, { items }, 'Branches retrieved', meta);
  });

  createBranch = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId } = (req.validatedParams ?? req.params) as { libraryId: string };
    const body = (req.validatedBody ?? req.body) as CreateBranchInput;
    const branch = await libraryService.createBranch(user, libraryId, body);
    return ApiResponse.created(res, { branch }, 'Branch created');
  });

  getBranch = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId, branchId } = (req.validatedParams ?? req.params) as {
      libraryId: string;
      branchId: string;
    };
    const branch = await libraryService.getBranchById(user, libraryId, branchId);
    return ApiResponse.ok(res, { branch }, 'Branch retrieved');
  });

  updateBranch = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId, branchId } = (req.validatedParams ?? req.params) as {
      libraryId: string;
      branchId: string;
    };
    const body = (req.validatedBody ?? req.body) as UpdateBranchInput;
    const branch = await libraryService.updateBranch(user, libraryId, branchId, body);
    return ApiResponse.ok(res, { branch }, 'Branch updated');
  });

  deleteBranch = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { libraryId, branchId } = (req.validatedParams ?? req.params) as {
      libraryId: string;
      branchId: string;
    };
    const result = await libraryService.deleteBranch(user, libraryId, branchId);
    return ApiResponse.ok(res, result, 'Branch deleted');
  });
}

export const libraryController = new LibraryController();
