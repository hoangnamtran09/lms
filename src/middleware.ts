import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicPaths = ["/login"];
const adminPaths = ["/admin"];
const parentPaths = ["/parent"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create Supabase server client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const role = session?.user?.app_metadata?.role as string | undefined;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  // If on login page and already logged in, redirect
  if (pathname.startsWith("/login")) {
    if (session) {
      return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/", request.url));
    }
    return NextResponse.next();
  }

  // Protect all other routes
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection — allow teachers on /admin/assignments for grading
  const isTeacher = role === "TEACHER";
  const teacherAllowedPaths = ["/admin/assignments"];
  if (
    adminPaths.some((p) => pathname.startsWith(p)) &&
    !isAdmin &&
    !(isTeacher && teacherAllowedPaths.some((p) => pathname.startsWith(p)))
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Parent route protection
  const isParent = role === "PARENT";
  if (parentPaths.some((p) => pathname.startsWith(p)) && !isParent) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  // Set token cookie for Go backend (used by iframe PDF, beacons, etc.)
  if (session?.access_token) {
    response.cookies.set("token", session.access_token, {
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
