/**
 * Demo data seeder for Library ERP SaaS.
 *
 * Prerequisites: `MONGODB_URI` in `.env`
 *
 * Run:
 *   npm run seed:demo
 *   npm run seed:demo:clean
 */

import 'dotenv/config';
import { Types } from 'mongoose';

import { connectDB, disconnectDB } from '@config/db';
import { ROLES } from '@constants/roles.constants';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { seedRbacCore } from '@modules/auth/auth.seeder';
import { AttendanceModel } from '@modules/attendance/attendance.model';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import {
  DEFAULT_TIMEZONE,
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { DemoRequestModel } from '@modules/demo-requests/demo-request.model';
import { DEMO_REQUEST_STATUS } from '@modules/demo-requests/demo-request.constants';
import { NotificationModel } from '@modules/notifications/notification.model';
import { FeePlanModel, InvoiceModel, PaymentRecordModel } from '@modules/payments/payments.models';
import { PlatformSettingModel } from '@modules/platform/platform-setting.model';
import { SeatModel } from '@modules/seats/seat.model';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_GENDER, STUDENT_STATUS } from '@modules/students/student.constants';
import { logger } from '@utils/logger';

const DEMO_DOMAIN = 'demo.libraryerp.local';
const DEMO_PASSWORD = 'Demo123!';
const DEMO_SLUG_PREFIX = 'demo-';

const CREDENTIALS = {
  superAdmin: { email: 'admin@libraryerp.com', password: 'Admin123', fullName: 'Super Admin' },
  owner: { email: `owner.jaipur@${DEMO_DOMAIN}`, password: DEMO_PASSWORD, fullName: 'Rohit Sharma' },
  manager: { email: `manager.vaishali@${DEMO_DOMAIN}`, password: DEMO_PASSWORD, fullName: 'Priya Mehta' },
  receptionist: { email: `reception.vaishali@${DEMO_DOMAIN}`, password: DEMO_PASSWORD, fullName: 'Anita Verma' },
  accountant: { email: `accounts.jaipur@${DEMO_DOMAIN}`, password: DEMO_PASSWORD, fullName: 'Vikram Singh' },
  security: { email: `security.vaishali@${DEMO_DOMAIN}`, password: DEMO_PASSWORD, fullName: 'Suresh Yadav' },
  student: { email: `student.0001@${DEMO_DOMAIN}`, password: DEMO_PASSWORD, fullName: 'Aarav Patel' },
} as const;

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Kabir', 'Ishaan', 'Rohan', 'Kunal', 'Nikhil', 'Rahul',
  'Ananya', 'Diya', 'Isha', 'Kavya', 'Meera', 'Neha', 'Pooja', 'Riya', 'Sneha', 'Tanvi',
  'Amit', 'Deepak', 'Gaurav', 'Harsh', 'Manish', 'Pankaj', 'Rajesh', 'Sanjay', 'Varun', 'Yash',
  'Bhavya', 'Chitra', 'Ekta', 'Jyoti', 'Lakshmi', 'Nandini', 'Payal', 'Shreya', 'Swati', 'Urvashi',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Mehta', 'Reddy', 'Iyer', 'Nair',
  'Joshi', 'Agarwal', 'Malhotra', 'Chopra', 'Bansal', 'Kapoor', 'Das', 'Mishra', 'Pandey', 'Rao',
];

const LIBRARY_BLUEPRINTS = [
  {
    slug: `${DEMO_SLUG_PREFIX}jaipur-study-hub`,
    name: 'Jaipur Study Hub',
    city: 'Jaipur',
    state: 'Rajasthan',
    plan: SUBSCRIPTION_PLAN.GROWTH,
    branches: [
      { code: 'JPR-VA', name: 'Vaishali Nagar', seats: 42 },
      { code: 'JPR-MN', name: 'Mansarovar', seats: 38 },
      { code: 'JPR-MG', name: 'Malviya Nagar', seats: 36 },
    ],
    studentCount: 78,
  },
  {
    slug: `${DEMO_SLUG_PREFIX}delhi-focus-library`,
    name: 'Delhi Focus Library',
    city: 'New Delhi',
    state: 'Delhi',
    plan: SUBSCRIPTION_PLAN.BASIC,
    branches: [
      { code: 'DEL-KR', name: 'Karol Bagh', seats: 40 },
      { code: 'DEL-LJ', name: 'Lajpat Nagar', seats: 34 },
    ],
    studentCount: 64,
  },
  {
    slug: `${DEMO_SLUG_PREFIX}bengaluru-scholar-center`,
    name: 'Bengaluru Scholar Center',
    city: 'Bengaluru',
    state: 'Karnataka',
    plan: SUBSCRIPTION_PLAN.GROWTH,
    branches: [
      { code: 'BLR-IN', name: 'Indiranagar', seats: 44 },
      { code: 'BLR-HS', name: 'HSR Layout', seats: 40 },
      { code: 'BLR-WH', name: 'Whitefield', seats: 32 },
    ],
    studentCount: 72,
  },
] as const;

