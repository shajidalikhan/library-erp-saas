'use client';



import { useRouter, useSearchParams } from 'next/navigation';



import { PageHeader } from '@/components/common/page-header';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ROUTES } from '@/constants/routes';

import { useAuth } from '@/hooks/use-auth';
import { useSubscriptionFeatures } from '@/modules/subscription/hooks/use-subscription-features';

import {
  canAccessPublicBookingPage,
  canViewPublicBookingListTab,
  canViewPublicBookingSettingsTab,
  PUBLIC_BOOKING_MESSAGES,
} from '@/modules/bookings/lib/public-booking-access';



import { PublicBookingListTab } from './public-booking-list-tab';

import { PublicBookingSettingsTab } from './public-booking-settings-tab';



export function PublicBookingPage() {

  const searchParams = useSearchParams();

  const router = useRouter();

  const { user } = useAuth();
  const {
    features,
    enabledFeaturesOverride,
    disabledFeaturesOverride,
  } = useSubscriptionFeatures();

  const tab = searchParams.get('tab') === 'bookings' ? 'bookings' : 'settings';

  const featureOpts = {
    subscriptionFeatures: features,
    enabledFeaturesOverride,
    disabledFeaturesOverride,
  };

  const pageAccess = canAccessPublicBookingPage(user, featureOpts);
  const settingsAccess = canViewPublicBookingSettingsTab(user, featureOpts);
  const listAccess = canViewPublicBookingListTab(user, featureOpts);



  const onTabChange = (value: string) => {

    const params = new URLSearchParams(searchParams.toString());

    if (value === 'bookings') params.set('tab', 'bookings');

    else params.delete('tab');

    const query = params.toString();

    router.replace(query ? `${ROUTES.BOOKINGS_PUBLIC_PAGE}?${query}` : ROUTES.BOOKINGS_PUBLIC_PAGE);

  };



  if (!pageAccess.allowed) {

    return (

      <div className="space-y-6">

        <PageHeader title="Public Booking" description="Public seat hold requests and page settings." />

        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">

          {pageAccess.reason || PUBLIC_BOOKING_MESSAGES.page}

        </div>

      </div>

    );

  }



  const showSettings = settingsAccess.allowed;

  const showBookings = listAccess.allowed;

  const defaultTab = showSettings ? 'settings' : showBookings ? 'bookings' : 'settings';

  const activeTab = tab === 'bookings' && showBookings ? 'bookings' : showSettings ? defaultTab : 'bookings';



  return (

    <div className="space-y-6">

      <PageHeader

        title="Public Booking"

        description="Manage your public landing page, gallery, and visitor seat holds."

      />

      <Tabs value={activeTab} onValueChange={onTabChange}>

        <TabsList>

          {showSettings ? <TabsTrigger value="settings">Settings</TabsTrigger> : null}

          {showBookings ? <TabsTrigger value="bookings">Bookings</TabsTrigger> : null}

        </TabsList>

        {showSettings ? (

          <TabsContent value="settings" className="mt-4">

            <PublicBookingSettingsTab />

          </TabsContent>

        ) : (

          <TabsContent value="settings" className="mt-4">

            <p className="text-sm text-muted-foreground">{settingsAccess.reason}</p>

          </TabsContent>

        )}

        {showBookings ? (

          <TabsContent value="bookings" className="mt-4">

            <PublicBookingListTab />

          </TabsContent>

        ) : (

          <TabsContent value="bookings" className="mt-4">

            <p className="text-sm text-muted-foreground">{listAccess.reason}</p>

          </TabsContent>

        )}

      </Tabs>

    </div>

  );

}

