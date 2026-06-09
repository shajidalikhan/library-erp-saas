import { v2 as cloudinary } from 'cloudinary';

import { ENV } from './env.config';

export const CLOUDINARY_CONFIGURED = Boolean(
  ENV.CLOUDINARY_CLOUD_NAME?.trim() &&
    ENV.CLOUDINARY_API_KEY?.trim() &&
    ENV.CLOUDINARY_API_SECRET?.trim(),
);

if (CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
    api_key: ENV.CLOUDINARY_API_KEY,
    api_secret: ENV.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };
