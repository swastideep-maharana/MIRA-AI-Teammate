import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  if (!userId && !isPublicRoute(req)) {
    // If it's an API route that requires auth, return 401
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Intercept unauthenticated POST / RSC / Action requests (e.g. Clerk signOut cache invalidation)
    // so Next.js never reaches `redirect()` inside an RSC action render, preventing 500 & React error #441
    const isRscOrAction =
      req.method === "POST" ||
      req.headers.has("next-action") ||
      req.headers.get("accept")?.includes("text/x-component") ||
      req.headers.get("rsc") === "1"

    if (isRscOrAction) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
          "X-Action-Redirect": "/sign-in",
        },
      })
    }

    // For standard page navigation GET requests, cleanly redirect to /sign-in
    const signInUrl = new URL("/sign-in", req.url)
    return NextResponse.redirect(signInUrl)
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
