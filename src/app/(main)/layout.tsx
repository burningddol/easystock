import { BottomTabNav } from "@/components/ui/bottom-tab-nav";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps): React.ReactElement {
  return (
    <div className="page-shell min-h-screen bg-bg pb-28">
      <main className="mx-auto max-w-screen-md px-screen pb-screen pt-4">{children}</main>
      <BottomTabNav />
    </div>
  );
}
