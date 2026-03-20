"use client"

import { useState, useMemo, useEffect } from "react"
import { format, parseISO } from "date-fns"
import { Calendar, Download, Filter, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PaginationControls } from "@/components/pagination-controls"
import type { BillingEntry } from "../types/billing"
import { useAuth } from "../contexts/auth-context"
import { toast } from "sonner"
import { sendTimesheetToWebhook, type WebhookTimesheetData } from "../lib/webhook"
import { generateTimesheetPDF } from "../lib/pdf-generator"
import { saveDailyTimesheet } from "../lib/supabase"

const ITEMS_PER_PAGE = 20

interface DailyTimesheetsProps {
  entries: BillingEntry[]
}

export function DailyTimesheets({ entries }: DailyTimesheetsProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const { user } = useAuth()

  // Get unique clients for filter dropdown
  const uniqueClients = useMemo(() => {
    const clients = [...new Set(entries.map((entry) => entry.clientName))]
    return clients.sort()
  }, [entries])

  // Filter entries based on selected date and filters
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const entryDate = format(parseISO(entry.date), "yyyy-MM-dd")
      const matchesDate = entryDate === selectedDate
      const matchesClient = clientFilter === "all" || entry.clientName === clientFilter
      const matchesStatus = statusFilter === "all" || entry.billable === statusFilter

      return matchesDate && matchesClient && matchesStatus
    })
  }, [entries, selectedDate, clientFilter, statusFilter])

  // Reset page when filters key changes
  useEffect(() => {
    setPage(1)
  }, [selectedDate, clientFilter, statusFilter])

  const paginatedEntries = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    return filteredEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredEntries, page])

  const currentDayEntries = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd")
    return entries.filter((entry) => {
      const entryDate = format(parseISO(entry.date), "yyyy-MM-dd")
      return entryDate === today
    })
  }, [entries])

  // Calculate total hours for the selected date
  const totalHours = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + entry.hours, 0)
  }, [filteredEntries])

  const generatePDF = async () => {
    if (!user) {
      toast.error("User information not available")
      return
    }

    if (filteredEntries.length === 0) {
      toast.error("No entries found for the selected date")
      return
    }

    try {
      const timesheetNumber = `T-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`

      const timesheetData = {
        timesheetNumber,
        loggedInUserName: user.username || "Unknown User",
        timesheetDate: selectedDate,
        totalHours,
        entries: filteredEntries.map((entry) => ({
          clientName: entry.clientName,
          activity: entry.activity,
          itemName: entry.itemName,
          hours: entry.hours,
          billToClient: entry.billToClient,
          billable: entry.billable,
          comments: entry.comments,
        })),
      }

      const pdfDocument = generateTimesheetPDF(timesheetData)

      try {
        await saveDailyTimesheet({
          created_date: selectedDate,
          user_id: user.id,
          total_hours: totalHours,
          timesheet_number: timesheetNumber,
        })

        try {
          const webhookData: WebhookTimesheetData = {
            timesheetDate: selectedDate, // Changed from 'date' to 'timesheetDate' to match interface
            totalHours,
            timesheetNumber,
            userName: user.username || "Unknown User",
            documentType: "Timesheet",
            pdfDocument,
          }

          await sendTimesheetToWebhook(webhookData)

          toast.success("Daily timesheet saved to database and sent to webhook successfully")
        } catch (webhookError) {
          console.error("Webhook error:", webhookError)
          toast.error("Timesheet saved to database but failed to send webhook notification")
        }
      } catch (dbError) {
        console.error("Error saving to database:", dbError)
        toast.error("Failed to save timesheet to database, but PDF will still download")
      }

      // Save the PDF locally
      const fileName = `timesheet-${user.username}-${selectedDate}.pdf`
      const blob = new Blob([pdfDocument.data], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      if (!filteredEntries.length) {
        toast.success("PDF generated and downloaded successfully")
      }
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Failed to generate PDF")
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Daily Timesheets</h2>
            <p className="text-slate-600">View and export your timesheet entries by date</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </CardTitle>
            <CardDescription>Filter your timesheet entries by date, client, and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-select">Date</Label>
                <Input
                  id="date-select"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-filter">Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {uniqueClients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Billable">Billable</SelectItem>
                    <SelectItem value="Work in Progress">Work in Progress</SelectItem>
                    <SelectItem value="Not Billable">Non-Billable</SelectItem>
                    <SelectItem value="Recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  onClick={generatePDF}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  disabled={filteredEntries.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generate PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Hours</p>
                  <p className="text-2xl font-bold text-slate-900">{totalHours.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Entries</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredEntries.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Selected Date</p>
                  <p className="text-lg font-bold text-slate-900">{format(parseISO(selectedDate), "MMM d, yyyy")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle>Timesheet Entries</CardTitle>
            <CardDescription>
              {filteredEntries.length > 0
                ? `Showing ${filteredEntries.length} entries for ${format(parseISO(selectedDate), "MMMM d, yyyy")}`
                : `No timesheet entries found for ${format(parseISO(selectedDate), "MMMM d, yyyy")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEntries.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-4">
                  <PaginationControls
                    currentPage={page}
                    totalPages={Math.ceil(filteredEntries.length / ITEMS_PER_PAGE)}
                    onPageChange={setPage}
                    itemName="entries"
                  />
                </div>
                {paginatedEntries.map((entry) => {
                  const statusStyles =
                    entry.billable === "Billable"
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                      : entry.billable === "Work in Progress"
                        ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-white"
                        : entry.billable === "Recurring"
                          ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white"
                          : "bg-gradient-to-r from-orange-400 to-red-400 text-white"
                  const statusLabel = entry.billable === "Not Billable" ? "Non-Billable" : entry.billable

                  return (
                    <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge className={statusStyles}>{statusLabel}</Badge>
                          <span className="font-medium">{entry.clientName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold">{entry.hours}h</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-600">
                        <div>
                          <strong>Activity:</strong> {entry.activity}
                        </div>
                        <div>
                          <strong>Service:</strong> {entry.itemName}
                        </div>
                        <div>
                          <strong>Hours:</strong> {entry.hours}
                        </div>
                        <div>
                          <strong>Bill To Client:</strong> {entry.billToClient}
                        </div>
                        <div>
                          <strong>Rate:</strong> R{entry.ratePerHour}/hr
                        </div>
                        <div>
                          <strong>Total:</strong> R{entry.total.toFixed(2)}
                        </div>
                      </div>
                      {entry.comments && (
                        <div className="text-sm text-slate-600">
                          <strong>Comments:</strong> {entry.comments}
                        </div>
                      )}
                    </div>
                  )
                })}

              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No timesheet entries found for the selected date and filters.</p>
                <p className="text-sm">Try selecting a different date or adjusting your filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
