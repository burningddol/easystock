interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-screen">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
