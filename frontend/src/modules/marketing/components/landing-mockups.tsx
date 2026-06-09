'use client';

import { cn } from '@/lib/utils';

const BAR_HEIGHTS = [42, 68, 55, 82, 61, 74, 48, 88, 58, 72, 65, 79];

function PreviewShell({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MotionlessOuter className={className}>
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
        <span className="ml-3 text-xs text-muted-foreground">{title}</span>
      </div>
      {children}
    </MotionlessOuter>
  );
}

function MotionlessOuter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-primary/10 ring-1 ring-black/5',
        className,
      )}
    >
      {children}
    </div>
  );
}

function NavStub({ active }: { active: boolean }) {
  return <div className={cn('h-2 rounded', active ? 'w-8 bg-primary/70' : 'w-6 bg-muted-foreground/20')} />;
}

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <PreviewShell className={className} title="dashboard · occupancy & revenue">
      <div className="flex min-h-[320px] sm:min-h-[380px]">
        <aside className="hidden w-14 shrink-0 border-r border-border/60 bg-muted/30 p-2 sm:block">
          <div className="mx-auto h-6 w-6 rounded-lg bg-primary/80" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <NavStub key={i} active={i === 0} />
            ))}
          </div>
        </aside>
        <div className="flex-1 space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Students', value: '1,248', delta: '+12%' },
              { label: 'Occupancy', value: '87%', delta: '+4%' },
              { label: 'Today check-ins', value: '326', delta: 'Live' },
              { label: 'Revenue (MTD)', value: '₹8.4L', delta: '+18%' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-border/60 bg-background/80 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">{kpi.value}</p>
                <p className="mt-0.5 text-[10px] text-primary">{kpi.delta}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 lg:col-span-3">
              <p className="text-xs font-medium text-muted-foreground">Weekly attendance</p>
              <ChartStub />
            </div>
            <SeatGridStub />
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function ChartStub() {
  return (
    <div className="mt-4 flex h-28 items-end gap-1.5">
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-gradient-to-t from-primary/30 to-primary"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function SeatGridStub() {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-3 lg:col-span-2">
      <p className="text-xs font-medium text-muted-foreground">Seat map · Floor A</p>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-md border',
              i % 5 === 0
                ? 'border-amber-500/40 bg-amber-500/15'
                : i % 3 === 0
                  ? 'border-primary/30 bg-primary/15'
                  : 'border-border/60 bg-muted/40',
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between text-sm text-zinc-300">
        <span>Branch performance</span>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Last 30 days</span>
      </div>
      <div className="mt-6 space-y-4">
        {[
          { name: 'Koramangala', value: 92, revenue: '₹2.1L' },
          { name: 'Indiranagar', value: 78, revenue: '₹1.6L' },
          { name: 'Whitefield', value: 64, revenue: '₹1.2L' },
        ].map((row) => (
          <div key={row.name}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{row.name}</span>
              <span>{row.revenue}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <ProgressBarStub width={row.value} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center">
        {[
          { label: 'Dues', value: '₹42k' },
          { label: 'Overdue', value: '18' },
          { label: 'Trials ending', value: '6' },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-lg font-semibold text-white">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBarStub({ width }: { width: number }) {
  return (
    <div
      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-primary"
      style={{ width: `${width}%` }}
    />
  );
}
