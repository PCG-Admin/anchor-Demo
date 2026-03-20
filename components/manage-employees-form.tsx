"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { UserPlus, Loader2, Users, Trash2, Plus, Edit } from "lucide-react"
import { usernameSchema, emailSchema, passwordSchema, sanitizeInput } from "@/lib/validation-utils"
import { EnhancedFormWrapper } from "@/components/enhanced-form-wrapper"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"

const formSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["user", "admin", "sub-contractor"], {
    required_error: "Please select a role",
  }),
})

const editFormSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: z.string().optional(),
  role: z.enum(["user", "admin", "sub-contractor"], {
    required_error: "Please select a role",
  }),
})

type FormValues = z.infer<typeof formSchema>
type EditFormValues = z.infer<typeof editFormSchema>

interface Employee {
  id: string
  username: string
  email: string
  role: string
  created_at: string
}

export function ManageEmployeesForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "user",
    },
  })

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "user",
    },
  })

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("anchor_users")
        .select("id, username, email, role, created_at")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching employees:", error)
        toast({
          title: "Error",
          description: "Failed to load employees",
          variant: "destructive",
        })
        return
      }

      setEmployees(data || [])
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const startEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee)
    editForm.reset({
      username: employee.username,
      email: employee.email,
      password: "",
      role: employee.role as "user" | "admin" | "sub-contractor",
    })
    setShowAddForm(false)
  }

  const cancelEdit = () => {
    setEditingEmployee(null)
    editForm.reset()
  }

  const updateEmployee = async (values: EditFormValues) => {
    if (!editingEmployee) return

    setIsLoading(true)
    try {
      const sanitizedValues = {
        username: sanitizeInput(values.username.toLowerCase()),
        email: sanitizeInput(values.email.toLowerCase()),
        role: values.role,
      }

      const { data: existingUser } = await supabase
        .from("anchor_users")
        .select("username")
        .eq("username", sanitizedValues.username)
        .neq("id", editingEmployee.id)
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
        .neq("id", editingEmployee.id)
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

      const updateData: any = {
        username: sanitizedValues.username,
        email: sanitizedValues.email,
        role: sanitizedValues.role,
      }

      if (values.password && values.password.trim() !== "") {
        updateData.password_hash = values.password
      }

      const { error } = await supabase.from("anchor_users").update(updateData).eq("id", editingEmployee.id)

      if (error) {
        console.error("Error updating employee:", error)
        toast({
          title: "Database Error",
          description: "Failed to update employee details. Please try again or contact your administrator.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Employee Updated Successfully!",
        description: `${sanitizedValues.username}'s details have been updated.`,
      })

      setEditingEmployee(null)
      editForm.reset()
      fetchEmployees()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred while updating the employee. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteEmployee = async (employeeId: string, username: string) => {
    try {
      const { error } = await supabase.from("anchor_users").delete().eq("id", employeeId)

      if (error) {
        console.error("Error deleting employee:", error)
        toast({
          title: "Error",
          description: "Failed to delete employee",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Employee Deleted",
        description: `${username} has been removed from the system`,
      })

      fetchEmployees()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    try {
      const sanitizedValues = {
        ...values,
        username: sanitizeInput(values.username.toLowerCase()),
        email: sanitizeInput(values.email.toLowerCase()),
      }

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

      const { data, error } = await supabase.from("anchor_users").insert([
        {
          id: uuidv4(),
          username: sanitizedValues.username,
          email: sanitizedValues.email,
          password_hash: values.password,
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
      setShowAddForm(false)
      fetchEmployees()
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

  const handleEditFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await editForm.handleSubmit(updateEmployee)(e)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "sub-contractor":
        return "secondary"
      default:
        return "default"
    }
  }

  return (
    <div className="space-y-6">
      <Card className="w-full border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-red-600" />
                <span>Current Employees</span>
              </CardTitle>
              <CardDescription>Manage existing team members</CardDescription>
            </div>
            {!editingEmployee && (
              <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                {showAddForm ? "Cancel" : "Add Employee"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingEmployees ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading employees...</span>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No employees found. Add your first employee below.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.username}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(employee.role)}>
                        {employee.role === "sub-contractor" ? "Sub-Contractor" : employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(employee.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditEmployee(employee)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {employee.username}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteEmployee(employee.id, employee.username)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingEmployee && (
        <Card className="w-full max-w-2xl mx-auto border-0 shadow-xl bg-yellow-50/80 backdrop-blur-sm border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5 text-blue-600" />
              <span>Edit Employee: {editingEmployee.username}</span>
            </CardTitle>
            <CardDescription>Update employee details and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedFormWrapper
              formId="edit-employee"
              onSubmit={handleEditFormSubmit}
              maxSubmissions={3}
              rateLimitWindowMs={300000}
            >
              <Form {...editForm}>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={editForm.control}
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
                      control={editForm.control}
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
                      control={editForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Leave blank to keep current password"
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
                      control={editForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                              <SelectItem value="sub-contractor">Sub-Contractor</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex space-x-4">
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Edit className="mr-2 h-4 w-4" />
                          Update Employee
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelEdit} className="flex-1 bg-transparent">
                      Cancel
                    </Button>
                  </div>
                </div>
              </Form>
            </EnhancedFormWrapper>
          </CardContent>
        </Card>
      )}

      {showAddForm && !editingEmployee && (
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
              rateLimitWindowMs={300000}
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
                              <SelectItem value="sub-contractor">Sub-Contractor</SelectItem>
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
      )}
    </div>
  )
}
