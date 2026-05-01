import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

type CookieMutation = { name: string; value: string; options: CookieOptions };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// `/`는 middleware에서 user 상태로 직접 redirect → root RSC 한 단계 제거.
const PUBLIC_PATHS = ["/login", "/signup", "/manifest.webmanifest"];
const STATIC_PREFIXES = ["/_next/", "/icons/", "/fonts/", "/sw.js"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieMutation[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // `/` 진입은 인증 상태에 따라 곧장 redirect — RSC root page 우회.
  if (pathname === "/") {
    const target = user ? "/today" : "/login";
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url);
  }

  // 인증 안 된 사용자: protected route 접근 시 /login 리디렉션
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 인증된 사용자: grace period 진행 중이면 차단 + /login 안내
  // (contracts/auth.md: withdrawal_in_progress 에러)
  //
  // hot-path 최적화: withdrawal_requested_at은 grace period(다일) 단위라 페이지마다
  // 확인할 필요 없음. cookie 존재 = 1분 내에 검사 완료. 매번 DB 왕복하던 것을
  // 분당 최대 1회로 축소. withdrawal 발생 시 다음 1분 안에 차단되므로 UX 영향 없음.
  if (user && !request.cookies.has(WITHDRAWAL_CHECK_COOKIE)) {
    const { data } = await supabase
      .from("users")
      .select("withdrawal_requested_at")
      .eq("id", user.id)
      .maybeSingle();

    const profile = data as { withdrawal_requested_at: string | null } | null;

    if (profile?.withdrawal_requested_at) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("withdrawal_in_progress", "1");
      return NextResponse.redirect(loginUrl);
    }

    response.cookies.set(WITHDRAWAL_CHECK_COOKIE, "1", {
      maxAge: WITHDRAWAL_CACHE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

const WITHDRAWAL_CHECK_COOKIE = "es-w-checked";
const WITHDRAWAL_CACHE_SECONDS = 60;

export const config = {
  matcher: [
    /*
     * 모든 경로 매칭. 단 다음은 제외:
     * - 정적 파일 (_next/static, _next/image, favicon, icons)
     * - sw.js (서비스 워커)
     * 미들웨어 내부에서 isPublicPath()로 한 번 더 필터.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|icons/|fonts/).*)",
  ],
};
