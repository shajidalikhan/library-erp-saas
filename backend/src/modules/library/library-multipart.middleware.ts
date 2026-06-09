import multer from 'multer';

import type { NextFunction, Request, Response } from 'express';
import type { RequestHandler } from 'express';

import { ApiError } from '@utils/ApiError';
import { UPLOAD_LIMITS } from '@/services/upload.service';

import { createLibrarySchema, updateLibrarySchema, type CreateLibraryInput } from './library.validation';

const storage = multer.memoryStorage();

const imageMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const blocked = new Set(['image/svg+xml', 'image/svg']);

const logoFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (blocked.has(file.mimetype)) {
    cb(ApiError.badRequest('SVG uploads are not allowed'));
    return;
  }
  if (!imageMimes.has(file.mimetype)) {
    cb(ApiError.badRequest('Library logo must be JPG, PNG, or WEBP'));
    return;
  }
  cb(null, true);
};

const uploadLogoMemory = multer({
  storage,
  limits: { fileSize: UPLOAD_LIMITS.logoBytes },
  fileFilter: logoFilter,
}).single('logo');

const isMultipart = (req: Request): boolean =>
  Boolean((req.headers['content-type'] ?? '').includes('multipart/form-data'));

export function conditionalLibraryMultipart(req: Request, res: Response, next: NextFunction): void {
  if (!isMultipart(req)) {
    next();
    return;
  }
  uploadLogoMemory(req, res, (err) => {
    if (err) {
      next(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    next();
  });
}

export const parseMultipartLibraryMiddleware: RequestHandler = (req, _res, next) => {
  try {
    if (!isMultipart(req)) return next();

    const body = req.body as Record<string, unknown>;
    if (typeof body.payload !== 'string') {
      return next(ApiError.badRequest('Expected multipart field "payload" (JSON string)'));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.payload) as unknown;
    } catch {
      return next(ApiError.badRequest('Invalid JSON in payload field'));
    }

    req.validatedBody = createLibrarySchema.parse(parsed) as CreateLibraryInput;
    return next();
  } catch (e) {
    next(e);
  }
};

export const parseMultipartUpdateLibraryMiddleware: RequestHandler = (req, _res, next) => {
  try {
    if (!isMultipart(req)) return next();

    const body = req.body as Record<string, unknown>;
    if (typeof body.payload !== 'string') {
      return next(ApiError.badRequest('Expected multipart field "payload" (JSON string)'));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.payload) as unknown;
    } catch {
      return next(ApiError.badRequest('Invalid JSON in payload field'));
    }

    req.validatedBody = updateLibrarySchema.parse(parsed);
    return next();
  } catch (e) {
    next(e);
  }
};
