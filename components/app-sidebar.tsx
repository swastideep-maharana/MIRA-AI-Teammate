import { UserButton } from "@clerk/nextjs"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader />
      <SidebarContent />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<div />}
              className="h-12 w-full p-0 cursor-pointer"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "!flex !w-full !h-full",
                    userButtonTrigger:
                      "!flex !w-full !h-full !items-center !gap-2 !rounded-md !p-2 !text-left !text-sm !text-inherit !bg-transparent hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground active:!bg-sidebar-accent active:!text-sidebar-accent-foreground !cursor-pointer ring-sidebar-ring outline-hidden transition-colors group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!justify-center",
                    userButtonBox:
                      "!flex !w-full !h-full !items-center !gap-2 !flex-row group-data-[collapsible=icon]:!justify-center",
                    userButtonOuterIdentifier:
                      "truncate !text-sm !font-medium text-sidebar-foreground group-hover/menu-button:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden !text-left !flex-1",
                    avatarBox:
                      "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !shrink-0 !rounded-md",
                    userButtonAvatarBox:
                      "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !shrink-0 !rounded-md",
                    userButtonAvatarImage:
                      "!size-[1.5rem] !w-[1.5rem] !h-[1.5rem] !rounded-md",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
