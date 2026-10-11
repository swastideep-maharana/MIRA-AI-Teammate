import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col p-6">
      <header className="flex w-full items-center justify-between pb-6 border-b border-border">
        <div className="font-semibold text-lg">Mira AI Teammate</div>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Sign Up</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose text-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to Mira AI Teammate
            </h1>
            <p className="text-muted-foreground mt-2">
              Authentication is configured with Clerk. Sign in to collaborate with
              your AI teammates.
            </p>
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            (Press <kbd className="rounded border px-1">d</kbd> to toggle dark mode)
          </div>
        </div>
      </main>
    </div>
  )
}
