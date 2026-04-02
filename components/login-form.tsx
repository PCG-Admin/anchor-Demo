"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

type FormValues = z.infer<typeof formSchema>

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    try {
      const success = await login(values.username, values.password)

      if (success) {
        toast({
          title: "Login successful",
          description: "Welcome to the dashboard!",
        })
        router.push("/timesheet")
      } else {
        toast({
          title: "Login failed",
          description: "Invalid username or password. Please check your credentials.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Login error:", error)
      toast({
        title: "Connection error",
        description: "Unable to connect to the database. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <Card className="w-full max-w-md bg-white shadow-lg rounded-lg border border-gray-200">
        <CardHeader className="text-center pt-8 pb-6">
          <div className="flex justify-center mb-6">
            <a
              href="https://www.pc-group.net/mindrift"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              <img
                src="/images/mindrift-logo-new.png"
                alt="MindRift Logo"
                className="h-40 w-auto hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Login</h1>
          <div className="mb-2">
            <span className="bg-[#1e3a5f] text-white text-xs font-semibold px-3 py-1 rounded-full tracking-wide">
              INVOICES DEMO
            </span>
          </div>
          {process.env.NEXT_PUBLIC_ENVIRONMENT !== "production" && (
            <div className="mb-2">
              <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded border border-amber-200">
                Dev Environment
              </span>
            </div>
          )}
          <p className="text-gray-600 text-sm">Enter your credentials to access the dashboard.</p>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your username"
                        className="h-11 bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-600" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="h-11 bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md pr-10"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-gray-50"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-600" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 bg-[#1e3a5f] hover:bg-[#152d47] text-white font-medium rounded-md mt-6"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Login"}
              </Button>
              <div className="text-center mt-4">
                <p className="text-sm text-gray-500 italic font-medium">"COURAGE TO TRANSFORM. POWER TO EVOLVE"</p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
