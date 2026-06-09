'use client';

import { MonitorSmartphone, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsAppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Theme and display preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Current theme: <span className="font-medium text-foreground">{theme ?? 'system'}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}>
            <Sun className="mr-2 h-4 w-4" />
            Light
          </Button>
          <Button type="button" variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}>
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </Button>
          <Button type="button" variant={theme === 'system' ? 'default' : 'outline'} onClick={() => setTheme('system')}>
            <MonitorSmartphone className="mr-2 h-4 w-4" />
            System
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Compact layout and density options coming soon.</p>
      </CardContent>
    </Card>
  );
}
