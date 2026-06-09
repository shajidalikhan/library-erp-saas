'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  Sparkles,
  X,
} from 'lucide-react';

import { Logo } from '@/components/common/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ROUTES } from '@/constants/routes';
import { ENV } from '@/lib/env';
import { cn } from '@/lib/utils';
import {
  LANDING_FAQ,
  LANDING_FEATURES,
  LANDING_NAV,
  LANDING_PRICING_PLANS,
  LANDING_PROBLEM_BULLETS,
  LANDING_SOLUTION_BULLETS,
  LANDING_TESTIMONIALS,
} from '@/modules/marketing/landing-content';
import { AnalyticsPreview, DashboardPreview } from '@/modules/marketing/components/landing-mockups';
import { usePublicPricingPlansWithFallback } from '@/modules/marketing/hooks/use-public-pricing-plans';
import { FadeIn, HeroFloat } from '@/modules/marketing/components/landing-motion';

function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  inverted = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'center' | 'left';
  inverted?: boolean;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-[0.2em]',
          inverted ? 'text-primary-foreground/70' : 'text-primary',
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl',
          inverted ? 'text-white' : 'text-foreground',
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          'mt-3 text-pretty text-base sm:text-lg',
          inverted ? 'text-zinc-300' : 'text-muted-foreground',
        )}
      >
        {description}
      </p>
    </div>
  );
}

function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo href={ROUTES.ROOT} />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {LANDING_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <LandingCtas className="hidden md:flex" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-4" aria-label="Mobile">
              {LANDING_NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-base font-medium"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <LandingCtas className="mt-8 flex-col" onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function LandingCtas({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button asChild variant="ghost">
        <Link href={ROUTES.LOGIN} onClick={onNavigate}>
          Sign in
        </Link>
      </Button>
      <Button asChild>
        <Link href={ROUTES.REQUEST_DEMO} onClick={onNavigate}>
          Request a demo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-32 -z-10 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl"
        aria-hidden
      />
      <div className="container grid gap-12 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-28 lg:pt-20">
        <FadeIn>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Built for modern study libraries
          </Badge>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            The operating system for your self-study library
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            {ENV.APP_NAME} unifies students, seats, attendance, payments, and reporting across every branch—so
            owners see the full picture and staff move faster at the desk.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.REQUEST_DEMO}>
                Request a demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.LOGIN}>Sign in</Link>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {['Multi-branch ready', 'Role-based access', 'Exports & analytics'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>
        <HeroFloat className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-sky-400/20 blur-2xl" />
          <DashboardPreview />
        </HeroFloat>
      </div>
    </section>
  );
}

