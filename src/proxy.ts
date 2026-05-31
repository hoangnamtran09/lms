import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];

/**
 * Copy Supabase session cookies from the temp response (where they were set during
 * getUser/getSession) onto the actual response we're sending to the browser.
 */
function copySupabaseCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value);
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Temp response collects cookies Supabase sets during session check/refresh
  const cookieJar = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => {
            request.cookies.set(c.name, c.value);
            cookieJar.cookies.set(c.name, c.value);
          });
        },
      },
    }
  );

  let role: string | undefined;
  let accessToken: string | undefined;
  let sessionExists = false;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!userError && user) {
      sessionExists = true;
      role = user.app_metadata?.role as string | undefined;
    }
  } catch {
    // Auth server unreachable — treat as unauthenticated
  }

  if (sessionExists) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  }

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isTeacher = role === "TEACHER";
  const isParent = role === "PARENT";

  /** Build a response that includes any Supabase cookies that were set during auth checks. */
  const ok = (res?: NextResponse) => {
    const r = res ?? NextResponse.next();
    copySupabaseCookies(cookieJar, r);
    if (accessToken) {
      r.cookies.set("token", accessToken, {
        path: "/",
        maxAge: 86400,
        sameSite: "lax",
      });
    }
    return r;
  };

  const redirect = (path: string) => {
    const r = NextResponse.redirect(new URL(path, request.url));
    copySupabaseCookies(cookieJar, r);
    return r;
  };

  // Redirect authenticated users away from /login to their dashboard
  if (sessionExists && pathname.startsWith("/login")) {
    if (isAdmin) return redirect("/admin");
    if (isTeacher) return redirect("/teacher");
    if (isParent) return redirect("/parent");
    return ok();
  }

  // Allow all public paths through (for unauthenticated users)
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return ok();
  }

  if (!sessionExists) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const r = NextResponse.redirect(loginUrl);
    // Clear stale auth cookies
    const cookiesToClear = request.cookies.getAll().filter(c => c.name.startsWith("sb-"));
    for (const c of cookiesToClear) {
      r.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
    return r;
  }

  // Redirect root path to role-specific dashboard
  if (sessionExists && pathname === "/") {
    if (isAdmin) return redirect("/admin");
    if (isTeacher) return redirect("/teacher");
    if (isParent) return redirect("/parent");
    return ok();
  }

  // Let all authenticated users access any page.
  // Authorization is handled by the backend API (RequirePermission).
  // Frontend sidebar filters nav items by role.
  return ok();
}

export const config = {
  // Exclude API, next static assets, images and any request for files with extensions
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
