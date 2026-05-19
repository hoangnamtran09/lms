import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
const adminPaths = ["/admin"];
const parentPaths = ["/parent"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
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

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    if (sessionExists && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/", request.url));
    }
    return NextResponse.next();
  }

  if (!sessionExists) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear stale auth cookies
    const cookiesToClear = request.cookies.getAll().filter(c => c.name.startsWith("sb-"));
    for (const c of cookiesToClear) {
      response.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
    return response;
  }

  const isTeacher = role === "TEACHER";
  const teacherAllowedPaths = ["/admin/assignments", "/admin/students", "/admin/parents"];
  if (
    adminPaths.some((p) => pathname.startsWith(p)) &&
    !isAdmin &&
    !(isTeacher && teacherAllowedPaths.some((p) => pathname.startsWith(p)))
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isParent = role === "PARENT";
  if (parentPaths.some((p) => pathname.startsWith(p)) && !isParent) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  if (accessToken) {
    response.cookies.set("token", accessToken, {
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
