import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { searchService } from './search.service';
import type { GlobalSearchQuery } from './search.validation';

class SearchController {
  global = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as GlobalSearchQuery;
    const data = await searchService.search(user, query);
    return ApiResponse.ok(res, data, 'Search results');
  });
}

export const searchController = new SearchController();
