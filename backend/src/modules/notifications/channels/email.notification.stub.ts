/** Future: nodemailer / SES integration. */
export async function sendEmailNotificationStub(_payload: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  return Promise.resolve();
}
