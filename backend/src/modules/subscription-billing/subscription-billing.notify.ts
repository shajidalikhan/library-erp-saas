import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { sendEmail } from '@/services/email.service';
import { logger } from '@utils/logger';
import { loadPlatformSupportConfig } from '@modules/platform/platform-settings.support';
import {
  insertInAppNotifications,
  type InAppNotificationInput,
} from '@modules/notifications/channels/in-app.notification.service';

import type { IPlatformSubscriptionInvoiceDocument } from './platform-subscription-invoice.model';

function ownerNotificationBase(
  libraryId: Types.ObjectId,
  ownerId: Types.ObjectId,
): Omit<InAppNotificationInput, 'title' | 'message'> {
  return {
    libraryId,
    branchId: null,
    recipientUserId: ownerId,
    recipientRole: ROLES.LIBRARY_OWNER,
    recipientType: 'USER',
    type: 'BILLING',
    channel: 'IN_APP',
    status: 'SENT',
    sentAt: new Date(),
    metadata: {},
    createdBy: null,
  };
}

export async function notifySubscriptionInvoiceCreated(params: {
  libraryId: Types.ObjectId;
  ownerId: Types.ObjectId;
  invoice: Pick<IPlatformSubscriptionInvoiceDocument, 'invoiceNumber' | 'amount' | 'dueDate' | 'planName'>;
  ownerEmail?: string | null;
}): Promise<void> {
  await insertInAppNotifications([
    {
      ...ownerNotificationBase(params.libraryId, params.ownerId),
      title: 'New subscription invoice',
      message: `${params.invoice.planName}: invoice ${params.invoice.invoiceNumber} for ₹${params.invoice.amount}. Due ${params.invoice.dueDate.toDateString()}.`,
      metadata: {
        subscriptionInvoiceNumber: params.invoice.invoiceNumber,
        amount: params.invoice.amount,
      },
    },
  ]);

  if (params.ownerEmail?.trim()) {
    try {
      await sendEmail({
        to: params.ownerEmail.trim(),
        subject: `Subscription invoice ${params.invoice.invoiceNumber}`,
        html: `<p>A new subscription invoice has been issued for your library.</p>
          <p><strong>${params.invoice.planName}</strong> · Invoice <strong>${params.invoice.invoiceNumber}</strong></p>
          <p>Amount: ₹${params.invoice.amount}<br/>Due: ${params.invoice.dueDate.toDateString()}</p>
          <p>Open Billing in your dashboard for details.</p>`,
        text: `New subscription invoice ${params.invoice.invoiceNumber} for ₹${params.invoice.amount}. Due ${params.invoice.dueDate.toDateString()}.`,
      });
    } catch (err) {
      logger.warn('[subscription-billing] invoice email failed', { err });
    }
  }
}

export async function notifySubscriptionInvoicePayment(params: {
  libraryId: Types.ObjectId;
  ownerId: Types.ObjectId;
  invoiceNumber: string;
  collectedAmount: number;
  remainingDue: number;
  ownerEmail?: string | null;
}): Promise<void> {
  await insertInAppNotifications([
    {
      ...ownerNotificationBase(params.libraryId, params.ownerId),
      title: 'Subscription payment recorded',
      message: `Payment of ₹${params.collectedAmount} applied to ${params.invoiceNumber}. ${params.remainingDue > 0 ? `Outstanding ₹${params.remainingDue}.` : 'Invoice paid in full.'}`,
      metadata: {
        subscriptionInvoiceNumber: params.invoiceNumber,
        collectedAmount: params.collectedAmount,
      },
    },
  ]);

  if (params.ownerEmail?.trim()) {
    try {
      await sendEmail({
        to: params.ownerEmail.trim(),
        subject: `Payment recorded · ${params.invoiceNumber}`,
        html: `<p>We recorded a payment of ₹${params.collectedAmount} on invoice <strong>${params.invoiceNumber}</strong>.</p>
          ${params.remainingDue > 0 ? `<p>Outstanding: ₹${params.remainingDue}</p>` : '<p>Invoice is paid in full.</p>'}`,
      });
    } catch (err) {
      logger.warn('[subscription-billing] payment email failed', { err });
    }
  }
}

/** @deprecated Use loadPlatformSupportConfig */
export async function loadPlatformContactEmails(): Promise<{
  supportEmail: string;
  salesEmail: string;
  supportPhone: string;
  billingPhone: string;
}> {
  const c = await loadPlatformSupportConfig();
  return {
    supportEmail: c.supportEmail,
    salesEmail: c.salesEmail,
    supportPhone: c.supportPhone,
    billingPhone: c.billingPhone,
  };
}
