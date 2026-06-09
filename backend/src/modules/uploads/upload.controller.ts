import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';

import { uploadFacadeService } from './upload-facade.service';

export const uploadController = {
  libraryLogo: asyncHandler(async (req: Request, res: Response) => {
    const asset = await uploadFacadeService.uploadLibraryLogo(req);
    return ApiResponse.ok(res, asset, 'Logo uploaded');
  }),

  branchLogo: asyncHandler(async (req: Request, res: Response) => {
    const asset = await uploadFacadeService.uploadBranchLogo(req);
    return ApiResponse.ok(res, asset, 'Logo uploaded');
  }),

  studentPhoto: asyncHandler(async (req: Request, res: Response) => {
    const asset = await uploadFacadeService.uploadStudentPhoto(req);
    return ApiResponse.ok(res, asset, 'Photo uploaded');
  }),

  studentDocument: asyncHandler(async (req: Request, res: Response) => {
    const asset = await uploadFacadeService.uploadStudentDocument(req);
    return ApiResponse.ok(res, asset, 'Document uploaded');
  }),

  publicLibraryPhoto: asyncHandler(async (req: Request, res: Response) => {
    const asset = await uploadFacadeService.uploadPublicLibraryPhoto(req);
    return ApiResponse.ok(res, asset, 'Public page photo uploaded');
  }),
};
