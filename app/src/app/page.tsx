import { TopBar } from '@/components/top-bar';
import { MainTabs } from '@/components/main-tabs';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <MainTabs />
    </div>
  );
}
