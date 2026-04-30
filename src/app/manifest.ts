import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "이지스톡 — 카페 재고·원가 관리",
    short_name: "이지스톡",
    description:
      "카페·빙수집 사장님을 위한 재고·원가 관리 서비스. 매일 입력하는 매입·판매 데이터로 메뉴별 실시간 마진과 재료 소진 예측을 보여줍니다.",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6f2",
    theme_color: "#1a1a1a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
