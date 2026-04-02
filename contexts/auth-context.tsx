"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

// Import supabase directly since we have the URL now
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  username: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("invoices_user")
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch (error) {
          console.error("Error parsing saved user:", error)
          localStorage.removeItem("invoices_user")
        }
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log("🔍 Attempting login for username:", username)

      // Query using the correct field name: password_hash
      const { data, error } = await supabase
        .from("anchor_users")
        .select("id, username, email, password_hash, role")
        .eq("username", username)
        .eq("password_hash", password) // Using password_hash field
        .maybeSingle()

      console.log("📊 Supabase response:", { data, error })

      if (error) {
        console.error("❌ Supabase error:", error.code, error.message, error.details, error.hint)
        return false
      }

      if (!data) {
        console.log("❌ No user found with those credentials")
        return false
      }

      const userData: User = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
      }

      setUser(userData)

      if (typeof window !== "undefined") {
        localStorage.setItem("invoices_user", JSON.stringify(userData))
      }

      console.log("✅ Login successful for user:", userData)
      return true
    } catch (error) {
      console.error("💥 Login error:", error)
      return false
    }
  }

  const logout = () => {
    setUser(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("invoices_user")
    }
  }

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
