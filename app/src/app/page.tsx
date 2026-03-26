import { MainTabs } from '@/components/main-tabs';
import { PrintReport } from '@/components/print-report';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <MainTabs />
      <PrintReport />
    </div>
  );
}
