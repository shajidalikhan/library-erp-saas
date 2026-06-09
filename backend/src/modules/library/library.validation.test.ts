import { describe, expect, it } from 'vitest';

import {
  createBranchSchema,
  createLibrarySchema,
  listBranchesQuerySchema,
  listLibrariesQuerySchema,
  patchLibrarySettingsSchema,
} from './library.validation';

describe('library.validation', () => {
  it('parses listLibrariesQuery with coerced pagination', () => {
    const q = listLibrariesQuerySchema.parse({
      page: '2',
      limit: '5',
      search: ' acme ',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(5);
    expect(q.search).toBe('acme');
    expect(q.sortBy).toBe('name');
  });

  it('rejects invalid library slug in create body', () => {
    expect(() =>
      createLibrarySchema.parse({
        name: 'Test',
        email: 'a@b.com',
        slug: 'Bad Slug',
      }),
    ).toThrow();
  });

  it('accepts minimal createLibrary payload', () => {
    const body = createLibrarySchema.parse({
      name: 'Acme Library',
      email: 'owner@acme.com',
    });
    expect(body.name).toBe('Acme Library');
  });

  it('coerces branch list active filter', () => {
    const q = listBranchesQuerySchema.parse({ active: 'false' });
    expect(q.active).toBe(false);
  });

  it('uppercases branch code on create', () => {
    const b = createBranchSchema.parse({
      branchName: 'Main',
      branchCode: 'hq-1',
      email: 'b@acme.com',
    });
    expect(b.branchCode).toBe('HQ-1');
  });

  it('accepts structured public photo settings', () => {
    const parsed = patchLibrarySettingsSchema.parse({
      settings: {
        publicBookingPage: {
          publicPhotos: [
            { url: 'https://cdn.example.com/a.webp', publicId: 'abc/1', isCover: true, order: 0 },
          ],
        },
      },
    });
    expect(parsed.settings).toBeTruthy();
  });

  it('rejects more than 10 public photos', () => {
    const photos = Array.from({ length: 11 }).map((_, index) => ({
      url: `https://cdn.example.com/${index}.webp`,
      publicId: `public/${index}`,
      isCover: index === 0,
      order: index,
    }));
    expect(() =>
      patchLibrarySettingsSchema.parse({
        settings: { publicBookingPage: { publicPhotos: photos } },
      }),
    ).toThrow();
  });
});
