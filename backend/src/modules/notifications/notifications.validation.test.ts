import { describe, expect, it } from 'vitest';

import {
  bulkSendBodySchema,
  notificationListQuerySchema,
  sendNotificationBodySchema,
  sendTargetSchema,
} from './notifications.validation';

describe('notifications.validation', () => {
  it('parses send payload with USER target', () => {
    const v = sendNotificationBodySchema.parse({
      title: 'Hi',
      message: 'Body text',
      type: 'ANNOUNCEMENT',
      target: { mode: 'USER', userId: '507f1f77bcf86cd799439011' },
    });
    expect(v.target.mode).toBe('USER');
    expect(v.channel).toBe('IN_APP');
  });

  it('rejects USER target without userId', () => {
    expect(() =>
      sendTargetSchema.parse({
        mode: 'USER',
      }),
    ).toThrow();
  });

  it('parses bulk send with multiple items', () => {
    const v = bulkSendBodySchema.parse({
      items: [
        {
          title: 'A',
          message: 'M',
          type: 'SYSTEM',
          target: { mode: 'USER', userId: '507f1f77bcf86cd799439011' },
        },
        {
          title: 'B',
          message: 'N',
          type: 'ANNOUNCEMENT',
          target: { mode: 'LIBRARY' },
        },
      ],
    });
    expect(v.items).toHaveLength(2);
  });

  it('parses list query with unreadOnly and status', () => {
    const v = notificationListQuerySchema.parse({
      page: '2',
      limit: '10',
      unreadOnly: 'true',
      status: 'SENT',
      type: 'PAYMENT_DUE',
    });
    expect(v.page).toBe(2);
    expect(v.unreadOnly).toBe(true);
    expect(v.status).toBe('SENT');
  });
});
