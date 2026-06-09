import { request, requestDataAndMeta } from '@/lib/axios';
import type { PaginationMeta } from '@/types/api';

import type {
  PublicAvailabilityResponse,
  PublicBookingPayload,
  PublicLibraryProfile,
} from './types';

export const bookingsApi = {
  async getPublicLibrary(slug: string): Promise<PublicLibraryProfile> {
    return request<PublicLibraryProfile>({
      url: `/public/libraries/${encodeURIComponent(slug)}`,
      method: 'GET',
      _skipAuth: true,
    });
  },

  async getPublicAvailability(
    slug: string,
    params: { branchId: string; shiftId: string; date?: string },
  ): Promise<PublicAvailabilityResponse> {
    return request<PublicAvailabilityResponse>({
      url: `/public/libraries/${encodeURIComponent(slug)}/availability`,
      method: 'GET',
      params,
      _skipAuth: true,
    });
  },

  async createPublicBooking(slug: string, payload: PublicBookingPayload): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>({
      url: `/public/libraries/${encodeURIComponent(slug)}/bookings`,
      method: 'POST',
      data: payload,
      _skipAuth: true,
    });
  },

  async listOwnerBookings(params: {
    page?: number;
    limit?: number;
    libraryId?: string;
    bookingStatus?: string;
    paymentStatus?: string;
    branchId?: string;
    shiftId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }): Promise<{ items: Record<string, unknown>[]; pagination?: PaginationMeta }> {
    const { data, meta } = await requestDataAndMeta<{ items: Record<string, unknown>[] }>({
      url: '/bookings',
      method: 'GET',
      params,
    });
    return { items: data.items, pagination: meta?.pagination };
  },

  async approveBooking(bookingId: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>({
      url: `/bookings/${bookingId}/approve`,
      method: 'POST',
    });
  },

  async getOwnerBooking(bookingId: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>({
      url: `/bookings/${bookingId}`,
      method: 'GET',
    });
  },

  async getAdmissionPrefill(bookingId: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>({
      url: `/bookings/${bookingId}/admission-prefill`,
      method: 'GET',
    });
  },

  async rejectBooking(bookingId: string, reason?: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>({
      url: `/bookings/${bookingId}/reject`,
      method: 'POST',
      data: { reason },
    });
  },

  async releasePublicHold(bookingId: string, note?: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>({
      url: `/bookings/${bookingId}/release-hold`,
      method: 'POST',
      data: { note },
    });
  },

  async convertToStudent(bookingId: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>({
      url: `/bookings/${bookingId}/convert-to-student`,
      method: 'POST',
    });
  },
};
