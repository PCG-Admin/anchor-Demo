"use client"

import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon, Filter, Download, PencilLine } from "lucide-react"
import { PaginationControls } from "@/components/pagination-controls"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import {
  advanceRecurringServicesNextDate,
  getServiceItems,
  markTimesheetEntriesAsBillableExported,
} from "@/lib/supabase"
import type { BillingEntry } from "../types/billing"
import { toast } from "@/components/ui/use-toast"
import { BillingEntryEditDialog } from "@/components/billing-entry-edit-dialog"

interface PendingApprovalEntriesProps {
  entries: BillingEntry[]
  loading?: boolean
  onUpdateEntry?: (entryId: string, entry: BillingEntry) => Promise<void>
  onEntriesExported?: (entryIds: string[]) => Promise<void> | void
}

const formatEntryDate = (value: string) => {
  if (!value) return "N/A"
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return value
  return format(parsed, "dd MMM yyyy")
}

const formatActivityLabel = (activity?: string | null) => {
  if (!activity) return "-"
  const normalised = activity.trim()
  if (!normalised) return "-"
  return normalised
}

const ITEMS_PER_PAGE = 20


interface ClientEntryCardProps {
  clientName: string
  clientEntries: BillingEntry[]
  onEdit: (entry: BillingEntry) => void
  stickyHeadClass: string
}

