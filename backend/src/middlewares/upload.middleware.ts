import multer from 'multer';

import { ApiError } from '@utils/ApiError';
import { UPLOAD_LIMITS } from '@/services/upload.service';

const storage = multer.memoryStorage();

const imageMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const documentMimes = new Set([...imageMimes, 'application/pdf']);
const blocked = new Set(['image/svg+xml', 'image/svg']);

const rejectBlocked = (file: Express.Multer.File, cb: multer.FileFilterCallback): boolean => {
  if (blocked.has(file.mimetype)) {
    cb(ApiError.badRequest('SVG uploads are not allowed'));
    return false;
  }
  return true;
};

const imageFilter = (label: string) => (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!rejectBlocked(file, cb)) return;
  if (!imageMimes.has(file.mimetype)) {
    cb(ApiError.badRequest(`${label} must be JPG, PNG, or WEBP`));
    return;
  }
  cb(null, true);
};

const documentFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!rejectBlocked(file, cb)) return;
  if (!documentMimes.has(file.mimetype)) {
    cb(ApiError.badRequest('Document must be JPG, PNG, WEBP, or PDF'));
    return;
  }
  cb(null, true);
};

/** Library / branch logo — field name `file`. */
export const uploadLogoFile = multer({
  storage,
  limits: { fileSize: UPLOAD_LIMITS.logoBytes, files: 1 },
  fileFilter: imageFilter('Logo'),
}).single('file');

/** Student create/update: optional profilePhoto + documentProof fields. */
export const uploadStudentFiles = multer({
  storage,
  limits: {
    fileSize: UPLOAD_LIMITS.documentBytes,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'profilePhoto') {
      if (!rejectBlocked(file, cb)) return;
      if (!imageMimes.has(file.mimetype)) {
        cb(ApiError.badRequest('Profile photo must be JPG, PNG, or WEBP'));
        return;
      }
      cb(null, true);
    } else if (file.fieldname === 'documentProof') {
      documentFilter(req, file, cb);
    } else {
      cb(ApiError.badRequest(`Unexpected upload field: ${file.fieldname}`));
    }
  },
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'documentProof', maxCount: 1 },
]);

export const uploadProfilePhoto = multer({
  storage,
  limits: { fileSize: UPLOAD_LIMITS.profilePhotoBytes },
  fileFilter: imageFilter('Profile photo'),
}).single('file');

export const uploadStudentDocument = multer({
  storage,
  limits: { fileSize: UPLOAD_LIMITS.documentBytes },
  fileFilter: documentFilter,
}).single('file');

export const uploadPublicPagePhoto = multer({
  storage,
  limits: { fileSize: UPLOAD_LIMITS.publicPagePhotoBytes, files: 1 },
  fileFilter: imageFilter('Public page photo'),
}).single('file');
