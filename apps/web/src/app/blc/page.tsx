'use client';

import dynamic from 'next/dynamic';

const MainTabs = dynamic(() => import('@/components/main-tabs').then((mod) => mod.MainTabs), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-sm text-muted-foreground">
      Loading Bridge Loss Calculator...
    </div>
  ),
});

export default function BlcPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MainTabs />
    </div>
  );
}
