"use client"

import { useState, useEffect, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import { TimeSheetEntries } from "./components/timesheet-entries"
import { DailyTimesheets } from "./components/daily-timesheets"
import { AdminAllTimesheets } from "./components/admin-all-timesheets"
import type { BillingEntry } from "./types/billing"
import { Clock, Plus, Calendar, Users } from "lucide-react"
import { useAuth } from "./contexts/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  saveTimesheetEntry,
  getTimesheetEntriesForUser,
  deleteTimesheetEntry,
  updateTimesheetEntry,
  getClientIdByName,
  type TimesheetEntryRaw,
} from "./lib/supabase"
import { toast } from "sonner"
import { format } from "date-fns"

export default function TimeSheet() {
  const [entries, setEntries] = useState<BillingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const currentDayEntries = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd")
    return entries.filter((entry) => {
      const entryDate = entry.date
      return entryDate === today
    })
  }, [entries])

  useEffect(() => {
    if (user?.id) {
      loadTimesheetEntries()
    }
  }, [user?.id])

  const loadTimesheetEntries = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const billingEntries = await getTimesheetEntriesForUser(user.id)
      setEntries(billingEntries)
    } catch (error) {
      console.error("Error loading timesheet entries:", error)
      toast.error("Failed to load timesheet entries")
    } finally {
      setLoading(false)
    }
  }

  const handleAddEntry = async (values: Omit<BillingEntry, "id">) => {
    if (!user?.id) {
      toast.error("Authentication required: You must be logged in to add timesheet entries")
      return
    }

    try {
      const clientId = await getClientIdByName(values.clientName)
      if (!clientId) {
        toast.error(
          `Client validation failed: "${values.clientName}" not found in database. Please contact administrator.`,
        )
        return
      }

      const dbEntry: Omit<TimesheetEntryRaw, "id"> = {
        entry_date: values.date,
        activity: values.activity,
        client: clientId,
        service: values.itemName,
        status: values.billable,
        retainer: false,
        bill_to_client: values.billToClient,
        standard_fee: values.standardItemFee,
        rate: values.ratePerHour,
        hours: values.hours,
        total: values.total,
        comments: values.comments,
        user: user.id,
      }

      const savedEntry = await saveTimesheetEntry(dbEntry)

      const newEntry: BillingEntry = {
        id: savedEntry.id?.toString() || uuidv4(),
        loginName: user.email || "Unknown User",
        ...values,
      }

      setEntries([newEntry, ...entries])
      const entryDate = format(new Date(values.date), "MMMM d, yyyy")
      toast.success(
        `Timesheet entry successfully added for ${entryDate}: ${values.hours} hours for ${values.clientName}`,
      )
    } catch (error) {
      console.error("Error saving timesheet entry:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown database error"
      toast.error(`Failed to save timesheet entry: ${errorMessage}. Please try again or contact support.`)
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

  const handleUpdateEntry = async (id: string, values: Omit<BillingEntry, "id">) => {
    if (!user?.id) {
      toast.error("Authentication required: You must be logged in to update timesheet entries")
      return
    }

    try {
      console.log("[v0] Starting timesheet entry update:", { id, values }) // Added debug logging

      const clientId = await getClientIdByName(values.clientName)
      if (!clientId) {
        toast.error(
          `Client validation failed: "${values.clientName}" not found in database. Please contact administrator.`,
        )
        return
      }

      console.log("[v0] Found client ID:", clientId) // Added debug logging

      const dbUpdates: Partial<TimesheetEntryRaw> = {
        entry_date: values.date,
        activity: values.activity,
        client: clientId,
        service: values.itemName,
        status: values.billable,
        retainer: false,
        bill_to_client: values.billToClient,
        standard_fee: values.standardItemFee,
        rate: values.ratePerHour,
        hours: values.hours,
        total: values.total,
        comments: values.comments,
      }

      console.log("[v0] Updating database with:", dbUpdates) // Added debug logging

      const numericId = Number.parseInt(id)
      if (isNaN(numericId)) {
        throw new Error(`Invalid entry ID: ${id}`)
      }

      await updateTimesheetEntry(numericId, dbUpdates)
      console.log("[v0] Database update successful") // Added debug logging

      // Update the entry in the local state
      setEntries((prevEntries) =>
        prevEntries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...values,
                loginName: user.email || "Unknown User",
              }
            : entry,
        ),
      )

      const entryDate = format(new Date(values.date), "MMMM d, yyyy")
      toast.success(
        `Timesheet entry successfully updated for ${entryDate}: ${values.hours} hours for ${values.clientName}`,
      )
    } catch (error) {
      console.error("[v0] Error updating timesheet entry:", error) // Added debug prefix
      const errorMessage = error instanceof Error ? error.message : "Unknown database error"
      toast.error(`Failed to update timesheet entry: ${errorMessage}. Please try again or contact support.`)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-8 max-w-full">
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading timesheet entries...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-full">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
              Timesheet
            </h1>
            <p className="text-slate-600 text-lg">
              Record your time worked for clients or internal activities directly in the table below.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-slate-600 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
          <Plus className="h-4 w-4 text-blue-600" />
          <span>Use the form row at the top of the table to add new time entries quickly and efficiently.</span>
        </div>
      </div>

      <Tabs defaultValue="entries" className="space-y-6">
        <TabsList className="bg-white/70 backdrop-blur-sm border shadow-sm">
          <TabsTrigger
            value="entries"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Entries</span>
          </TabsTrigger>
          <TabsTrigger
            value="daily"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <Calendar className="h-4 w-4" />
            <span>Daily Timesheets</span>
          </TabsTrigger>
          {user?.role === "admin" && (
            <TabsTrigger
              value="all-timesheets"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-500 data-[state=active]:text-white flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>All Timesheets</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <TimeSheetEntries
            entries={currentDayEntries}
            onAddEntry={handleAddEntry}
            onRemoveEntry={handleRemoveEntry}
            onUpdateEntry={handleUpdateEntry}
          />
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <DailyTimesheets entries={entries} />
        </TabsContent>

        {user?.role === "admin" && (
          <TabsContent value="all-timesheets" className="space-y-4">
            <AdminAllTimesheets />
          </TabsContent>
        )}
      </Tabs>

      {currentDayEntries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Today's Timesheet:</h2>
              <p className="text-slate-600">
                {currentDayEntries.length} {currentDayEntries.length === 1 ? "entry" : "entries"} for{" "}
                {format(new Date(), "MMMM d, yyyy")}
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-green-200 rounded-lg p-4 space-y-3">
            {currentDayEntries.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Badge className={entry.activity === "External" ? "bg-blue-500" : "bg-slate-500"}>
                      {entry.activity}
                    </Badge>
                    <Badge
                      className={
                        entry.billable === "Billable"
                          ? "bg-green-500"
                          : entry.billable === "Work in Progress"
                            ? "bg-yellow-500"
                            : "bg-orange-500"
                      }
                    >
                      {entry.billable}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{entry.clientName}</p>
                    <p className="text-sm text-slate-600">{entry.itemName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-slate-900">{entry.hours}h</p>
                  <p className="text-sm text-slate-600">R {entry.total.toLocaleString()}</p>
                </div>
              </div>
            ))}
            <div className="border-t border-green-200 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-700">Today's Total:</span>
                <div className="text-right">
                  <span className="font-bold text-xl text-green-600">
                    {currentDayEntries.reduce((sum, entry) => sum + entry.hours, 0)}h
                  </span>
                  <span className="text-slate-600 ml-2">
                    (R {currentDayEntries.reduce((sum, entry) => sum + entry.total, 0).toLocaleString()})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
