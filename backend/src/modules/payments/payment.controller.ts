import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { paymentService } from './payment.service';
import type {
  CollectPaymentInput,
  CreateFeePlanInput,
  CreateInvoiceInput,
  FeePlanListQuery,
  InvoiceListQuery,
  PaymentListQuery,
  PaymentSummaryQuery,
  RefundInput,
  UpdateFeePlanInput,
  UpdateInvoiceInput,
} from './payment.validation';

class PaymentController {
  createFeePlan = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CreateFeePlanInput;
    const feePlan = await paymentService.createFeePlan(user, body);
    return ApiResponse.created(res, { feePlan }, 'Fee plan created');
  });

  listFeePlans = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as FeePlanListQuery;
    const { items, meta } = await paymentService.listFeePlans(user, query);
    return ApiResponse.ok(res, { items }, 'Fee plans', meta);
  });

  updateFeePlan = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { feePlanId } = (req.validatedParams ?? req.params) as { feePlanId: string };
    const body = (req.validatedBody ?? req.body) as UpdateFeePlanInput;
    const feePlan = await paymentService.updateFeePlan(user, feePlanId, body);
    return ApiResponse.ok(res, { feePlan }, 'Fee plan updated');
  });

  deleteFeePlan = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { feePlanId } = (req.validatedParams ?? req.params) as { feePlanId: string };
    const result = await paymentService.deleteFeePlan(user, feePlanId);
    return ApiResponse.ok(res, result, 'Fee plan deactivated');
  });

  createInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CreateInvoiceInput;
    const invoice = await paymentService.createInvoice(user, body);
    return ApiResponse.created(res, { invoice }, 'Invoice created');
  });

  listInvoices = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as InvoiceListQuery;
    const { items, meta } = await paymentService.listInvoices(user, query);
    return ApiResponse.ok(res, { items }, 'Invoices', meta);
  });

  listDues = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as InvoiceListQuery;
    const { items, meta } = await paymentService.listDues(user, query);
    return ApiResponse.ok(res, { items }, 'Dues', meta);
  });

  listOverdue = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as InvoiceListQuery;
    const { items, meta } = await paymentService.listOverdue(user, query);
    return ApiResponse.ok(res, { items }, 'Overdue invoices', meta);
  });

  getInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { invoiceId } = (req.validatedParams ?? req.params) as { invoiceId: string };
    const invoice = await paymentService.getInvoice(user, invoiceId);
    return ApiResponse.ok(res, { invoice }, 'Invoice');
  });

  updateInvoice = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { invoiceId } = (req.validatedParams ?? req.params) as { invoiceId: string };
    const body = (req.validatedBody ?? req.body) as UpdateInvoiceInput;
    const invoice = await paymentService.updateInvoice(user, invoiceId, body);
    return ApiResponse.ok(res, { invoice }, 'Invoice updated');
  });

  collectPayment = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CollectPaymentInput;
    const data = await paymentService.collectPayment(user, body);
    return ApiResponse.created(res, data, 'Payment recorded');
  });

  listPayments = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as PaymentListQuery;
    const { items, meta } = await paymentService.listPayments(user, query);
    return ApiResponse.ok(res, { items }, 'Payments', meta);
  });

  getReceipt = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { paymentId } = (req.validatedParams ?? req.params) as { paymentId: string };
    const data = await paymentService.getReceipt(user, paymentId);
    return ApiResponse.ok(res, data, 'Receipt');
  });

  refundPayment = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as RefundInput;
    const data = await paymentService.refundPayment(user, body);
    return ApiResponse.ok(res, data, 'Refund recorded');
  });

  voidPayment = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { paymentId } = (req.validatedParams ?? req.params) as { paymentId: string };
    const data = await paymentService.voidPayment(user, paymentId);
    return ApiResponse.ok(res, data, 'Payment voided');
  });

  studentHistory = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const data = await paymentService.studentHistory(user, studentId);
    return ApiResponse.ok(res, data, 'Student payment history');
  });

  summary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as PaymentSummaryQuery;
    const data = await paymentService.summary(user, query);
    return ApiResponse.ok(res, data, 'Collection summary');
  });
}

export const paymentController = new PaymentController();
