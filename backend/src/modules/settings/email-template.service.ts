import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';

import { EmailTemplateModel } from './email-template.model';
import { DEFAULT_EMAIL_TEMPLATES } from './email-template.defaults';
import { isEmailTemplateKey, type EmailTemplateKey } from './email-template.constants';
import { renderEmailTemplate, sanitizeEmailHtml } from './template-render.util';

function requireSuperAdmin(user: AuthenticatedUser): void {
  if (user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Super admin access required');
  }
}

const toDto = (doc: {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  active: boolean;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  key: doc.key,
  name: doc.name,
  subject: doc.subject,
  htmlBody: doc.htmlBody,
  textBody: doc.textBody,
  variables: doc.variables,
  active: doc.active,
  updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const getDefaultByKey = (key: EmailTemplateKey) => {
  const found = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key);
  if (!found) throw ApiError.notFound('Email template not found');
  return found;
};

class EmailTemplateService {
  async list(user: AuthenticatedUser) {
    requireSuperAdmin(user);
    await this.ensureSeeded();
    const rows = await EmailTemplateModel.find().sort({ key: 1 }).lean();
    return rows.map((r) => toDto(r));
  }

  async getByKey(user: AuthenticatedUser, key: string) {
    requireSuperAdmin(user);
    if (!isEmailTemplateKey(key)) throw ApiError.notFound('Email template not found');
    const doc = await EmailTemplateModel.findOne({ key }).lean();
    if (doc) return toDto(doc);
    const defaults = getDefaultByKey(key);
    return toDto({ ...defaults, active: true, updatedBy: null });
  }

  async patch(
    user: AuthenticatedUser,
    key: string,
    body: {
      name?: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      active?: boolean;
    },
  ) {
    requireSuperAdmin(user);
    if (!isEmailTemplateKey(key)) throw ApiError.notFound('Email template not found');

    await this.ensureSeeded();
    const defaults = getDefaultByKey(key);
    const update: Record<string, unknown> = { updatedBy: new Types.ObjectId(user.id) };
    if (body.name !== undefined) update.name = body.name;
    if (body.subject !== undefined) update.subject = body.subject;
    if (body.htmlBody !== undefined) update.htmlBody = sanitizeEmailHtml(body.htmlBody);
    if (body.textBody !== undefined) update.textBody = body.textBody;
    if (body.active !== undefined) update.active = body.active;

    const doc = await EmailTemplateModel.findOneAndUpdate(
      { key },
      { $set: update },
      { new: true, runValidators: true },
    ).lean();

    if (!doc) {
      throw ApiError.notFound('Email template not found');
    }

    return toDto({
      ...defaults,
      ...doc,
      variables: defaults.variables,
    });
  }

  async seedDefaults(user: AuthenticatedUser) {
    requireSuperAdmin(user);
    const created: string[] = [];
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      const exists = await EmailTemplateModel.exists({ key: tpl.key });
      if (exists) continue;
      await EmailTemplateModel.create({
        ...tpl,
        active: true,
        updatedBy: new Types.ObjectId(user.id),
      });
      created.push(tpl.key);
    }
    return { created, total: DEFAULT_EMAIL_TEMPLATES.length };
  }

  async ensureSeeded(): Promise<void> {
    const count = await EmailTemplateModel.countDocuments();
    if (count >= DEFAULT_EMAIL_TEMPLATES.length) return;
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      await EmailTemplateModel.updateOne(
        { key: tpl.key },
        {
          $setOnInsert: {
            ...tpl,
            active: true,
            updatedBy: null,
          },
        },
        { upsert: true },
      );
    }
  }

  async resetToDefault(user: AuthenticatedUser, key: string) {
    requireSuperAdmin(user);
    if (!isEmailTemplateKey(key)) throw ApiError.notFound('Email template not found');
    const defaults = getDefaultByKey(key);
    const doc = await EmailTemplateModel.findOneAndUpdate(
      { key },
      {
        $set: {
          name: defaults.name,
          subject: defaults.subject,
          htmlBody: defaults.htmlBody,
          textBody: defaults.textBody,
          variables: defaults.variables,
          active: true,
          updatedBy: new Types.ObjectId(user.id),
        },
      },
      { new: true },
    ).lean();
    if (!doc) throw ApiError.notFound('Email template not found');
    return toDto(doc);
  }

  /**
   * Resolves template from DB (if active) or built-in defaults.
   */
  async render(
    key: EmailTemplateKey,
    vars: Record<string, string>,
  ): Promise<{ subject: string; html: string; text: string }> {
    await this.ensureSeeded();
    const doc = await EmailTemplateModel.findOne({ key, active: true }).lean();
    const source = doc ?? getDefaultByKey(key);

    return {
      subject: renderEmailTemplate(source.subject, vars, { escapeHtmlValues: true }),
      html: renderEmailTemplate(source.htmlBody, vars, { escapeHtmlValues: true }),
      text: renderEmailTemplate(source.textBody, vars),
    };
  }

  preview(
    key: string,
    body: { subject: string; htmlBody: string; textBody: string },
    vars: Record<string, string>,
  ) {
    if (!isEmailTemplateKey(key)) throw ApiError.notFound('Email template not found');
    const safeHtml = sanitizeEmailHtml(body.htmlBody);
    return {
      subject: renderEmailTemplate(body.subject, vars, { escapeHtmlValues: true }),
      html: renderEmailTemplate(safeHtml, vars, { escapeHtmlValues: true }),
      text: renderEmailTemplate(body.textBody, vars),
    };
  }
}

export const emailTemplateService = new EmailTemplateService();