type RoleMap = Record<string, Types.ObjectId>;

const log = (msg: string) => logger.info(`[seed:demo] ${msg}`);

const emailFor = (local: string) => `${local}@${DEMO_DOMAIN}`.toLowerCase();

const phoneFor = (seed: number) => {
  const digits = String(9000000000 + (seed % 900000000)).padStart(10, '0');
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
};

const pick = <T>(items: readonly T[], index: number): T => items[index % items.length];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

const parseArgs = () => ({
  clean:
    process.argv.includes('--clean') ||
    process.argv.includes('clean') ||
    process.env.DEMO_SEED_CLEAN === 'true' ||
    process.env.DEMO_SEED_CLEAN === '1',
});

const expectedDemoStudentCount = () =>
  LIBRARY_BLUEPRINTS.reduce((total, blueprint) => total + blueprint.studentCount, 0);

type DemoSeedStatus = 'missing' | 'partial' | 'complete';

async function getDemoSeedStatus(): Promise<DemoSeedStatus> {
  const demoLibraries = await LibraryModel.find({ slug: { $regex: `^${DEMO_SLUG_PREFIX}` } })
    .select('_id slug')
    .lean();
  if (!demoLibraries.length) return 'missing';

  const foundSlugs = new Set(demoLibraries.map((library) => String(library.slug)));
  const allLibrariesPresent = LIBRARY_BLUEPRINTS.every((blueprint) => foundSlugs.has(blueprint.slug));
  const libraryIds = demoLibraries.map((library) => library._id as Types.ObjectId);
  const studentCount = await StudentModel.countDocuments({ libraryId: { $in: libraryIds } });
  const expectedStudents = expectedDemoStudentCount();

  if (!allLibrariesPresent || studentCount < expectedStudents) {
    return 'partial';
  }

  return 'complete';
}

async function logDemoSeedSummary(): Promise<void> {
  const demoLibraries = await LibraryModel.find({ slug: { $regex: `^${DEMO_SLUG_PREFIX}` } })
    .select('_id slug')
    .lean();
  const libraryIds = demoLibraries.map((library) => library._id as Types.ObjectId);
  const [studentCount, seatCount, invoiceCount, paymentCount, attendanceCount, demoRequestCount] =
    await Promise.all([
      StudentModel.countDocuments({ libraryId: { $in: libraryIds } }),
      SeatModel.countDocuments({ libraryId: { $in: libraryIds } }),
      InvoiceModel.countDocuments({ libraryId: { $in: libraryIds } }),
      PaymentRecordModel.countDocuments({ libraryId: { $in: libraryIds } }),
      AttendanceModel.countDocuments({ libraryId: { $in: libraryIds } }),
      DemoRequestModel.countDocuments({ email: { $regex: `@${DEMO_DOMAIN.replace('.', '\\.')}$` } }),
    ]);

  log(
    `Summary: libraries=${demoLibraries.length}, students=${studentCount}, seats=${seatCount}, invoices=${invoiceCount}, payments=${paymentCount}, attendance=${attendanceCount}, demoRequests=${demoRequestCount}`,
  );
}

async function loadRoleMap(): Promise<RoleMap> {
  const roles = await RoleModel.find({ isSystem: true, libraryId: null }).select('name').lean();
  const map: RoleMap = {};
  for (const role of roles) {
    map[String(role.name)] = role._id as Types.ObjectId;
  }
  for (const name of Object.values(ROLES)) {
    if (!map[name]) throw new Error(`Missing system role ${name}. Run npm run seed:rbac first.`);
  }
  return map;
}

