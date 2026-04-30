import { BottomTabNav } from "@/components/ui/bottom-tab-nav";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps): React.ReactElement {
  return (
    <div className="min-h-screen bg-bg pb-20">
      <main className="mx-auto max-w-screen-md p-screen">{children}</main>
      <BottomTabNav />
    </div>
  );
}
