import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';

import { uploadStudentFiles } from '@middlewares/upload.middleware';
import { ApiError } from '@utils/ApiError';
import { UPLOAD_LIMITS } from '@/services/upload.service';

import { getStudentUploadFiles, parseStudentMultipartBody } from './student-body.util';
import { parseAdmissionMultipartBody } from './student-admission-body.util';

const MAX_PROFILE_PHOTO_BYTES = UPLOAD_LIMITS.profilePhotoBytes;

const assertFileSizes = (req: Parameters<typeof getStudentUploadFiles>[0]): void => {
  const { profilePhoto, documentProof } = getStudentUploadFiles(req);
  if (profilePhoto && profilePhoto.size > MAX_PROFILE_PHOTO_BYTES) {
    throw ApiError.badRequest('Profile photo must be 2MB or smaller');
  }
  if (documentProof && documentProof.size > UPLOAD_LIMITS.documentBytes) {
    throw ApiError.badRequest('Document proof must be 5MB or smaller');
  }
};

/** Parses multipart student body after multer; JSON requests skip this middleware. */
export const validateStudentMultipart =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    try {
      assertFileSizes(req);
      req.validatedBody = schema.parse(parseStudentMultipartBody(req));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(ApiError.unprocessable('Validation failed', err.flatten()));
        return;
      }
      next(err);
    }
  };

export const optionalStudentMultipart =
  (schema: ZodTypeAny): RequestHandler =>
  (req, res, next) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }
    uploadStudentFiles(req, res, (err) => {
      if (err) return next(err);
      validateStudentMultipart(schema)(req, res, next);
    });
  };

export const optionalStudentAdmissionMultipart =
  (schema: ZodTypeAny): RequestHandler =>
  (req, res, next) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }
    uploadStudentFiles(req, res, (err) => {
      if (err) return next(err);
      try {
        assertFileSizes(req);
        req.validatedBody = schema.parse(parseAdmissionMultipartBody(req));
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          next(ApiError.unprocessable('Validation failed', error.flatten()));
          return;
        }
        if (error instanceof Error && error.message.startsWith('Invalid JSON')) {
          next(ApiError.badRequest(error.message));
          return;
        }
        next(error);
      }
    });
  };
