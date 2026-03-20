"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Clock, Calendar, Filter } from "lucide-react"
import {
  getAllUsers,
  getTimesheetEntriesForAnyUser,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  getClientIdByName,
  getClients, // Added getClients import for client filter
} from "@/lib/supabase"
import { TimeSheetEntries } from "./timesheet-entries"
import type { BillingEntry } from "@/types/billing"
import { toast } from "sonner"
import { format } from "date-fns"

interface User {
  id: string
  username: string
  email: string
  role: string
}

interface Client {
  id: string
  client_name: string
}

export function AdminAllTimesheets() {
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([]) // Added clients state
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<BillingEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [usersLoading, setUsersLoading] = useState(true)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")

  useEffect(() => {
    loadUsers()
    loadClients() // Load clients on component mount
  }, [])

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find((u) => u.id === selectedUserId)
      setSelectedUser(user || null)
      loadUserTimesheetEntries(selectedUserId)
    } else {
      setSelectedUser(null)
      setEntries([])
    }
  }, [selectedUserId, users])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const entryDate = entry.date
      const matchesDateRange = (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate)
      const matchesClient = clientFilter === "all" || entry.clientName === clientFilter

      return matchesDateRange && matchesClient
    })
  }, [entries, startDate, endDate, clientFilter])

  const loadUsers = async () => {
    try {
      setUsersLoading(true)
      const usersData = await getAllUsers()
      setUsers(usersData)
    } catch (error) {
      console.error("Error loading users:", error)
      toast.error("Failed to load users")
    } finally {
      setUsersLoading(false)
    }
  }

  const loadClients = async () => {
    try {
      const clientsData = await getClients()
      setClients(clientsData)
    } catch (error) {
      console.error("Error loading clients:", error)
      toast.error("Failed to load clients")
    }
  }

  const loadUserTimesheetEntries = async (userId: string) => {
    try {
      setLoading(true)
      const billingEntries = await getTimesheetEntriesForAnyUser(userId)
      setEntries(billingEntries)
    } catch (error) {
      console.error("Error loading timesheet entries:", error)
      toast.error("Failed to load timesheet entries")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEntry = async (id: string, values: Omit<BillingEntry, "id">) => {
    try {
      console.log("[v0] Admin updating timesheet entry:", { id, values })

      const clientId = await getClientIdByName(values.clientName)
      if (!clientId) {
        toast.error(
          `Client validation failed: "${values.clientName}" not found in database. Please contact administrator.`,
        )
        return
      }

      const dbUpdates = {
        entry_date: values.date,
        activity: values.activity,
        client: clientId,
        service: values.itemName,
        status: values.billable,
        retainer: values.retainer === "Yes",
        bill_to_client: values.billToClient,
        standard_fee: values.standardItemFee,
        rate: values.ratePerHour,
        hours: values.hours,
        total: values.total,
        comments: values.comments,
      }

      const numericId = Number.parseInt(id)
      if (isNaN(numericId)) {
        throw new Error(`Invalid entry ID: ${id}`)
      }

      await updateTimesheetEntry(numericId, dbUpdates)

      // Update the entry in the local state
      setEntries((prevEntries) =>
        prevEntries.map((entry) =>
          entry.id === id
            ? {
              ...entry,
              ...values,
            }
            : entry,
        ),
      )

      const entryDate = format(new Date(values.date), "MMMM d, yyyy")
      toast.success(
        `Timesheet entry successfully updated for ${entryDate}: ${values.hours} hours for ${values.clientName}`,
      )
    } catch (error) {
      console.error("[v0] Error updating timesheet entry:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown database error"
      toast.error(`Failed to update timesheet entry: ${errorMessage}. Please try again or contact support.`)
    }
  }

  const handleRemoveEntry = async (id: string) => {
    try {
      const numericId = Number.parseInt(id)
      if (!isNaN(numericId)) {
        await deleteTimesheetEntry(numericId)
      }

      setEntries((prevEntries) => prevEntries.filter((entry) => entry.id !== id))
      toast.success("Timesheet entry deleted successfully")
    } catch (error) {
      console.error("Error deleting timesheet entry:", error)
      toast.error("Failed to delete timesheet entry")
    }
  }

  if (usersLoading) {
    return (
      <div className="container mx-auto p-6 space-y-8 max-w-full">
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading users...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-full">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-red-800 to-pink-800 bg-clip-text text-transparent">
              All Timesheets
            </h1>
            <p className="text-slate-600 text-lg">View and manage timesheet entries for all users (Admin Only).</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-slate-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
          <Users className="h-4 w-4 text-red-600" />
          <span>Select a user from the dropdown below to view and edit their timesheet entries.</span>
        </div>
      </div>

      {/* User Selection */}
      <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-slate-900">
            <Users className="h-5 w-5" />
            <span>Select User</span>
          </CardTitle>
          <CardDescription>Choose a user to view and manage their timesheet entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center space-x-2">
                      <span>{user.username}</span>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <>
          <div className="-mx-6 px-6 pb-4 pt-2 bg-slate-50/95 space-y-4">
            {/* Selected User Info */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <CardTitle className="flex items-center space-x-2 text-base text-slate-900">
                      <Clock className="h-5 w-5" />
                      <span>Managing Timesheets for: {selectedUser.username}</span>
                    </CardTitle>
                    <div className="hidden md:flex items-center space-x-4 text-sm text-slate-600">
                      <span>Email: {selectedUser.email}</span>
                      <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"} className="h-5">
                        {selectedUser.role}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-md bg-white backdrop-blur-sm">
              <CardHeader className="py-2">
                <CardTitle className="flex items-center space-x-2 text-base text-slate-900">
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 pb-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="start-date" className="text-xs">
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="end-date" className="text-xs">
                      End Date
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="client-filter" className="text-xs">
                      Client
                    </Label>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="All clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All clients</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.client_name}>
                            {client.client_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">&nbsp;</Label>
                    <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-md border h-8 flex items-center whitespace-nowrap overflow-hidden text-ellipsis">
                      Showing {filteredEntries.length} of {entries.length} entries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timesheet Entries */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-600">Loading timesheet entries...</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Timesheet Entries</h2>
                  <p className="text-slate-600">
                    {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"} for{" "}
                    {selectedUser.username}
                    {(startDate || endDate || clientFilter !== "all") && " (filtered)"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg">
                  <TimeSheetEntries
                    entries={filteredEntries} // Use filtered entries instead of all entries
                    onAddEntry={() => { }} // Admin can't add entries for other users
                    onRemoveEntry={handleRemoveEntry}
                    onUpdateEntry={handleUpdateEntry}
                    hideAddForm={true} // Hide the add form for admin view
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
