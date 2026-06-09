import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { usersService } from './users.service';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.validation';

class UsersController {
  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListUsersQuery;
    const { items, meta } = await usersService.listUsers(user, query);
    return ApiResponse.ok(res, { items }, 'Users retrieved', meta);
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CreateUserInput;
    const created = await usersService.createUser(user, body);
    return ApiResponse.created(res, { user: created }, 'User created');
  });

  getUser = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { userId } = (req.validatedParams ?? req.params) as { userId: string };
    const u = await usersService.getUserById(user, userId);
    return ApiResponse.ok(res, { user: u }, 'User retrieved');
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { userId } = (req.validatedParams ?? req.params) as { userId: string };
    const body = (req.validatedBody ?? req.body) as UpdateUserInput;
    const u = await usersService.updateUser(user, userId, body);
    return ApiResponse.ok(res, { user: u }, 'User updated');
  });

  activateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { userId } = (req.validatedParams ?? req.params) as { userId: string };
    const result = await usersService.activateUser(user, userId);
    return ApiResponse.ok(res, result, 'User activated');
  });

  deactivateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { userId } = (req.validatedParams ?? req.params) as { userId: string };
    const result = await usersService.deactivateUser(user, userId);
    return ApiResponse.ok(res, result, 'User deactivated');
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { userId } = (req.validatedParams ?? req.params) as { userId: string };
    const result = await usersService.deleteUser(user, userId);
    return ApiResponse.ok(res, result, 'User deleted');
  });
}

export const usersController = new UsersController();
