import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/providers/ServiceWorkerRegister";
import { CookieConsentBanner } from "@/components/ui/cookie-consent-banner";
import { pretendard } from "./fonts";
import "./globals.css";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

export const metadata: Metadata = {
  title: "이지스톡 — 카페 재고·원가 관리",
  description:
    "카페·빙수집 사장님을 위한 재고·원가 관리 서비스. 매일 입력하는 매입·판매 데이터로 메뉴별 실시간 마진과 재료 소진 예측을 보여줍니다.",
  applicationName: "이지스톡",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "이지스톡",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1a1a",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactElement {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans">
        {children}
        <CookieConsentBanner />
        <ServiceWorkerRegister />
        <VercelAnalytics />
        {GA4_ID && <GoogleAnalytics gaId={GA4_ID} />}
      </body>
    </html>
  );
}