async function ensureSuperAdmin(roleMap: RoleMap): Promise<void> {
  const email = CREDENTIALS.superAdmin.email.toLowerCase();
  const existing = await UserModel.findOne({ email }).lean();
  if (existing) return;

  await UserModel.create({
    fullName: CREDENTIALS.superAdmin.fullName,
    email,
    passwordHash: await UserModel.hashPassword(CREDENTIALS.superAdmin.password),
    role: roleMap[ROLES.SUPER_ADMIN],
    libraryId: null,
    branchId: null,
    isActive: true,
    isEmailVerified: true,
    refreshTokens: [],
  });
}

async function cleanDemoData(): Promise<void> {
  const libraries = await LibraryModel.find({ slug: { $regex: `^${DEMO_SLUG_PREFIX}` } }).select('_id').lean();
  const libraryIds = libraries.map((l) => l._id as Types.ObjectId);
  if (!libraryIds.length) {
    log('No demo libraries found to clean.');
    return;
  }

  const users = await UserModel.find({
    $or: [{ libraryId: { $in: libraryIds } }, { email: { $regex: `@${DEMO_DOMAIN.replace('.', '\\.')}$` } }],
  })
    .select('_id')
    .lean();
  const userIds = users.map((u) => u._id as Types.ObjectId);

  await PaymentRecordModel.deleteMany({ libraryId: { $in: libraryIds } });
  await InvoiceModel.deleteMany({ libraryId: { $in: libraryIds } });
  await FeePlanModel.deleteMany({ libraryId: { $in: libraryIds } });
  await AttendanceModel.deleteMany({ libraryId: { $in: libraryIds } });
  await SeatModel.deleteMany({ libraryId: { $in: libraryIds } });
  await StudentModel.deleteMany({ libraryId: { $in: libraryIds } });
  await NotificationModel.deleteMany({
    $or: [{ libraryId: { $in: libraryIds } }, { recipientUserId: { $in: userIds } }],
  });
  await UserModel.deleteMany({ _id: { $in: userIds } });
  await BranchModel.deleteMany({ libraryId: { $in: libraryIds } });
  await LibraryModel.deleteMany({ _id: { $in: libraryIds } });
  await DemoRequestModel.deleteMany({ email: { $regex: `@${DEMO_DOMAIN.replace('.', '\\.')}$` } });

  log(`Cleaned demo data for ${libraryIds.length} libraries.`);
}

async function seedPlatformSettings(): Promise<void> {
  await PlatformSettingModel.updateOne(
    { singletonKey: 'default' },
    {
      $set: {
        supportEmail: 'support@libraryerp.com',
        salesEmail: `sales@${DEMO_DOMAIN}`,
        demoRequestNotifyEmail: `leads@${DEMO_DOMAIN}`,
        maintenanceMode: false,
      },
    },
    { upsert: true },
  );
}

async function seedDemoRequests(): Promise<void> {
  const leads = [
    {
      fullName: 'Karan Malhotra',
      email: emailFor('lead.karan'),
      phone: phoneFor(11),
      libraryName: 'Udaipur Readers Point',
      city: 'Udaipur',
      branchCount: 2,
      studentCount: 180,
      currentSystem: 'Excel registers',
      interestedFeatures: ['ATTENDANCE', 'PAYMENTS', 'REPORTS'],
      notes: 'Needs onboarding before NEET season.',
    },
    {
      fullName: 'Sunita Desai',
      email: emailFor('lead.sunita'),
      phone: phoneFor(12),
      libraryName: 'Surat Civil Services Library',
      city: 'Surat',
      branchCount: 1,
      studentCount: 95,
      currentSystem: 'Manual notebooks',
      interestedFeatures: ['ANALYTICS', 'MULTI_BRANCH'],
      notes: 'Interested in analytics for branch comparison.',
    },
    {
      fullName: 'Imran Khan',
      email: emailFor('lead.imran'),
      phone: phoneFor(13),
      libraryName: 'Lucknow Focus Zone',
      city: 'Lucknow',
      branchCount: 3,
      studentCount: 240,
      currentSystem: 'Legacy desktop software',
      interestedFeatures: ['STUDENT_PORTAL', 'NOTIFICATIONS'],
      notes: 'Wants student portal for fee receipts.',
    },
  ];

  for (const lead of leads) {
    const exists = await DemoRequestModel.findOne({ email: lead.email }).select('_id').lean();
    if (exists) continue;
    await DemoRequestModel.create({
      ...lead,
      interestedFeatures: lead.interestedFeatures as Array<
        'ATTENDANCE' | 'PAYMENTS' | 'ANALYTICS' | 'STUDENT_PORTAL' | 'MULTI_BRANCH' | 'NOTIFICATIONS' | 'REPORTS'
      >,
      status: DEMO_REQUEST_STATUS.NEW,
      statusHistory: [{ status: DEMO_REQUEST_STATUS.NEW, createdAt: new Date() }],
      adminNotes: [],
    });
  }
}

