"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { User, Lock, Loader2, Save } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username too long"),
  email: z.string().email("Invalid email address"),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type ProfileFormValues = z.infer<typeof profileSchema>
type PasswordFormValues = z.infer<typeof passwordSchema>

export function ProfileForm() {
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isLoadingPassword, setIsLoadingPassword] = useState(false)
  const authContext = useAuth()

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  })

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const user = authContext?.user
  const logout = authContext?.logout

  useEffect(() => {
    if (user) {
      profileForm.setValue("username", user.username)
      profileForm.setValue("email", user.email)
    }
  }, [user, profileForm])

  const onProfileSubmit = async (values: ProfileFormValues) => {
    if (!user) return

    setIsLoadingProfile(true)
    try {
      // Check if username is taken by another user
      if (values.username !== user.username) {
        const { data: existingUser } = await supabase
          .from("anchor_users")
          .select("username")
          .eq("username", values.username)
          .neq("id", user.id)
          .single()

        if (existingUser) {
          toast({
            title: "Username already exists",
            description: "Please choose a different username.",
            variant: "destructive",
          })
          setIsLoadingProfile(false)
          return
        }
      }

      const { error } = await supabase
        .from("anchor_users")
        .update({
          username: values.username,
          email: values.email,
        })
        .eq("id", user.id)

      if (error) {
        console.error("Error updating profile:", error)
        toast({
          title: "Error updating profile",
          description: "There was an error updating your profile. Please try again.",
          variant: "destructive",
        })
        return
      }

      // Update local user data
      const updatedUser = { ...user, username: values.username, email: values.email }
      localStorage.setItem("anchor_user", JSON.stringify(updatedUser))

      // Force a page refresh to update the auth context
      window.location.reload()

      toast({
        title: "Profile updated successfully!",
        description: "Your profile information has been updated.",
      })
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Unexpected error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    if (!user || !logout) return

    setIsLoadingPassword(true)
    try {
      // Verify current password
      const { data: currentUser } = await supabase
        .from("anchor_users")
        .select("password_hash")
        .eq("id", user.id)
        .eq("password_hash", values.currentPassword)
        .single()

      if (!currentUser) {
        toast({
          title: "Incorrect current password",
          description: "Please enter your correct current password.",
          variant: "destructive",
        })
        setIsLoadingPassword(false)
        return
      }

      // Update password
      const { error } = await supabase
        .from("anchor_users")
        .update({
          password_hash: values.newPassword,
        })
        .eq("id", user.id)

      if (error) {
        console.error("Error updating password:", error)
        toast({
          title: "Error updating password",
          description: "There was an error updating your password. Please try again.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Password updated successfully!",
        description: "Your password has been changed. Please log in again.",
      })

      passwordForm.reset()

      // Log out user to require re-login with new password
      setTimeout(() => {
        logout()
      }, 2000)
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Unexpected error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPassword(false)
    }
  }

  if (!authContext) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Error: Authentication context not found. Please refresh the page.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-white/70 backdrop-blur-sm border shadow-sm">
          <TabsTrigger
            value="profile"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <User className="h-4 w-4" />
            <span>Profile Info</span>
          </TabsTrigger>
          <TabsTrigger
            value="password"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <Lock className="h-4 w-4" />
            <span>Change Password</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-indigo-600" />
                <span>Profile Information</span>
              </CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <FormField
                    control={profileForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your username"
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
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your.email@company.com"
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
                  <Button type="submit" className="w-full" disabled={isLoadingProfile}>
                    {isLoadingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Profile...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Update Profile
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5 text-red-600" />
                <span>Change Password</span>
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your current password"
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
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your new password"
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
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirm your new password"
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
                  <Button type="submit" className="w-full" disabled={isLoadingPassword}>
                    {isLoadingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
