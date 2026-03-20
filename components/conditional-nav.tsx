"use client"

import { usePathname } from "next/navigation"
import { MainNav } from "@/components/main-nav"
import Image from "next/image"

export function ConditionalNav() {
  const pathname = usePathname()

  if (pathname === "/login") {
    return null
  }

  return (
    <div className="sticky top-0 z-50 border-b bg-white backdrop-blur-md shadow-sm">
      <div className="flex h-20 items-center px-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Image
              src="/images/mindrift-logo.jpg"
              alt="MindRift Logo"
              width={100}
              height={100}
              className="object-contain"
            />
          </div>
        </div>
        <MainNav className="ml-8" />
      </div>
    </div>
  )
}
