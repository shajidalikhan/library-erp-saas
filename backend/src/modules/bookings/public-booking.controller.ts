import type { Request, Response } from 'express';

import { requireAuthUser } from '@middlewares/auth.middleware';
import { ApiResponse } from '@utils/ApiResponse';
import { asyncHandler } from '@utils/asyncHandler';

import { publicBookingService } from './public-booking.service';
import type {
  CreatePublicBookingInput,
  ListBookingsQuery,
  PublicAvailabilityQuery,
} from './public-booking.validation';

class PublicBookingController {
  getLibraryProfile = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = (req.validatedParams ?? req.params) as { slug: string };
    const payload = await publicBookingService.getPublicLibraryProfile(slug);
    return ApiResponse.ok(res, payload, 'Public library profile retrieved');
  });

  getAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = (req.validatedParams ?? req.params) as { slug: string };
    const query = (req.validatedQuery ?? req.query) as PublicAvailabilityQuery;
    const payload = await publicBookingService.getPublicAvailability(slug, query);
    return ApiResponse.ok(res, payload, 'Seat availability retrieved');
  });

  createBooking = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = (req.validatedParams ?? req.params) as { slug: string };
    const body = (req.validatedBody ?? req.body) as CreatePublicBookingInput;
    const payload = await publicBookingService.createPublicBooking(slug, body);
    return ApiResponse.created(res, payload, 'Booking created');
  });

  listOwnerBookings = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListBookingsQuery;
    const { items, meta } = await publicBookingService.listOwnerBookings(user, query);
    return ApiResponse.ok(res, { items }, 'Bookings retrieved', meta);
  });

  getOwnerBooking = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { bookingId } = (req.validatedParams ?? req.params) as { bookingId: string };
    const booking = await publicBookingService.getBookingByIdForOwner(user, bookingId);
    return ApiResponse.ok(res, { booking }, 'Booking retrieved');
  });

  getAdmissionPrefill = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { bookingId } = (req.validatedParams ?? req.params) as { bookingId: string };
    const prefill = await publicBookingService.getAdmissionPrefill(user, bookingId);
    return ApiResponse.ok(res, { prefill }, 'Admission prefill retrieved');
  });

  approveBooking = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { bookingId } = (req.validatedParams ?? req.params) as { bookingId: string };
    const booking = await publicBookingService.approveBooking(user, bookingId);
    return ApiResponse.ok(res, { booking }, 'Booking approved');
  });

  rejectBooking = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { bookingId } = (req.validatedParams ?? req.params) as { bookingId: string };
    const body = (req.validatedBody ?? req.body) as { reason?: string };
    const booking = await publicBookingService.rejectBooking(user, bookingId, body.reason);
    return ApiResponse.ok(res, { booking }, 'Booking rejected');
  });

  releaseHoldByStaff = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { bookingId } = (req.validatedParams ?? req.params) as { bookingId: string };
    const body = (req.validatedBody ?? req.body) as { note?: string };
    const booking = await publicBookingService.releaseHoldByStaff(user, bookingId, body.note);
    return ApiResponse.ok(res, { booking }, 'Public hold released');
  });

  convertToStudent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { bookingId } = (req.validatedParams ?? req.params) as { bookingId: string };
    const payload = await publicBookingService.convertToStudent(user, bookingId);
    return ApiResponse.ok(res, payload, 'Booking converted to student');
  });
}

export const publicBookingController = new PublicBookingController();
