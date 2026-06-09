import { Router } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';

import { searchController } from './search.controller';
import { globalSearchQuerySchema } from './search.validation';

const router = Router();

router.use(authenticate);

router.get('/search', validate({ query: globalSearchQuerySchema }), searchController.global);

export { router as searchRoutes };
