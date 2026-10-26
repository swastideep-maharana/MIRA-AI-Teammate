import { cookies } from "next/headers"
import { getUserChats, getUserBots } from "@/queries/bots"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sidebarCookie = cookieStore.get("sidebar_state")?.value
  const defaultOpen =
    sidebarCookie === undefined ? true : sidebarCookie === "true"

  const [chats, bots] = await Promise.all([getUserChats(), getUserBots()])

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh max-h-svh overflow-hidden"
    >
      <AppSidebar chats={chats} bots={bots} />
      <SidebarInset className="h-full max-h-svh overflow-hidden flex flex-col min-h-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
