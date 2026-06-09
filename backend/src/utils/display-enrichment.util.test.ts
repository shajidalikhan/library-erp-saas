import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { STUDENT_STATUS } from '@modules/students/student.constants';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';

describe('display-enrichment.util', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('adds branch and student display fields without removing ids', async () => {
    const library = await LibraryModel.create({
      name: 'Display Library',
      slug: 'display-library',
      email: 'display@example.com',
      timezone: DEFAULT_TIMEZONE,
      subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
      status: LIBRARY_STATUS.ACTIVE,
      settings: {},
    });
    const branch = await BranchModel.create({
      libraryId: library._id,
      branchName: 'Main Branch',
      branchCode: 'MB-01',
      email: 'branch@example.com',
      totalSeats: 10,
      active: true,
    });
    const student = await StudentModel.create({
      libraryId: library._id,
      branchId: branch._id,
      studentId: 'STU-001',
      fullName: 'Rohit Kumar',
      email: 'rohit@example.com',
      phone: '+91 90000 00000',
      admissionDate: new Date('2026-01-01'),
      membershipStartDate: new Date('2026-01-01'),
      status: STUDENT_STATUS.ACTIVE,
    });

    const [enriched] = await enrichRowsWithLookups(
      [
        {
          branchId: branch._id,
          studentId: student._id,
        },
      ],
      { branchIdKey: 'branchId', studentIdKey: 'studentId' },
    );

    expect(String(enriched.branchId)).toBe(String(branch._id));
    expect(enriched.branchName).toBe('Main Branch');
    expect(enriched.branchCode).toBe('MB-01');
    expect(String(enriched.studentId)).toBe(String(student._id));
    expect(enriched.studentName).toBe('Rohit Kumar');
    expect(enriched.studentCode).toBe('STU-001');
    expect(enriched.studentPhone).toBe('+91 90000 00000');
  });
});
