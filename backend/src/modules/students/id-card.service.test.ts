import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';

vi.mock('./id-card-image.util', () => ({
  fetchImageBufferForPdf: vi.fn().mockResolvedValue(Buffer.from('jpeg')),
  cloudinaryUrlForPdfEmbed: (url: string) => url,
}));
vi.mock('./students.models');
vi.mock('@modules/library/library.models');
vi.mock('@modules/seats/seat.model');
vi.mock('@modules/shifts/shift.model');
vi.mock('@modules/seats/seat-assignment.model', () => ({
  SeatAssignmentModel: {
    findOne: vi.fn().mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve(null) }),
    }),
  },
}));
vi.mock('pdfkit', () => {
  class MockDoc {
    private handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!this.handlers[event]) this.handlers[event] = [];
      this.handlers[event].push(fn);
      return this;
    }
    save() {}
    restore() {}
    rect() {
      return this;
    }
    fill() {
      return this;
    }
    fillColor() {
      return this;
    }
    fontSize() {
      return this;
    }
    text() {
      return this;
    }
    image() {}
    roundedRect() {
      return this;
    }
    lineWidth() {
      return this;
    }
    stroke() {}
    end() {
      for (const fn of this.handlers.end ?? []) fn();
    }
  }
  return { default: MockDoc };
});
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AA==') },
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(8),
}) as typeof fetch;

import { StudentModel } from './students.models';
import { LibraryModel, BranchModel } from '@modules/library/library.models';
import { generateStudentIdCardPdf } from './id-card.service';

describe('generateStudentIdCardPdf', () => {
  const studentId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes profile photo fetch when student has photo', async () => {
    const libId = new Types.ObjectId();
    const brId = new Types.ObjectId();
    vi.mocked(StudentModel.findById).mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: studentId,
          libraryId: libId,
          branchId: brId,
          studentId: 'STU-001',
          fullName: 'Test Student',
          profilePhoto: { url: 'https://res.cloudinary.com/demo/photo.jpg', publicId: 'p1' },
          assignedSeatId: null,
        }),
    } as never);
    vi.mocked(LibraryModel.findById).mockReturnValue({
      lean: () => Promise.resolve({ name: 'Lib', logo: null }),
    } as never);
    vi.mocked(BranchModel.findById).mockReturnValue({
      lean: () => Promise.resolve({ branchName: 'Main' }),
    } as never);

    const buf = await generateStudentIdCardPdf(
      {
        id: 'u1',
        role: ROLES.RECEPTIONIST,
        permissions: [PERMISSIONS.ID_CARD_GENERATE],
        libraryId: String(libId),
        branchId: String(brId),
      },
      studentId,
    );
    expect(buf).toBeInstanceOf(Buffer);
    const { fetchImageBufferForPdf } = await import('./id-card-image.util');
    expect(fetchImageBufferForPdf).toHaveBeenCalledWith('https://res.cloudinary.com/demo/photo.jpg');
  });
});