function ClientEntryCard({ clientName, clientEntries, onEdit, stickyHeadClass }: ClientEntryCardProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(clientEntries.length / ITEMS_PER_PAGE)

  const clientTotal = clientEntries.reduce((sum, entry) => sum + (entry.total || 0), 0)
  const clientHours = clientEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0)

  const displayedEntries = clientEntries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  // Reset page if entries change drastically (optional, but good practice if filtering changes entry list size significantly)
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1)
    }
  }, [totalPages, page])

  return (
    <Card className="border border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{clientName}</CardTitle>
          <Badge variant="secondary">
            {clientEntries.length} entries | {clientHours.toFixed(2)} hours | R{" "}
            {clientTotal.toLocaleString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="mb-4 px-4 pt-4">
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            itemName="entries"
          />
        </div>
        <div className="relative max-h-[600px] overflow-y-auto overflow-x-hidden min-w-0">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-white shadow-sm text-sm font-semibold text-slate-600">
                <th className={cn("px-3 py-2 align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}>
                  Date
                </th>
                <th className={cn("px-3 py-2 align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}>
                  Client
                </th>
                <th className={cn("px-3 py-2 align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}>
                  Activity
                </th>
                <th className={cn("px-3 py-2 align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}>
                  Service Item
                </th>
                <th className={cn("px-3 py-2 align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}>
                  Bill To
                </th>
                <th
                  className={cn("px-3 py-2 text-right align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}
                >
                  Hours
                </th>
                <th
                  className={cn("px-3 py-2 text-right align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}
                >
                  Rate
                </th>
                <th
                  className={cn("px-3 py-2 text-right align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}
                >
                  Total
                </th>
                <th className={cn("px-3 py-2 align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}>
                  Status
                </th>
                <th className={cn("px-3 py-2 align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}>
                  Comments
                </th>
                <th
                  className={cn("px-3 py-2 text-right align-top whitespace-normal break-words border-b border-slate-200", stickyHeadClass)}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 text-slate-700 border-b border-slate-100">
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    {formatEntryDate(entry.date)}
                  </td>
                  <td className="align-top px-3 py-2 font-medium text-slate-900 whitespace-normal break-words">
                    {entry.clientName}
                  </td>
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-2 py-0.5 text-xs font-semibold capitalize",
                        entry.activity === "External"
                          ? "border-blue-200 text-blue-600"
                          : entry.activity === "Internal"
                            ? "border-slate-200 text-slate-600"
                            : entry.activity === "Sub-Contractor"
                              ? "border-purple-200 text-purple-600"
                              : "border-amber-200 text-amber-600",
                      )}
                    >
                      {formatActivityLabel(entry.activity)}
                    </Badge>
                  </td>
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    {entry.itemName}
                  </td>
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    {entry.billToClient || "-"}
                  </td>
                  <td className="align-top px-3 py-2 text-right whitespace-normal break-words">
                    {entry.hours.toFixed(2)}
                  </td>
                  <td className="align-top px-3 py-2 text-right whitespace-normal break-words">
                    R {entry.ratePerHour.toLocaleString()}
                  </td>
                  <td className="align-top px-3 py-2 text-right font-semibold whitespace-normal break-words">
                    R {entry.total.toLocaleString()}
                  </td>
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    <Badge
                      className={
                        entry.billable === "Billable"
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                          : entry.billable === "Work in Progress"
                            ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-white"
                            : entry.billable === "Recurring"
                              ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white"
                              : "bg-gradient-to-r from-orange-400 to-red-400 text-white"
                      }
                    >
                      {entry.billable === "Not Billable" ? "Non-Billable" : entry.billable}
                    </Badge>
                  </td>
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    <span className="block whitespace-normal break-words">{entry.comments || "-"}</span>
                  </td>
                  <td className="align-top px-3 py-2 text-right whitespace-normal break-words">
                    {entry.source === "recurring" ? (
                      <span className="text-xs font-medium text-slate-500">Manage via recurring services</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(entry)}
                        className="h-8 px-3 text-blue-600 hover:text-blue-700"
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function PendingApprovalEntries({
  entries,
  loading = false,
  onUpdateEntry,
  onEntriesExported,
}: PendingApprovalEntriesProps) {
  const [entryList, setEntryList] = useState<BillingEntry[]>(entries)
  const [serviceItemCodeMap, setServiceItemCodeMap] = useState<Record<string, string>>({})
  const [clientFilter, setClientFilter] = useState<string>("All clients")
  const [serviceFilter, setServiceFilter] = useState<string>("All services")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [editingEntry, setEditingEntry] = useState<BillingEntry | null>(null)


  const [savingEdit, setSavingEdit] = useState(false)
  const [exporting, setExporting] = useState(false)


  useEffect(() => {
    setEntryList(entries)
  }, [entries])

  useEffect(() => {
    let isMounted = true

    const loadServiceCodes = async () => {
      try {
        const items = await getServiceItems()
        if (!isMounted) return

        const map = items.reduce<Record<string, string>>((acc, item) => {
          const key = typeof item.name === "string" ? item.name.trim().toLowerCase() : ""
          if (key && typeof item.code === "string") {
            acc[key] = item.code
          }
          return acc
        }, {})

        setServiceItemCodeMap(map)
      } catch (error) {
        console.error("Failed to load service item codes", error)
      }
    }

    loadServiceCodes()

    return () => {
      isMounted = false
    }
  }, [])

  const resolveServiceCode = (entry: BillingEntry) => {
    const directCode = typeof entry.xeroItemCode === "string" ? entry.xeroItemCode.trim() : ""
    if (directCode) {
      return directCode
    }

    const key = (entry.itemName ?? "").trim().toLowerCase()
    if (!key) {
      return ""
    }

    return serviceItemCodeMap[key] ?? ""
  }

  const uniqueClients = useMemo(() => {
    const clients = [...new Set(entryList.map((entry) => entry.clientName).filter(Boolean))]
    return clients.sort((a, b) => a.localeCompare(b))
  }, [entryList])

  const uniqueServices = useMemo(() => {
    const services = [...new Set(entryList.map((entry) => entry.itemName).filter(Boolean))]
    return services.sort((a, b) => a.localeCompare(b))
  }, [entryList])

  const uniqueBillToClients = useMemo(() => {
    const billTo = [...new Set(entryList.map((entry) => entry.billToClient).filter(Boolean))]
    return billTo.sort((a, b) => a.localeCompare(b))
  }, [entryList])

  const filteredEntries = useMemo(() => {
    return entryList.filter((entry) => {
      if (clientFilter !== "All clients" && entry.clientName !== clientFilter) return false
      if (serviceFilter !== "All services" && entry.itemName !== serviceFilter) return false

      if (dateFrom || dateTo) {
        const entryDate = parseISO(entry.date)
        if (!Number.isNaN(entryDate.getTime())) {
          if (dateFrom && entryDate < dateFrom) return false
          if (dateTo && entryDate > dateTo) return false
        }
      }

      if (searchTerm.trim()) {
        const normalised = searchTerm.trim().toLowerCase()
        const matches =
          entry.clientName.toLowerCase().includes(normalised) ||
          entry.itemName.toLowerCase().includes(normalised) ||
          (entry.comments || "").toLowerCase().includes(normalised)
        if (!matches) return false
      }

      return true
    })
  }, [entryList, clientFilter, serviceFilter, dateFrom, dateTo, searchTerm])

  // Group entries by bill-to client
  const entriesByClient = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      const groupKey = entry.billToClient || entry.clientName
      if (!acc[groupKey]) {
        acc[groupKey] = []
      }
      acc[groupKey].push(entry)
      return acc
    }, {} as Record<string, typeof filteredEntries>)
  }, [filteredEntries])

  const [clientPage, setClientPage] = useState(1)
  const CLIENTS_PER_PAGE = 5

  const clientEntriesList = useMemo(() => Object.entries(entriesByClient), [entriesByClient])
  const totalClientPages = Math.ceil(clientEntriesList.length / CLIENTS_PER_PAGE)

  const paginatedClients = useMemo(() => {
    const startIndex = (clientPage - 1) * CLIENTS_PER_PAGE
    return clientEntriesList.slice(startIndex, startIndex + CLIENTS_PER_PAGE)
  }, [clientEntriesList, clientPage])

  // Reset page when filters change
  useEffect(() => {
    setClientPage(1)
  }, [filteredEntries])

  const totalHours = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0),
    [filteredEntries],
  )

  const totalAmount = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + (entry.total || 0), 0),
    [filteredEntries],
  )

  const handleOpenEdit = (entry: BillingEntry) => {
    setEditingEntry(entry)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !savingEdit) {
      setEditingEntry(null)
    }
  }

  const handleSaveEdit = async (updatedEntry: BillingEntry) => {
    setSavingEdit(true)
    try {
      if (onUpdateEntry) {
        await onUpdateEntry(updatedEntry.id, updatedEntry)
      }

      setEntryList((prev) => prev.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)))
      setEditingEntry(updatedEntry)
      toast({
        title: "Entry updated",
        description: "The timesheet entry has been refreshed with your changes.",
      })
    } catch (error) {
      console.error("Failed to update pending approval entry", error)
      toast({
        title: "Unable to update entry",
        description: "Please try again, or refresh before updating again.",
        variant: "destructive",
      })
      throw error
    } finally {
      setSavingEdit(false)
    }
  }

  const resetFilters = () => {
    setClientFilter("All clients")
    setServiceFilter("All services")
    setDateFrom(undefined)
    setDateTo(undefined)
    setSearchTerm("")
  }

  const handleExport = async () => {
    if (!filteredEntries.length) {
      toast({
        title: "No entries to export",
        description: "Adjust your filters to include at least one billable entry before exporting.",
      })
      return
    }

    const confirmExport = window.confirm(
      "Exporting will remove the selected entries from Pending Approval. Do you want to continue?",
    )

    if (!confirmExport) {
      return
    }

    const defaultBillingDate = format(new Date(), "yyyy-MM-dd")
    const billingDateInput = window.prompt(
      "Enter the billing date (YYYY-MM-DD) to include in the export:",
      defaultBillingDate,
    )

    if (!billingDateInput) {
      toast({
        title: "Billing date required",
        description: "Provide a billing date before exporting the CSV.",
        variant: "destructive",
      })
      return
    }

    const trimmedBillingDate = billingDateInput.trim()
    const parsedBillingDate = parseISO(trimmedBillingDate)

    if (Number.isNaN(parsedBillingDate.getTime())) {
      toast({
        title: "Invalid billing date",
        description: "Please enter a valid ISO date (YYYY-MM-DD) before exporting.",
        variant: "destructive",
      })
      return
    }

    const billingDate = format(parsedBillingDate, "yyyy-MM-dd")

    setExporting(true)

    try {
      const escapeCsv = (value: string | number) => {
        const stringValue = value?.toString() ?? ""
        const sanitised = stringValue.replace(/\r?\n|\r/g, " ")
        return `"${sanitised.replace(/"/g, '""')}"`
      }

      // Group entries for export consolidation
      const consolidatedEntries = Object.values(
        filteredEntries.reduce(
          (acc, entry) => {
            // ONLY consolidate if the service is "Monthly Bookkeeping"
            const shouldConsolidate = entry.itemName === "Monthly Bookkeeping"

            let key: string

            if (shouldConsolidate) {
              // Create a unique key for grouping consolidated items
              // undefined/null values are treated as empty strings for consistent grouping
              key = [
                "CONSOLIDATED", // Prefix to avoid collision with IDs
                entry.clientName,
                entry.billToClient || "",
                entry.itemName,
                entry.activity || "",
                entry.xeroItemCode || resolveServiceCode(entry) || "",
                entry.ratePerHour,
              ].join("|")
            } else {
              // Use the unique entry ID for all other items to prevent grouping
              key = entry.id
            }

            if (!acc[key]) {
              acc[key] = {
                ...entry,
                // If consolidating, use the user-provided billing date.
                // If NOT consolidating, preserve the original entry date.
                date: shouldConsolidate ? billingDate : entry.date,
                hours: 0,
                total: 0,
                // Default comment to Service Item name for consolidated, else keep original
                comments: shouldConsolidate ? entry.itemName : (entry.comments || ""),
              }
            }

            // Sum up the values
            acc[key].hours += entry.hours || 0
            acc[key].total += entry.total || 0

            return acc
          },
          {} as Record<string, BillingEntry>,
        ),
      )

      const rows = [
        [
          "Date",
          "Billing Date",
          "Client",
          "Activity",
          "Service Item",
          "Service Code",
          "Bill To",
          "Hours",
          "Rate",
          "Total",
          "Comments",
        ].join(","),
        ...consolidatedEntries.map((entry) =>
          [
            escapeCsv(entry.date), // This is now the Billing Date
            escapeCsv(billingDate),
            escapeCsv(entry.clientName),
            escapeCsv(entry.activity),
            escapeCsv(
              (entry.itemName || "").toLowerCase().includes("tax return")
                ? `${entry.itemName} - ${entry.clientName}`
                : entry.itemName,
            ),
            escapeCsv(resolveServiceCode(entry)), // Helper already handles lookup
            escapeCsv(entry.billToClient || ""),
            escapeCsv(entry.hours), // Summed hours
            escapeCsv(entry.ratePerHour > 0 ? entry.ratePerHour : entry.standardItemFee || 0),
            escapeCsv(entry.total), // Summed total
            escapeCsv(entry.comments || ""),
          ].join(","),
        ),
      ]

      const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `pending-approval-entries-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 500)

      const exportedEntryIds = filteredEntries.map((entry) => entry.id)
      const timesheetEntryIds = filteredEntries
        .filter((entry) => entry.source !== "recurring")
        .map((entry) => entry.id)
        .filter((id) => /^\d+$/.test(id))
      const recurringServiceIds = Array.from(
        new Set(
          filteredEntries
            .filter((entry) => entry.source === "recurring")
            .map((entry) => entry.id.replace("recurring-", ""))
            .filter((id) => id.length > 0),
        ),
      )

      if (timesheetEntryIds.length > 0) {
        try {
          await markTimesheetEntriesAsBillableExported(timesheetEntryIds)
        } catch (statusError) {
          console.error("Failed to update entries after export", statusError)
          toast({
            title: "Export update failed",
            description: "Entries were downloaded but their status could not be updated. Please try again.",
            variant: "destructive",
          })
          return
        }
      }

      if (recurringServiceIds.length > 0) {
        try {
          await advanceRecurringServicesNextDate(recurringServiceIds)
        } catch (recurringError) {
          console.error("Failed to advance recurring services after export", recurringError)
          toast({
            title: "Recurring services not updated",
            description: "Entries were downloaded but the next billing date was not updated. Please try again.",
            variant: "destructive",
          })
          return
        }
      }

      if (timesheetEntryIds.length > 0) {
        const timesheetIdSet = new Set(timesheetEntryIds)
        setEntryList((prev) => prev.filter((entry) => !(entry.source !== "recurring" && timesheetIdSet.has(entry.id))))
      }

      if (onEntriesExported) {
        await onEntriesExported(exportedEntryIds)
      }

      toast({
        title: "Export complete",
        description: "Selected entries were exported and removed from Pending Approval.",
      })
    } catch (error) {
      console.error("Failed to export pending approval entries", error)
      toast({
        title: "Export failed",
        description: "We could not complete the export. Please try again.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const stickyHeadClass = "sticky top-0 z-20 bg-white"

  return (
    <>
      <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
        <div className="h-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-lg"></div>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-slate-900">
            <span>Pending Approval Entries</span>
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="px-2 py-1 text-xs font-medium text-orange-600 border-orange-200">
                {filteredEntries.length} entries
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={loading || filteredEntries.length === 0 || exporting}
                className="space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Showing {filteredEntries.length} of {entryList.length} billable entries awaiting approval. Refine the list
            below before generating invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Client</label>
              <Select value={clientFilter} onValueChange={setClientFilter} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All clients">All clients</SelectItem>
                  {uniqueClients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Service Item</label>
              <Select value={serviceFilter} onValueChange={setServiceFilter} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All services">All services</SelectItem>
                  {uniqueServices.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground",
                      loading && "opacity-70",
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground",
                      loading && "opacity-70",
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Search</label>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search client, service, comments"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  disabled={loading}
                />
                <Button variant="outline" size="icon" onClick={resetFilters} className="shrink-0" title="Reset filters" disabled={loading}>
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border border-emerald-100 bg-emerald-50">
              <CardContent className="py-4">
                <p className="text-sm font-medium text-emerald-700">Total Hours</p>
                <p className="text-2xl font-bold text-emerald-900">{totalHours.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="border border-blue-100 bg-blue-50">
              <CardContent className="py-4">
                <p className="text-sm font-medium text-blue-700">Total Amount</p>
                <p className="text-2xl font-bold text-blue-900">R {totalAmount.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border border-purple-100 bg-purple-50">
              <CardContent className="py-4">
                <p className="text-sm font-medium text-purple-700">Average Rate</p>
                <p className="text-2xl font-bold text-purple-900">
                  R {totalHours > 0 ? Math.round((totalAmount / totalHours) * 100) / 100 : 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {Object.keys(entriesByClient).length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                {loading ? "Loading billable entries..." : "No billable entries match the selected filters."}
              </div>
            ) : (
              <>
                <div className="flex justify-end mb-4">
                  <PaginationControls
                    currentPage={clientPage}
                    totalPages={totalClientPages}
                    onPageChange={setClientPage}
                    itemName="clients"
                  />
                </div>
                {paginatedClients.map(([clientName, clientEntries]) => (
                  <ClientEntryCard
                    key={clientName}
                    clientName={clientName}
                    clientEntries={clientEntries}
                    onEdit={handleOpenEdit}
                    stickyHeadClass={stickyHeadClass}
                  />
                ))}
                <div className="flex justify-end mt-4">
                  <PaginationControls
                    currentPage={clientPage}
                    totalPages={totalClientPages}
                    onPageChange={setClientPage}
                    itemName="clients"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <BillingEntryEditDialog
        entry={editingEntry}
        open={Boolean(editingEntry)}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSaveEdit}
        clientOptions={uniqueClients}
        serviceOptions={uniqueServices}
        billToOptions={uniqueBillToClients}
        isSubmitting={savingEdit}
        title="Edit pending entry"
        description="Update the captured details before approving this work for invoicing."
      />
    </>
  )
}


