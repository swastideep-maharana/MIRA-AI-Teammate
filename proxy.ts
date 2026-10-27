import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    const { userId } = await auth()
    if (!userId) {
      // If this is a Server Action, POST, or RSC refresh triggered during/after sign-out, return 200 instead of crashing
      if (
        request.method === "POST" ||
        request.headers.has("next-action") ||
        request.headers.get("accept")?.includes("text/x-component")
      ) {
        return new NextResponse(null, { status: 200 })
      }

      const signInUrl = new URL("/sign-in", request.url)
      signInUrl.searchParams.set("redirect_url", request.url)
      return NextResponse.redirect(signInUrl)
    }
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
