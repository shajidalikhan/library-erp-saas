import { request, requestDataAndMeta } from '@/lib/axios';

import type {
  FeePlan,
  Invoice,
  Paginated,
  PaymentMethod,
  PaymentRecord,
  PaymentSummaryResponse,
  StudentPaymentHistoryResponse,
} from './types';

export const paymentApi = {
  async listFeePlans(params: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
    libraryId?: string;
    type?: FeePlan['type'];
    active?: boolean;
  }): Promise<Paginated<FeePlan>> {
    const { data, meta } = await requestDataAndMeta<{ items: FeePlan[] }>({
      url: '/payments/fee-plans',
      method: 'GET',
      params: {
        ...params,
        active: params.active === undefined ? undefined : String(params.active),
      },
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: {
          total: data.items.length,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
    return { items: data.items, pagination };
  },

  async createFeePlan(body: {
    libraryId?: string;
    branchId: string;
    name: string;
    type?: FeePlan['type'];
    amount: number;
    durationDays: number;
    shiftId?: string | null;
    allowManualPriceOverride?: boolean;
    billingDurationMonths?: number | null;
    allowPartialStart?: boolean;
    minimumStartAmountType?: FeePlan['minimumStartAmountType'];
    minimumStartAmount?: number | null;
    partialDueDays?: number | null;
    downgradeIfUnpaid?: boolean;
    downgradeDurationDays?: number;
    offerLabel?: string | null;
    description?: string;
    active?: boolean;
  }): Promise<FeePlan> {
    const { feePlan } = await request<{ feePlan: FeePlan }>({
      url: '/payments/fee-plans',
      method: 'POST',
      data: body,
    });
    return feePlan;
  },

  async updateFeePlan(
    id: string,
    body: Partial<{
      name: string;
      type: FeePlan['type'];
      amount: number;
      durationDays: number;
      shiftId: string | null;
      allowManualPriceOverride: boolean;
      description: string;
      active: boolean;
    }>,
  ): Promise<FeePlan> {
    const { feePlan } = await request<{ feePlan: FeePlan }>({
      url: `/payments/fee-plans/${id}`,
      method: 'PATCH',
      data: body,
    });
    return feePlan;
  },

  async deleteFeePlan(id: string): Promise<{ id: string; deactivated: boolean }> {
    return request({ url: `/payments/fee-plans/${id}`, method: 'DELETE' });
  },

  async listInvoices(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    studentId?: string;
    branchId?: string;
    libraryId?: string;
    seatId?: string;
    invoiceId?: string;
    dueAfter?: string;
    dueBefore?: string;
    hasOpenBalance?: boolean;
    overdueOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<Paginated<Invoice>> {
    const { data, meta } = await requestDataAndMeta<{ items: Invoice[] }>({
      url: '/payments/invoices',
      method: 'GET',
      params: {
        ...params,
        hasOpenBalance:
          params.hasOpenBalance === undefined ? undefined : String(params.hasOpenBalance),
        overdueOnly: params.overdueOnly === undefined ? undefined : String(params.overdueOnly),
      },
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: {
          total: data.items.length,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
    return { items: data.items, pagination };
  },

  async listDues(params: {
    page?: number;
    limit?: number;
    studentId?: string;
    branchId?: string;
    libraryId?: string;
    search?: string;
    downgradePending?: boolean;
    downgraded?: boolean;
  }): Promise<Paginated<Invoice>> {
    const { data, meta } = await requestDataAndMeta<{ items: Invoice[] }>({
      url: '/payments/invoices/dues',
      method: 'GET',
      params: {
        ...params,
        downgradePending:
          params.downgradePending === undefined ? undefined : String(params.downgradePending),
        downgraded: params.downgraded === undefined ? undefined : String(params.downgraded),
      },
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: {
          total: data.items.length,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
    return { items: data.items, pagination };
  },

  async listOverdue(params: {
    page?: number;
    limit?: number;
    branchId?: string;
    libraryId?: string;
  }): Promise<Paginated<Invoice>> {
    const { data, meta } = await requestDataAndMeta<{ items: Invoice[] }>({
      url: '/payments/invoices/overdue',
      method: 'GET',
      params,
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: {
          total: data.items.length,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
    return { items: data.items, pagination };
  },

  async getInvoice(id: string): Promise<Invoice> {
    const { invoice } = await request<{ invoice: Invoice }>({
      url: `/payments/invoices/${id}`,
      method: 'GET',
    });
    return invoice;
  },

  async createInvoice(body: {
    libraryId?: string;
    branchId: string;
    studentId: string;
    feePlanId?: string;
    amount?: number;
    discountAmount?: number;
    taxAmount?: number;
    dueDate: string;
    notes?: string;
    status?: 'DRAFT' | 'UNPAID';
    seatId?: string | null;
    membershipPeriodStart?: string | null;
    membershipPeriodEnd?: string | null;
  }): Promise<Invoice> {
    const { invoice } = await request<{ invoice: Invoice }>({
      url: '/payments/invoices',
      method: 'POST',
      data: body,
    });
    return invoice;
  },

  async updateInvoice(id: string, body: Record<string, unknown>): Promise<Invoice> {
    const { invoice } = await request<{ invoice: Invoice }>({
      url: `/payments/invoices/${id}`,
      method: 'PATCH',
      data: body,
    });
    return invoice;
  },

  async collect(body: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    transactionId?: string;
    paidAt?: string;
    notes?: string;
    allowOverpayment?: boolean;
  }): Promise<{ payment: PaymentRecord; invoice: Invoice }> {
    return request({
      url: '/payments/collect',
      method: 'POST',
      data: body,
    });
  },

  async listPayments(params: {
    page?: number;
    limit?: number;
    studentId?: string;
    invoiceId?: string;
    branchId?: string;
    libraryId?: string;
    method?: PaymentMethod;
    from?: string;
    to?: string;
  }): Promise<Paginated<PaymentRecord>> {
    const { data, meta } = await requestDataAndMeta<{ items: PaymentRecord[] }>({
      url: '/payments/payments',
      method: 'GET',
      params,
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: {
          total: data.items.length,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
    return { items: data.items, pagination };
  },

  async getReceipt(paymentId: string): Promise<{
    payment: PaymentRecord;
    invoice: Invoice | null;
    student: Record<string, unknown> | null;
  }> {
    return request({
      url: `/payments/receipts/${paymentId}`,
      method: 'GET',
    });
  },

  async refund(body: {
    paymentId: string;
    amount: number;
    reason?: string;
    notes?: string;
  }): Promise<{ refund: boolean; invoice: Invoice; payment: PaymentRecord }> {
    return request({ url: '/payments/refunds', method: 'POST', data: body });
  },

  async voidPayment(paymentId: string): Promise<{ voided: boolean; invoice: Invoice }> {
    return request({ url: `/payments/payments/${paymentId}`, method: 'DELETE' });
  },

  async studentHistory(studentId: string): Promise<StudentPaymentHistoryResponse> {
    return request({
      url: `/payments/students/${studentId}/history`,
      method: 'GET',
    });
  },

  async summary(params: {
    from: string;
    to: string;
    granularity?: 'day' | 'month';
    branchId?: string;
    libraryId?: string;
  }): Promise<PaymentSummaryResponse> {
    return request({
      url: '/payments/summary',
      method: 'GET',
      params,
    });
  },
};
