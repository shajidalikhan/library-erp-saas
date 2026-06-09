'use client';

import { Copy, Headset, Mail, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { PlatformSupportConfig } from '@/hooks/use-platform-support-config';

function copyText(label: string, value: string) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

function whatsappUrl(number: string): string {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

export function SupportContactActions({
  config,
  compact = false,
}: {
  config: PlatformSupportConfig | undefined;
  compact?: boolean;
}) {
  if (!config) return null;

  const cards: { key: string; visible: boolean; content: React.ReactNode }[] = [];

  if (config.showSupportEmail && config.supportEmail) {
    cards.push({
      key: 'email',
      visible: true,
      content: (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className="gap-2"
            onClick={() => copyText('Email', config.supportEmail)}
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copy email
          </Button>
          <Button type="button" variant="outline" size={compact ? 'sm' : 'default'} className="gap-2" asChild>
            <a href={`mailto:${config.supportEmail}`}>
              <Mail className="h-4 w-4" aria-hidden />
              Email support
            </a>
          </Button>
        </div>
      ),
    });
  }

  if (config.showSupportPhone && config.supportPhone) {
    cards.push({
      key: 'phone',
      visible: true,
      content: (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className="gap-2"
            onClick={() => copyText('Phone', config.supportPhone)}
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copy phone
          </Button>
          <Button type="button" variant="outline" size={compact ? 'sm' : 'default'} className="gap-2" asChild>
            <a href={`tel:${config.supportPhone}`}>
              <Phone className="h-4 w-4" aria-hidden />
              Call now
            </a>
          </Button>
        </div>
      ),
    });
  }

  if (config.showWhatsappSupport && config.whatsappSupport) {
    cards.push({
      key: 'wa',
      visible: true,
      content: (
        <Button type="button" variant="default" size={compact ? 'sm' : 'default'} className="gap-2" asChild>
          <a href={whatsappUrl(config.whatsappSupport)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp chat
          </a>
        </Button>
      ),
    });
  }

  if (config.showSalesEmail && config.salesEmail) {
    cards.push({
      key: 'sales',
      visible: true,
      content: (
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className="gap-2"
          onClick={() => copyText('Sales email', config.salesEmail)}
        >
          <Headset className="h-4 w-4" aria-hidden />
          Copy sales email
        </Button>
      ),
    });
  }

  if (config.billingPhone) {
    cards.push({
      key: 'billing',
      visible: true,
      content: (
        <p className="text-sm text-muted-foreground">
          Billing phone:{' '}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => copyText('Billing phone', config.billingPhone)}
          >
            {config.billingPhone}
          </button>
        </p>
      ),
    });
  }

  const visibleCards = cards.filter((c) => c.visible);
  if (visibleCards.length === 0) {
    return <p className="text-sm text-muted-foreground">Support contacts are not configured.</p>;
  }

  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-3'}>
      {visibleCards.map((c) => (
        <div key={c.key}>{c.content}</div>
      ))}
    </div>
  );
}
