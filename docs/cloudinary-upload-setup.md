# Cloudinary upload setup

Library ERP stores uploaded media in [Cloudinary](https://cloudinary.com). The API compresses images with **Sharp** before upload to reduce storage and bandwidth.

## 1. Create a Cloudinary account

1. Sign up at [cloudinary.com](https://cloudinary.com).
2. Open the **Dashboard** and note:
   - Cloud name
   - API Key
   - API Secret

## 2. Backend environment

Add to `backend/.env` (see `backend/.env.example`):

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_FOLDER=library-erp
```

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Dashboard cloud name |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret (server only — never expose to the browser) |
| `CLOUDINARY_UPLOAD_FOLDER` | Root folder prefix (default `library-erp`) |

**Optional:** If these variables are empty, the app still starts. Upload endpoints return:

`Cloudinary upload service is not configured.`

## 3. Storage folders

Assets are stored under `{CLOUDINARY_UPLOAD_FOLDER}/…`:

| Type | Folder |
|------|--------|
| Library logo | `library-erp/libraries` |
| Branch logo | `library-erp/branches` |
| Student profile photo | `library-erp/students/photos` |
| Student document | `library-erp/students/documents` |

## 4. Upload API (authenticated)

| Endpoint | Field name | Max size (before compression) |
|----------|------------|-------------------------------|
| `POST /api/v1/uploads/library-logo` | `file` | 2MB |
| `POST /api/v1/uploads/branch-logo` | `file` | 2MB |
| `POST /api/v1/uploads/student-photo` | `file` | 2MB |
| `POST /api/v1/uploads/student-document` | `file` | 5MB |

Optional form fields:

- `previousPublicId` — deletes the old asset after a successful replace.

Query (library logo only):

- `libraryId` — for super-admin scoping when uploading before save.

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/...",
    "publicId": "library-erp/libraries/abc",
    "uploadedAt": "2026-05-19T12:00:00.000Z"
  }
}
```

Entity saves (library, branch, student) store `{ url, publicId, uploadedAt }` in MongoDB — not base64.

## 5. Image processing

- **Logos & profile photos:** rotated, max width 800px, WebP ~75% quality, metadata stripped.
- **Document images:** compressed similarly (wider max width).
- **PDFs:** uploaded as-is (`resource_type: raw`).

## 6. Security

- MIME type and extension checks (JPG, PNG, WEBP, PDF for documents).
- SVG and executables rejected.
- Secrets stay on the server; the frontend only receives public URLs.

## 7. Replace & cleanup

When a new file is uploaded with `previousPublicId`, or when an entity logo is cleared/replaced, the backend calls Cloudinary `destroy` on the old `publicId`. If deletion fails, a warning is logged and the request still succeeds.

## 8. Render / production deployment

In your Render (or similar) service **Environment**:

1. Add the four `CLOUDINARY_*` variables.
2. Redeploy the API service.
3. Confirm uploads from **Settings → Organization** (library owner) or **Libraries → Edit** (super admin).

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Cloudinary upload service is not configured` | Set all three credentials + redeploy |
| `Profile photo must be 2MB or smaller` | Choose a smaller source file |
| Upload 401 | User session expired — sign in again |
| Broken image URL | Asset may have been deleted in Cloudinary dashboard manually |
| CORS errors on upload | Upload goes through your API, not directly to Cloudinary |

## 10. Frontend usage

Reusable components live under `frontend/src/components/upload/`:

- `LogoUploadCard` — library logos
- `BranchLogoUploadCard` — branch logos
- `StudentPhotoUploadField` — student profile
- `DocumentUploadField` — Aadhaar / ID proof

They call `frontend/src/modules/uploads/upload.service.ts`, which posts multipart data to the endpoints above.
