"use client"

import type React from "react"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { v4 as uuidv4 } from "uuid"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { UserPlus, Loader2 } from "lucide-react"
import { usernameSchema, emailSchema, passwordSchema, sanitizeInput } from "@/lib/validation-utils"
import { EnhancedFormWrapper } from "@/components/enhanced-form-wrapper"

const formSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["user", "admin"], {
    required_error: "Please select a role",
  }),
})

type FormValues = z.infer<typeof formSchema>

export function AddEmployeesForm() {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "user",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    try {
      const sanitizedValues = {
        ...values,
        username: sanitizeInput(values.username.toLowerCase()),
        email: sanitizeInput(values.email.toLowerCase()),
      }

      // Check if username already exists
      const { data: existingUser } = await supabase
        .from("anchor_users")
        .select("username")
        .eq("username", sanitizedValues.username)
        .single()

      if (existingUser) {
        toast({
          title: "Username Already Exists",
          description: `The username "${sanitizedValues.username}" is already taken. Please choose a different username.`,
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      const { data: existingEmail } = await supabase
        .from("anchor_users")
        .select("email")
        .eq("email", sanitizedValues.email)
        .single()

      if (existingEmail) {
        toast({
          title: "Email Already Registered",
          description: `An account with the email "${sanitizedValues.email}" already exists. Please use a different email address.`,
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // Insert new user
      const { data, error } = await supabase.from("anchor_users").insert([
        {
          id: uuidv4(),
          username: sanitizedValues.username,
          email: sanitizedValues.email,
          password_hash: values.password, // In production, this should be properly hashed
          role: values.role,
          created_at: new Date().toISOString(),
        },
      ])

      if (error) {
        console.error("Error adding employee:", error)
        toast({
          title: "Database Error",
          description:
            "Failed to create employee account due to a database error. Please try again or contact your administrator.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Employee Added Successfully!",
        description: `${sanitizedValues.username} has been created with ${values.role} privileges and can now access the system.`,
      })

      form.reset()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred while creating the employee account. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await form.handleSubmit(onSubmit)(e)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UserPlus className="h-5 w-5 text-red-600" />
          <span>Add New Employee</span>
        </CardTitle>
        <CardDescription>Create a new user account for a team member</CardDescription>
      </CardHeader>
      <CardContent>
        <EnhancedFormWrapper
          formId="add-employee"
          onSubmit={handleFormSubmit}
          maxSubmissions={3}
          rateLimitWindowMs={300000} // 5 minutes
        >
          <Form {...form}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., john.doe"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "")
                            field.onChange(value)
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john.doe@company.com"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Minimum 6 characters with letter & number"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Employee...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Employee
                  </>
                )}
              </Button>
            </div>
          </Form>
        </EnhancedFormWrapper>
      </CardContent>
    </Card>
  )
}