async function seedLibraries(roleMap: RoleMap): Promise<void> {
  const passwordHash = await UserModel.hashPassword(DEMO_PASSWORD);
  const today = startOfDay(new Date());
  let globalStudentIndex = 0;
  let globalInvoiceSeq = 1;
  let globalReceiptSeq = 1;

  for (const [libIndex, blueprint] of LIBRARY_BLUEPRINTS.entries()) {
    const existing = await LibraryModel.findOne({ slug: blueprint.slug }).lean();
    if (existing) {
      log(`Library ${blueprint.slug} already exists, skipping.`);
      continue;
    }

    const ownerEmail = libIndex === 0 ? CREDENTIALS.owner.email : emailFor(`owner.${blueprint.slug}`);
    const owner = await UserModel.create({
      fullName: libIndex === 0 ? CREDENTIALS.owner.fullName : `${pick(FIRST_NAMES, libIndex)} ${pick(LAST_NAMES, libIndex + 3)}`,
      email: ownerEmail,
      phone: phoneFor(100 + libIndex),
      passwordHash,
      role: roleMap[ROLES.LIBRARY_OWNER],
      libraryId: null,
      branchId: null,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
    });

    const library = await LibraryModel.create({
      name: blueprint.name,
      slug: blueprint.slug,
      ownerId: owner._id,
      email: emailFor(`library.${blueprint.slug}`),
      phone: phoneFor(200 + libIndex),
      address: `${pick(['Ring Road', 'MG Road', 'Station Road'], libIndex)}, ${blueprint.city}`,
      city: blueprint.city,
      state: blueprint.state,
      country: 'India',
      pincode: String(302001 + libIndex * 111),
      timezone: DEFAULT_TIMEZONE,
      subscriptionPlan: blueprint.plan,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      status: LIBRARY_STATUS.ACTIVE,
      settings: { demoSeed: true },
    });

    owner.libraryId = library._id as Types.ObjectId;
    await owner.save();

    const accountant = await UserModel.create({
      fullName: libIndex === 0 ? CREDENTIALS.accountant.fullName : `${pick(FIRST_NAMES, libIndex + 5)} ${pick(LAST_NAMES, libIndex + 7)}`,
      email: libIndex === 0 ? CREDENTIALS.accountant.email : emailFor(`accounts.${blueprint.slug}`),
      phone: phoneFor(300 + libIndex),
      passwordHash,
      role: roleMap[ROLES.ACCOUNTANT],
      libraryId: library._id,
      branchId: null,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
    });

    let libraryStudentsCreated = 0;

    const branchDocs: Array<{ _id: Types.ObjectId; code: string; seats: number }> = [];
    for (const [branchIndex, branch] of blueprint.branches.entries()) {
      const manager = await UserModel.create({
        fullName:
          libIndex === 0 && branchIndex === 0
            ? CREDENTIALS.manager.fullName
            : `${pick(FIRST_NAMES, libIndex + branchIndex + 10)} ${pick(LAST_NAMES, branchIndex + 2)}`,
        email:
          libIndex === 0 && branchIndex === 0
            ? CREDENTIALS.manager.email
            : emailFor(`manager.${branch.code.toLowerCase()}`),
        phone: phoneFor(400 + libIndex * 10 + branchIndex),
        passwordHash,
        role: roleMap[ROLES.MANAGER],
        libraryId: library._id,
        branchId: null,
        isActive: true,
        isEmailVerified: true,
        refreshTokens: [],
      });

      const receptionist = await UserModel.create({
        fullName:
          libIndex === 0 && branchIndex === 0
            ? CREDENTIALS.receptionist.fullName
            : `${pick(FIRST_NAMES, libIndex + branchIndex + 20)} ${pick(LAST_NAMES, branchIndex + 4)}`,
        email:
          libIndex === 0 && branchIndex === 0
            ? CREDENTIALS.receptionist.email
            : emailFor(`reception.${branch.code.toLowerCase()}`),
        phone: phoneFor(500 + libIndex * 10 + branchIndex),
        passwordHash,
        role: roleMap[ROLES.RECEPTIONIST],
        libraryId: library._id,
        branchId: null,
        isActive: true,
        isEmailVerified: true,
        refreshTokens: [],
      });

      const security = await UserModel.create({
        fullName:
          libIndex === 0 && branchIndex === 0
            ? CREDENTIALS.security.fullName
            : `${pick(FIRST_NAMES, libIndex + branchIndex + 30)} ${pick(LAST_NAMES, branchIndex + 6)}`,
        email:
          libIndex === 0 && branchIndex === 0
            ? CREDENTIALS.security.email
            : emailFor(`security.${branch.code.toLowerCase()}`),
        phone: phoneFor(600 + libIndex * 10 + branchIndex),
        passwordHash,
        role: roleMap[ROLES.SECURITY],
        libraryId: library._id,
        branchId: null,
        isActive: true,
        isEmailVerified: true,
        refreshTokens: [],
      });

      const branchDoc = await BranchModel.create({
        libraryId: library._id,
        branchName: branch.name,
        branchCode: branch.code,
        managerId: manager._id,
        email: emailFor(`branch.${branch.code.toLowerCase()}`),
        phone: phoneFor(700 + libIndex * 10 + branchIndex),
        address: `${branch.name}, ${blueprint.city}`,
        city: blueprint.city,
        state: blueprint.state,
        pincode: String(302020 + libIndex * 10 + branchIndex),
        totalSeats: branch.seats,
        active: true,
      });

      manager.branchId = branchDoc._id as Types.ObjectId;
      receptionist.branchId = branchDoc._id as Types.ObjectId;
      security.branchId = branchDoc._id as Types.ObjectId;
      await Promise.all([manager.save(), receptionist.save(), security.save()]);

      branchDocs.push({ _id: branchDoc._id as Types.ObjectId, code: branch.code, seats: branch.seats });

      const feePlans = await FeePlanModel.insertMany([
        {
          libraryId: library._id,
          branchId: branchDoc._id,
          name: 'Monthly Regular',
          amount: 2200,
          durationDays: 30,
          description: 'Standard desk with full-day access.',
          active: true,
        },
        {
          libraryId: library._id,
          branchId: branchDoc._id,
          name: 'Quarterly Focus',
          amount: 5900,
          durationDays: 90,
          description: 'Discounted quarterly membership.',
          active: true,
        },
      ]);

      const seatRows = Array.from({ length: branch.seats }, (_, seatIndex) => {
        const seatNumber = `${branch.code}-${String(seatIndex + 1).padStart(3, '0')}`;
        const status =
          seatIndex % 17 === 0
            ? 'MAINTENANCE'
            : seatIndex % 11 === 0
              ? 'AVAILABLE'
              : seatIndex % 7 === 0
                ? 'RESERVED'
                : 'AVAILABLE';
        return {
          libraryId: library._id,
          branchId: branchDoc._id,
          seatNumber,
          floor: seatIndex < branch.seats / 2 ? '1' : '2',
          zone: seatIndex % 3 === 0 ? 'Silent' : seatIndex % 3 === 1 ? 'General' : 'Premium',
          seatType: seatIndex % 5 === 0 ? 'PREMIUM' : 'STANDARD',
          shiftType: 'FULL_DAY',
          assignedStudentId: null,
          occupied: false,
          active: status !== 'MAINTENANCE',
          status,
          notes: status === 'MAINTENANCE' ? 'Chair repair scheduled' : undefined,
          reservedUntil: status === 'RESERVED' ? addDays(today, 3) : null,
        };
      });
      const seats = await SeatModel.insertMany(seatRows);

      const studentsPerBranch = Math.ceil(blueprint.studentCount / blueprint.branches.length);
      const studentDocs: Types.ObjectId[] = [];
      for (let i = 0; i < studentsPerBranch; i += 1) {
        if (libraryStudentsCreated >= blueprint.studentCount) break;
        libraryStudentsCreated += 1;
        globalStudentIndex += 1;
        const fullName = `${pick(FIRST_NAMES, globalStudentIndex)} ${pick(LAST_NAMES, globalStudentIndex + 1)}`;
        const studentEmail = emailFor(`student.${String(globalStudentIndex).padStart(4, '0')}`);
        const withLogin = globalStudentIndex % 3 === 0;
        let userId: Types.ObjectId | null = null;
        if (withLogin) {
          const studentUser = await UserModel.create({
            fullName: globalStudentIndex === 1 ? CREDENTIALS.student.fullName : fullName,
            email: globalStudentIndex === 1 ? CREDENTIALS.student.email : studentEmail,
            phone: phoneFor(1000 + globalStudentIndex),
            passwordHash,
            role: roleMap[ROLES.STUDENT],
            libraryId: library._id,
            branchId: branchDoc._id,
            isActive: true,
            isEmailVerified: true,
            refreshTokens: [],
          });
          userId = studentUser._id as Types.ObjectId;
        }

        const student = await StudentModel.create({
          libraryId: library._id,
          branchId: branchDoc._id,
          studentId: `${branch.code}-STU-${String(i + 1).padStart(4, '0')}`,
          fullName: globalStudentIndex === 1 ? CREDENTIALS.student.fullName : fullName,
          email: globalStudentIndex === 1 ? CREDENTIALS.student.email : studentEmail,
          phone: phoneFor(2000 + globalStudentIndex),
          gender: globalStudentIndex % 2 === 0 ? STUDENT_GENDER.MALE : STUDENT_GENDER.FEMALE,
          city: blueprint.city,
          state: blueprint.state,
          admissionDate: addDays(today, -120 - (globalStudentIndex % 40)),
          membershipStartDate: addDays(today, -90 - (globalStudentIndex % 20)),
          membershipEndDate: addDays(today, 30 + (globalStudentIndex % 45)),
          status: STUDENT_STATUS.ACTIVE,
          assignedSeatId: null,
          userId,
        });
        studentDocs.push(student._id as Types.ObjectId);

        const feePlan = feePlans[globalStudentIndex % 2];
        const amount = feePlan.amount;
        const statusRoll = globalStudentIndex % 10;
        let status: string = 'UNPAID';
        let paidAmount = 0;
        let dueAmount = amount;
        let dueDate = addDays(today, 7 + (globalStudentIndex % 10));
        if (statusRoll <= 4) {
          status = 'PAID';
          paidAmount = amount;
          dueAmount = 0;
          dueDate = addDays(today, -5 - (globalStudentIndex % 8));
        } else if (statusRoll <= 6) {
          status = 'PARTIAL';
          paidAmount = Math.round(amount * 0.45);
          dueAmount = amount - paidAmount;
          dueDate = addDays(today, -2 - (globalStudentIndex % 4));
        } else if (statusRoll <= 8) {
          status = 'OVERDUE';
          paidAmount = 0;
          dueAmount = amount;
          dueDate = addDays(today, -10 - (globalStudentIndex % 12));
        }

        const invoice = await InvoiceModel.create({
          libraryId: library._id,
          branchId: branchDoc._id,
          studentId: student._id,
          seatId: null,
          feePlanId: feePlan._id,
          invoiceNumber: `INV-${branch.code}-${String(globalInvoiceSeq++).padStart(5, '0')}`,
          amount,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: amount,
          paidAmount,
          refundTotal: 0,
          dueAmount,
          status,
          dueDate,
          membershipPeriodStart: addDays(today, -30),
          membershipPeriodEnd: addDays(today, 30),
          currency: 'INR',
        });

        if (paidAmount > 0) {
          const method = ['CASH', 'UPI', 'CARD'][globalStudentIndex % 3];
          const paidAt =
            status === 'PAID' && globalStudentIndex % 5 === 0
              ? new Date()
              : addDays(today, -(globalStudentIndex % 20));
          if (status === 'PAID' && globalStudentIndex % 5 === 0) {
            paidAt.setHours(10 + (globalStudentIndex % 6), 15, 0, 0);
          }
          await PaymentRecordModel.create({
            libraryId: library._id,
            branchId: branchDoc._id,
            studentId: student._id,
            invoiceId: invoice._id,
            amount: paidAmount,
            method,
            transactionId: method === 'UPI' ? `UPI${Date.now()}${globalStudentIndex}` : undefined,
            receiptNumber: `RCP-${branch.code}-${String(globalReceiptSeq++).padStart(5, '0')}`,
            receivedBy: accountant._id,
            paidAt,
            status: 'ACTIVE',
            refundedAmount: 0,
          });
        }

        if (globalStudentIndex % 4 === 0) {
          const seat = seats.find((s) => s.status === 'AVAILABLE' && !s.assignedStudentId);
          if (seat) {
            await SeatModel.updateOne(
              { _id: seat._id },
              {
                $set: {
                  assignedStudentId: student._id,
                  occupied: true,
                  status: 'OCCUPIED',
                },
              },
            );
            student.assignedSeatId = seat._id as Types.ObjectId;
            await student.save();
          }
        }
      }

      const attendanceRows: Array<Record<string, unknown>> = [];
      for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
        const date = addDays(today, -dayOffset);
        for (const studentId of studentDocs) {
          if ((dayOffset + String(studentId).length) % 3 === 0) continue;
          const checkInHour = 8 + ((dayOffset + globalStudentIndex) % 4);
          const checkInAt = new Date(date);
          checkInAt.setHours(checkInHour, 15 + (dayOffset % 20), 0, 0);
          const checkOutAt = new Date(checkInAt);
          checkOutAt.setHours(checkInHour + 6 + (dayOffset % 2), 30, 0, 0);
          const durationMinutes = Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60_000);
          attendanceRows.push({
            libraryId: library._id,
            branchId: branchDoc._id,
            studentId,
            seatId: null,
            date: startOfDay(date),
            checkInAt,
            checkOutAt,
            durationMinutes,
            status: dayOffset % 9 === 0 ? 'LATE' : 'CHECKED_OUT',
            method: dayOffset % 5 === 0 ? 'QR' : 'MANUAL',
            createdBy: receptionist._id,
            updatedBy: receptionist._id,
          });
        }
      }
      if (attendanceRows.length) await AttendanceModel.insertMany(attendanceRows, { ordered: false });

      const notifications = [
        { user: manager, role: ROLES.MANAGER, title: 'Daily collection summary', message: `Collections recorded for ${branch.name} are ready for review.`, type: 'PAYMENT_DUE' },
        { user: receptionist, role: ROLES.RECEPTIONIST, title: 'Seat occupancy update', message: `${branch.name} crossed ${Math.round(branch.seats * 0.7)} occupied seats today.`, type: 'ANNOUNCEMENT' },
        { user: accountant, role: ROLES.ACCOUNTANT, title: 'Overdue dues reminder', message: `Review overdue invoices for ${branch.name}.`, type: 'PAYMENT_OVERDUE' },
        { user: security, role: ROLES.SECURITY, title: 'Attendance alert', message: `Late check-ins were recorded at ${branch.name}.`, type: 'ATTENDANCE_ALERT' },
      ].map((item, idx) => ({
        libraryId: library._id,
        branchId: branchDoc._id,
        recipientUserId: item.user._id,
        recipientRole: item.role,
        recipientType: 'USER',
        title: item.title,
        message: item.message,
        type: item.type,
        channel: 'IN_APP',
        status: 'SENT',
        readAt: idx % 3 === 0 ? new Date() : null,
        sentAt: addDays(today, -(idx + 1)),
        metadata: { demoSeed: true, branchCode: branch.code },
        createdBy: owner._id,
      }));
      await NotificationModel.insertMany(notifications, { ordered: false });
    }

    log(`Seeded ${blueprint.name} with ${blueprint.studentCount} students.`);
  }
}

