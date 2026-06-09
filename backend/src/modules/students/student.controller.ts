import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { generateStudentIdCardPdf, resolveStudentIdForUser } from './id-card.service';
import { getStudentUploadFiles } from './student-body.util';
import { studentAdmissionService } from './student-admission.service';
import { studentService } from './student.service';
import type { StudentAdmissionInput } from './student-admission.validation';
import type {
  AssignSeatInput,
  CreateStudentInput,
  ListStudentsQuery,
  TransferStudentInput,
  UpdateStudentInput,
} from './student.validation';

class StudentController {
  listStudents = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListStudentsQuery;
    const { items, meta } = await studentService.listStudents(user, query);
    return ApiResponse.ok(res, { items }, 'Students retrieved', meta);
  });

  createStudent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CreateStudentInput;
    const files = getStudentUploadFiles(req);
    const student = await studentService.createStudent(user, body, files);
    return ApiResponse.created(res, { student }, 'Student created');
  });

  admitStudent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as StudentAdmissionInput;
    const files = getStudentUploadFiles(req);
    const result = await studentAdmissionService.admitStudent(user, body, files);
    return ApiResponse.created(res, result, 'Student admitted');
  });

  getStudent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const student = await studentService.getStudentById(user, studentId);
    return ApiResponse.ok(res, { student }, 'Student retrieved');
  });

  getStudentSummary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const summary = await studentService.getStudentSummary(user, studentId);
    return ApiResponse.ok(res, summary, 'Student summary');
  });

  getMyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const student = await studentService.getMyStudentProfile(user);
    return ApiResponse.ok(res, { student }, 'My student profile');
  });

  getMyAttendance = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListStudentsQuery;
    const { items, meta } = await studentService.getMyAttendance(user, query);
    return ApiResponse.ok(res, { items }, 'My attendance', meta);
  });

  getMyPayments = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const payments = await studentService.getMyPayments(user);
    return ApiResponse.ok(res, payments, 'My payments');
  });

  getMySeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const seat = await studentService.getMySeat(user);
    return ApiResponse.ok(res, { seat }, 'My seat');
  });

  getMyAttendanceQr = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const payload = await studentService.getMyAttendanceQr(user);
    return ApiResponse.ok(res, payload, 'Attendance QR');
  });

  updateStudent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const body = (req.validatedBody ?? req.body) as UpdateStudentInput;
    const files = getStudentUploadFiles(req);
    const student = await studentService.updateStudent(user, studentId, body, files);
    return ApiResponse.ok(res, { student }, 'Student updated');
  });

  deleteStudent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const result = await studentService.deleteStudent(user, studentId);
    return ApiResponse.ok(res, result, 'Student deleted');
  });

  transferStudent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const body = (req.validatedBody ?? req.body) as TransferStudentInput;
    const student = await studentService.transferBranch(user, studentId, body);
    return ApiResponse.ok(res, { student }, 'Student transferred');
  });

  assignSeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const body = (req.validatedBody ?? req.body) as AssignSeatInput;
    const student = await studentService.assignSeat(user, studentId, body);
    return ApiResponse.ok(res, { student }, 'Seat assignment updated');
  });

  downloadIdCard = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const pdf = await generateStudentIdCardPdf(user, studentId);
    const inline = req.query.disposition === 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      inline
        ? 'inline'
        : `attachment; filename="id-card-${studentId}.pdf"`,
    );
    res.send(pdf);
  });

  downloadMyIdCard = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const studentId = await resolveStudentIdForUser(user.id);
    const pdf = await generateStudentIdCardPdf(user, studentId);
    const inline = req.query.disposition === 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      inline ? 'inline' : `attachment; filename="id-card-${studentId}.pdf"`,
    );
    res.send(pdf);
  });
}

export const studentController = new StudentController();
