import { Router, type RequestHandler } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { authorizeIdCardAccess } from '@middlewares/id-card-access.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';

import { optionalStudentAdmissionMultipart, optionalStudentMultipart } from './student-multipart.middleware';
import { PERMISSIONS } from '@constants/permissions.constants';

import { studentController } from './student.controller';
import {
  assignSeatSchema,
  createStudentSchema,
  listStudentsQuerySchema,
  studentIdParamsSchema,
  transferStudentSchema,
  updateStudentSchema,
} from './student.validation';
import { studentAdmissionBodySchema } from './student-admission.validation';

const router = Router();

const validateBodyUnlessMultipart =
  (schema: Parameters<typeof validate>[0]['body']): RequestHandler =>
  (req, res, next) => {
    if (req.validatedBody) return next();
    return validate({ body: schema })(req, res, next);
  };

router.use(authenticate);

router.get('/students/me', studentController.getMyStudentProfile);

router.get(
  '/students/me/attendance',
  validate({ query: listStudentsQuerySchema }),
  studentController.getMyAttendance,
);

router.get('/students/me/payments', studentController.getMyPayments);

router.get('/students/me/seat', studentController.getMySeat);

router.get('/students/me/qr', studentController.getMyAttendanceQr);

router.get('/students/me/id-card', authorizeIdCardAccess, studentController.downloadMyIdCard);

router.get(
  '/students',
  authorizeAny(PERMISSIONS.STUDENT_READ, PERMISSIONS.STUDENT_READ_BASIC),
  requireRoleCapability('students', 'view'),
  validate({ query: listStudentsQuerySchema }),
  studentController.listStudents,
);

router.post(
  '/students',
  authorize(PERMISSIONS.STUDENT_CREATE),
  requireRoleCapability('students', 'create', PERMISSIONS.STUDENT_CREATE),
  optionalStudentMultipart(createStudentSchema),
  validateBodyUnlessMultipart(createStudentSchema),
  studentController.createStudent,
);

router.post(
  '/students/admission',
  authorize(PERMISSIONS.STUDENT_CREATE),
  requireRoleCapability('students', 'create', PERMISSIONS.STUDENT_CREATE),
  optionalStudentAdmissionMultipart(studentAdmissionBodySchema),
  validateBodyUnlessMultipart(studentAdmissionBodySchema),
  studentController.admitStudent,
);

router.get(
  '/students/:studentId/summary',
  authorizeAny(PERMISSIONS.STUDENT_READ, PERMISSIONS.STUDENT_READ_BASIC),
  validate({ params: studentIdParamsSchema }),
  studentController.getStudentSummary,
);

router.get(
  '/students/:studentId',
  authorizeAny(PERMISSIONS.STUDENT_READ, PERMISSIONS.STUDENT_READ_BASIC),
  validate({ params: studentIdParamsSchema }),
  studentController.getStudent,
);

router.patch(
  '/students/:studentId',
  authorize(PERMISSIONS.STUDENT_UPDATE),
  requireRoleCapability('students', 'edit', PERMISSIONS.STUDENT_UPDATE),
  validate({ params: studentIdParamsSchema }),
  optionalStudentMultipart(updateStudentSchema),
  validateBodyUnlessMultipart(updateStudentSchema),
  studentController.updateStudent,
);

router.delete(
  '/students/:studentId',
  authorize(PERMISSIONS.STUDENT_DELETE),
  requireRoleCapability('students', 'delete', PERMISSIONS.STUDENT_DELETE),
  validate({ params: studentIdParamsSchema }),
  studentController.deleteStudent,
);

router.post(
  '/students/:studentId/transfer',
  authorize(PERMISSIONS.STUDENT_TRANSFER),
  requireRoleCapability('students', 'transfer', PERMISSIONS.STUDENT_TRANSFER),
  validate({ params: studentIdParamsSchema, body: transferStudentSchema }),
  studentController.transferStudent,
);

router.patch(
  '/students/:studentId/seat',
  authorize(PERMISSIONS.STUDENT_ASSIGN_SEAT),
  requireRoleCapability('students', 'assign_seat', PERMISSIONS.STUDENT_ASSIGN_SEAT),
  validate({ params: studentIdParamsSchema, body: assignSeatSchema }),
  studentController.assignSeat,
);

router.get(
  '/students/:studentId/id-card',
  authorizeIdCardAccess,
  validate({ params: studentIdParamsSchema }),
  studentController.downloadIdCard,
);

export { router as studentRoutes };
