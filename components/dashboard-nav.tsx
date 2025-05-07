import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { LogOut, User, Settings } from "lucide-react"

export function DashboardNav() {
    const { user, signOut } = useAuth()

    // Get user's first initial for avatar fallback
    const getUserInitial = () => {
        if (user?.full_name) {
            return user.full_name.charAt(0).toUpperCase()
        }
        if (user?.email) {
            return user.email.charAt(0).toUpperCase()
        }
        return "U"
    }

    // Image URL with cache busting
    const getAvatarUrl = () => {
        const baseUrl = user?.profile_picture_url || user?.avatar_url
        if (!baseUrl) return null

        // Add cache busting query parameter
        return `${baseUrl}?t=${Date.now()}`
    }

    return (
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
            <div className="flex-1">
                <h1 className="font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={getAvatarUrl() || ""} alt={user?.full_name || "User"} />
                                <AvatarFallback>{getUserInitial()}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user?.full_name || "User"}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/profile">
                                <User className="mr-2 h-4 w-4" />
                                <span>Profile</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={signOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
} 