async function run(): Promise<void> {
  const { clean } = parseArgs();
  try {
    await connectDB();
    await seedRbacCore();
    const roleMap = await loadRoleMap();
    await ensureSuperAdmin(roleMap);

    if (clean) {
      await cleanDemoData();
    }

    const seedStatus = await getDemoSeedStatus();
    if (seedStatus === 'complete' && !clean) {
      log('Demo data already present. Re-run with npm run seed:demo:clean to reset, or use the credentials in docs/demo-seed.md.');
      await logDemoSeedSummary();
    } else {
      if (seedStatus === 'partial' && !clean) {
        log('Incomplete demo seed detected. Clearing demo data before re-seeding.');
        await cleanDemoData();
      }

      await seedPlatformSettings();
      await seedLibraries(roleMap);
      await seedDemoRequests();
      log('Demo data seed completed.');
      await logDemoSeedSummary();
    }

    log('Test logins:');
    for (const [role, cred] of Object.entries(CREDENTIALS)) {
      log(`  ${role}: ${cred.email} / ${cred.password}`);
    }
  } catch (error) {
    logger.error('[seed:demo] Failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

const isDirect = require.main === module;
if (isDirect) {
  void run();
}

export { run as runDemoDataSeeder, CREDENTIALS as DEMO_SEED_CREDENTIALS };
