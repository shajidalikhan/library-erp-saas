import {
  Armchair,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  CreditCard,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type LandingNavItem = { label: string; href: string };

export const LANDING_NAV: LandingNavItem[] = [
  { label: 'Features', href: '#features' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'Branches', href: '#multi-branch' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export type LandingFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Users,
    title: 'Student lifecycle',
    description: 'Admissions, profiles, transfers, and membership windows in one searchable directory.',
  },
  {
    icon: Armchair,
    title: 'Seat operations',
    description: 'Floor plans, assignments, occupancy, and shift-aware availability across branches.',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance',
    description: 'Daily check-ins, summaries, and branch-scoped views for managers and security.',
  },
  {
    icon: CreditCard,
    title: 'Fees & invoices',
    description: 'Fee plans, partial payments, dues tracking, and receipt-ready collections.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & reports',
    description: 'Revenue, occupancy, and operational exports your owners can trust.',
  },
  {
    icon: Shield,
    title: 'Role-based access',
    description: 'Granular permissions for owners, managers, reception, accounts, and security staff.',
  },
  {
    icon: Building2,
    title: 'Multi-branch',
    description: 'Standardize policies while letting each branch run its own day-to-day operations.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'In-app announcements and reminders that respect tenant boundaries.',
  },
];

/** Home page pricing (“talk to sales” flow); INR list prices match platform catalog defaults. */
export type LandingPricingPlan = {
  name: string;
  description: string;
  highlights: string[];
  featured?: boolean;
  perfectFor: string;
  monthlyPrice: string;
  yearlyPrice: string;
};

export const LANDING_PRICING_PLANS: LandingPricingPlan[] = [
  {
    name: 'Basic',
    description: '14-day trial, no card required · full-access demo',
    perfectFor: 'Small reading rooms and single-branch operators.',
    highlights: [
      '50 seats · 1 branch · 5 staff',
      '1 GB optimized cloud storage',
      'Attendance & QR attendance',
      'Payments · invoices · core reports',
    ],
    monthlyPrice: '₹499',
    yearlyPrice: '₹4,999',
  },
  {
    name: 'Growth',
    description: 'Most teams land here once exports and reminders matter.',
    perfectFor: 'Growing libraries coordinating multiple branches.',
    highlights: [
      '150 seats · 3 branches',
      'Analytics · exports · reminders · notifications',
      'Role-permission depth',
      'Operational seats & attendance workflows',
    ],
    monthlyPrice: '₹1,499',
    yearlyPrice: '₹14,999',
    featured: true,
  },
  {
    name: 'Professional',
    description: 'Automation, integrations, and compliance-friendly exports.',
    perfectFor: 'Multi-branch hubs and regional operators.',
    highlights: [
      '500 seats · 10 branches',
      'WhatsApp · SMS · audit logs · advanced exports',
      'API access & automation jobs where enabled',
      'Higher storage and SLA-friendly limits',
    ],
    monthlyPrice: '₹3,999',
    yearlyPrice: '₹39,999',
  },
  {
    name: 'Enterprise',
    description: 'Custom limits, onboarding, SLAs.',
    perfectFor: 'Franchise chains & white-label programs.',
    highlights: ['Unlimited / custom limits', 'White label · custom domains', 'Dedicated platform support'],
    monthlyPrice: 'Custom',
    yearlyPrice: 'Custom',
  },
];

export type LandingTestimonial = {
  quote: string;
  name: string;
  role: string;
  library: string;
};

export const LANDING_TESTIMONIALS: LandingTestimonial[] = [
  {
    quote:
      'We replaced five spreadsheets in the first week. Owners finally see occupancy and dues on one screen.',
    name: 'Priya Sharma',
    role: 'Library owner',
    library: 'Focus Study Hub, Pune',
  },
  {
    quote:
      'Branch managers check attendance and seat maps without calling the front desk. Reception loves the speed.',
    name: 'Arjun Mehta',
    role: 'Operations lead',
    library: 'Civic Readers, Ahmedabad',
  },
  {
    quote:
      'Collections are cleaner—partial payments, invoices, and reminders are all in the same workflow.',
    name: 'Neha Kapoor',
    role: 'Accounts manager',
    library: 'NorthStar Library, Delhi',
  },
];

export type LandingFaq = { question: string; answer: string };

export const LANDING_FAQ: LandingFaq[] = [
  {
    question: 'Is this built for self-study libraries specifically?',
    answer:
      'Yes. Students, seats, shifts, memberships, and fee cycles are modeled for reading-room operations—not generic school ERP workflows.',
  },
  {
    question: 'Can we run multiple branches under one account?',
    answer:
      'Yes. Owners get a library-wide view while managers and reception staff stay scoped to their branch.',
  },
  {
    question: 'How does pricing work as we grow?',
    answer:
      'Plans scale by seat capacity, branches, and capabilities. Upgrade when you need more seats, exports, or notification channels. Every plan includes a full-access trial.',
  },
  {
    question: 'Do you support role-based permissions?',
    answer:
      'Every role ships with least-privilege defaults. Owners can extend access with custom roles on higher tiers.',
  },
  {
    question: 'Can we export reports for accounting?',
    answer:
      'Reports and analytics support CSV and PDF exports for students, attendance, payments, and dues.',
  },
  {
    question: 'How do we get started?',
    answer:
      'Request a demo for a guided walkthrough, or sign in if your workspace is already provisioned.',
  },
];

export const LANDING_PROBLEM_BULLETS = [
  'Seat assignments tracked in chats and paper registers',
  'Fee follow-ups scattered across UPI screenshots',
  'No single view of occupancy across branches',
  'Staff permissions handled informally, not by role',
];

export const LANDING_SOLUTION_BULLETS = [
  'One dashboard for students, seats, attendance, and payments',
  'Branch-aware operations with owner-level oversight',
  'Exports and analytics leadership can act on',
  'RBAC that matches how libraries actually run',
];
