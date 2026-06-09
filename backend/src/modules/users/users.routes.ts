import { Router } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { PERMISSIONS } from '@constants/permissions.constants';

import { usersController } from './users.controller';
import {
  createUserBodySchema,
  deleteUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './users.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/users',
  authorizeAny(PERMISSIONS.USER_READ, PERMISSIONS.STAFF_READ),
  validate({ query: listUsersQuerySchema }),
  usersController.listUsers,
);

router.post(
  '/users',
  authorizeAny(PERMISSIONS.USER_CREATE, PERMISSIONS.STAFF_CREATE),
  validate({ body: createUserBodySchema }),
  usersController.createUser,
);

router.get(
  '/users/:userId',
  authorizeAny(PERMISSIONS.USER_READ, PERMISSIONS.STAFF_READ),
  validate({ params: userIdParamsSchema }),
  usersController.getUser,
);

router.patch(
  '/users/:userId',
  authorizeAny(PERMISSIONS.USER_UPDATE, PERMISSIONS.STAFF_UPDATE),
  validate({ params: userIdParamsSchema, body: updateUserBodySchema }),
  usersController.updateUser,
);

router.patch(
  '/users/:userId/activate',
  authorizeAny(PERMISSIONS.USER_UPDATE),
  validate({ params: userIdParamsSchema }),
  usersController.activateUser,
);

router.patch(
  '/users/:userId/deactivate',
  authorizeAny(PERMISSIONS.USER_DELETE, PERMISSIONS.STAFF_DELETE),
  validate({ params: userIdParamsSchema }),
  usersController.deactivateUser,
);

router.delete(
  '/users/:userId',
  authorizeAny(PERMISSIONS.USER_DELETE, PERMISSIONS.STAFF_DELETE),
  validate({ params: userIdParamsSchema, body: deleteUserBodySchema }),
  usersController.deleteUser,
);

export { router as userRoutes };
