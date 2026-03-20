"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Clock, FileText, Users, BarChart3, LogOut, Shield, User, UserPlus, Trash2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const navItems = [
  { href: "/timesheet", label: "Timesheet", icon: Clock },
  { href: "/invoicing", label: "Invoicing", icon: FileText },
  { href: "/manage-clients", label: "Manage Clients", icon: Users },
  { href: "/manage-invoices", label: "Manage Invoices & Timesheets", icon: Trash2 },
]

const adminNavItems = [
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/timesheet-reports", label: "Timesheet Reports", icon: BarChart3 },
  { href: "/add-employees", label: "Manage Employees", icon: UserPlus },
  { href: "/admin/service-items", label: "Service Items", icon: Shield },
]

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <nav className={cn("flex items-center space-x-1", className)} {...props}>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-[#1e3a5f] text-white shadow-lg shadow-[#1e3a5f]/25"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:shadow-sm",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}

      {/* Admin-only navigation items */}
      {user?.role === "admin" &&
        adminNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#1e3a5f] text-white shadow-lg shadow-[#1e3a5f]/25"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}

      {user && (
        <div className="flex items-center space-x-3">
          <Link
            href="/profile"
            className={cn(
              "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              pathname === "/profile"
                ? "bg-[#1e3a5f] text-white shadow-lg shadow-[#1e3a5f]/25"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:shadow-sm",
            )}
          >
            <User className="h-4 w-4" />
            <span>{user.username}</span>
            {user.role === "admin" && (
              <Badge variant="secondary" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            )}
          </Link>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:shadow-sm transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      )}
    </nav>
  )
}