function ProblemSolutionSection() {
  return (
    <section className="border-b border-border/60 bg-muted/30 py-20 sm:py-24">
      <div className="container">
        <FadeIn>
          <SectionHeading
            eyebrow="Why switch"
            title="Stop running the library from scattered tools"
            description="Most reading rooms outgrow spreadsheets long before they outgrow demand. Replace friction with one system your team trusts."
            align="left"
          />
        </FadeIn>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <FadeIn delay={0.05}>
            <Card className="border-destructive/20 bg-background/80 shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg">The daily friction</CardTitle>
                <CardDescription>What slows owners and front-desk teams down today.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {LANDING_PROBLEM_BULLETS.map((item) => (
                    <li key={item} className="flex gap-3">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Card className="border-primary/20 bg-background shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg">The {ENV.APP_NAME} way</CardTitle>
                <CardDescription>One workspace for operations, finance, and oversight.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {LANDING_SOLUTION_BULLETS.map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 border-b border-border/60 py-20 sm:py-24">
      <div className="container">
        <FadeIn>
          <SectionHeading
            eyebrow="Platform"
            title="Everything your library runs on, in one product"
            description="From admissions to collections, each module shares the same tenant boundaries, permissions, and reporting fabric."
          />
        </FadeIn>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
            <FadeIn key={feature.title} delay={index * 0.04}>
              <Card className="h-full border-border/70 bg-card/80 shadow-soft transition-shadow hover:shadow-md">
                <CardHeader className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AnalyticsSection() {
  return (
    <section id="analytics" className="scroll-mt-24 border-b border-zinc-800 bg-zinc-950 py-20 text-zinc-50 sm:py-24">
      <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <SectionHeading
            eyebrow="Analytics"
            title="See revenue, occupancy, and risk before they become surprises"
            description="Leadership dashboards surface dues, overdue invoices, branch performance, and trial windows—without exporting to another tool."
            align="left"
            inverted
          />
          <ul className="mt-8 space-y-3 text-sm text-zinc-300">
            {[
              'Monthly revenue and collection trends',
              'Seat occupancy by branch and floor',
              'Student growth and membership health',
              'Export-ready reports for finance',
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>
        <FadeIn delay={0.08}>
          <AnalyticsPreview />
        </FadeIn>
      </div>
    </section>
  );
}

function MultiBranchSection() {
  return (
    <section id="multi-branch" className="scroll-mt-24 border-b border-border/60 bg-muted/20 py-20 sm:py-24">
      <div className="container grid gap-10 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <SectionHeading
            eyebrow="Multi-branch"
            title="Standardize policy. Let each branch run its day."
            description="Owners configure plans, roles, and limits once. Managers and reception staff stay scoped to the branch they operate—without losing library-wide visibility upstairs."
            align="left"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Branch directory', body: 'Searchable branches with local contact and capacity context.' },
              { title: 'Scoped staff', body: 'Managers see only their floor; owners see every location.' },
              { title: 'Shared billing', body: 'Fee plans and dues roll up cleanly for finance review.' },
              { title: 'Central announcements', body: 'Push updates to one branch or the whole library.' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border/70 bg-background p-4 shadow-soft">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </FadeIn>
        <FadeIn delay={0.08}>
          <DashboardPreview className="rotate-1 lg:rotate-2" />
        </FadeIn>
      </div>
    </section>
  );
}

function PricingSection() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const { data: pricingPlans } = usePublicPricingPlansWithFallback();

  return (
    <section id="pricing" className="scroll-mt-24 border-b border-border/60 py-20 sm:py-24">
      <div className="container">
        <FadeIn>
          <SectionHeading
            eyebrow="Pricing"
            title="Seat-based plans · 14-day trial on every tier"
            description="No credit card required to evaluate. Billing is INR. Yearly subscriptions include about two billable months on the house at list prices."
          />
        </FadeIn>

        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-transparent to-muted/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Launch offer</p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Complimentary onboarding: free setup concierge, complementary data imports, and team training —
              bundled with demos booked early.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">30-day full trial*</Badge>
            <Badge variant="secondary">White-glove setup</Badge>
            <Badge variant="secondary">Hands-on training</Badge>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          *Full product access aligns with tenant trial policy during evaluation.
        </p>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">Compare monthly versus yearly runway.</p>
          <div className="flex overflow-hidden rounded-lg border border-input bg-muted/60 p-0.5 text-sm shadow-inner">
            <button
              type="button"
              className={cn(
                'rounded-md px-4 py-1.5 font-medium transition-colors',
                billing === 'monthly'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(
                'rounded-md px-4 py-1.5 font-medium transition-colors',
                billing === 'yearly'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setBilling('yearly')}
            >
              Yearly
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-primary">Yearly: ~2 months free vs paying monthly*</p>

        <div className="mt-10 grid gap-6 xl:grid-cols-4">
          {(pricingPlans ?? LANDING_PRICING_PLANS).map((plan, index) => (
            <FadeIn key={plan.name} delay={index * 0.05}>
              <Card
                className={cn(
                  'flex h-full flex-col border-border/70 shadow-soft',
                  plan.featured &&
                    'border-primary/45 shadow-lg shadow-primary/10 ring-1 ring-primary/25 xl:-translate-y-1 xl:shadow-xl',
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.featured ? <Badge>Most Popular</Badge> : null}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="pt-2 text-3xl font-semibold tracking-tight">
                    {billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    <span className="text-sm font-normal text-muted-foreground">
                      {' '}
                      / {billing === 'monthly' ? 'month' : 'year'}
                    </span>
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Perfect for
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.perfectFor}</p>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <details className="group rounded-xl border bg-muted/20 px-4 py-2 text-sm">
                    <summary className="cursor-pointer select-none font-medium text-foreground">
                      Highlights
                      <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                        (expand)
                      </span>
                    </summary>
                    <ul className="mt-3 space-y-2 text-muted-foreground">
                      {plan.highlights.map((item) => (
                        <li key={item} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </details>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full" variant={plan.featured ? 'default' : 'outline'}>
                    <Link href={ROUTES.REQUEST_DEMO}>Request demo</Link>
                  </Button>
                </CardFooter>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section id="testimonials" className="scroll-mt-24 border-b border-zinc-800 bg-zinc-950 py-20 text-zinc-50 sm:py-24">
      <div className="container">
        <FadeIn>
          <SectionHeading
            eyebrow="Customers"
            title="Trusted by operators who run tight ships"
            description="Owners, managers, and accounts teams use the same source of truth—so handoffs at the front desk stop breaking downstream."
            inverted
          />
        </FadeIn>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {LANDING_TESTIMONIALS.map((item, index) => (
            <FadeIn key={item.name} delay={index * 0.06}>
              <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-sm">
                <blockquote className="flex-1 text-sm leading-relaxed text-zinc-200">&ldquo;{item.quote}&rdquo;</blockquote>
                <figcaption className="mt-6 border-t border-white/10 pt-4">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-sm text-zinc-400">
                    {item.role} · {item.library}
                  </p>
                </figcaption>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 border-b border-border/60 bg-muted/30 py-20 sm:py-24">
      <div className="container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <FadeIn>
          <SectionHeading
            eyebrow="FAQ"
            title="Answers before you book a walkthrough"
            description="Still deciding? These are the questions library owners ask most often during onboarding."
            align="left"
          />
        </FadeIn>
        <div className="space-y-3">
          {LANDING_FAQ.map((item, index) => {
            const open = openIndex === index;
            return (
              <FadeIn key={item.question} delay={index * 0.03}>
                <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-soft">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={open}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span className="font-medium">{item.question}</span>
                    <ChevronDown
                      className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                  {open ? (
                    <div className="border-t border-border/60 px-5 pb-4 pt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </div>
                  ) : null}
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary via-primary to-sky-600" aria-hidden />
      <div className="container">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center text-primary-foreground">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to run your library like a modern SaaS operator?
            </h2>
            <p className="mt-4 text-pretty text-base text-primary-foreground/85 sm:text-lg">
              Book a guided demo to see students, seats, attendance, and payments in one workflow—or sign in if your
              workspace is already live.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href={ROUTES.REQUEST_DEMO}>
                  Request a demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link href={ROUTES.LOGIN}>Sign in</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-background py-10">
      <div className="container flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo href={ROUTES.ROOT} />
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {ENV.APP_NAME}. All rights reserved.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {LANDING_NAV.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <LandingNavbar />
      <LandingHero />
      <ProblemSolutionSection />
      <FeaturesSection />
      <AnalyticsSection />
      <MultiBranchSection />
      <PricingSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCtaSection />
      <LandingFooter />
    </main>
  );
}
