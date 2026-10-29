import Image from "next/image"
import Link from "next/link"
import { SignUp } from "@clerk/nextjs"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-6 bg-background text-foreground transition-colors">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(6,182,212,0.08),transparent_70%)]" />

      <div className="w-full max-w-md flex flex-col items-center">
        {/* Brand header */}
        <Link href="/" className="mb-6 flex flex-col items-center gap-2 group">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-card border border-border shadow-sm group-hover:border-cyan-500/50 transition-colors">
            <Image src="/logo.svg" alt="Mira Logo" width={32} height={32} />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Mira AI Teammate</span>
          <span className="text-xs text-muted-foreground">
            Create an account to collaborate with your AI teammates
          </span>
        </Link>

        {/* Clerk Sign Up */}
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-lg border border-border rounded-2xl bg-card",
              card: "shadow-none bg-transparent p-6 sm:p-8",
              socialButtonsBlockButton:
                "border border-border bg-background hover:bg-muted text-foreground font-medium rounded-lg transition-colors",
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-lg shadow-sm transition-colors",
              formFieldInput:
                "bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-input",
              footerActionLink: "text-primary font-medium hover:underline",
            },
          }}
        />
      </div>
    </div>
  )
}
