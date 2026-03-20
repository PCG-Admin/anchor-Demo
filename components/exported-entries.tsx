"use client"

import { useMemo, useState, useEffect } from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { PaginationControls } from "@/components/pagination-controls"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import type { BillingEntry } from "@/types/billing"

const formatEntryDate = (value: string) => {
  if (!value) return "N/A"
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return value
  return format(parsed, "dd MMM yyyy")
}

const ITEMS_PER_PAGE = 20

const formatActivityLabel = (activity?: string | null) => {
  if (!activity) return "-"
  const trimmed = activity.trim()
  if (!trimmed) return "-"
  return trimmed
}

const stickyHeadClass = "sticky top-0 z-20 bg-white"

interface ExportedEntriesViewProps {
  entries: BillingEntry[]
  loading?: boolean
}

interface ClientExportedEntriesCardProps {
  clientName: string
  clientEntries: BillingEntry[]
  stickyHeadClass: string
}

function ClientExportedEntriesCard({ clientName, clientEntries, stickyHeadClass }: ClientExportedEntriesCardProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(clientEntries.length / ITEMS_PER_PAGE)

  const clientTotal = clientEntries.reduce((sum, entry) => sum + (entry.total || 0), 0)
  const clientHours = clientEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0)

  const displayedEntries = clientEntries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1)
    }
  }, [totalPages, page])

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">{clientName}</CardTitle>
            <p className="text-xs text-slate-500">
              {clientEntries.length} {clientEntries.length === 1 ? "entry" : "entries"} |{" "}
              {clientHours.toFixed(2)} hours
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            R {clientTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="bg-white shadow-sm text-sm font-semibold text-slate-600">
                <th className={cn("px-3 py-2 align-top text-left", stickyHeadClass)}>Date</th>
                <th className={cn("px-3 py-2 align-top text-left", stickyHeadClass)}>Activity</th>
                <th className={cn("px-3 py-2 align-top text-left", stickyHeadClass)}>Service Item</th>
                <th className={cn("px-3 py-2 align-top text-left", stickyHeadClass)}>Bill To</th>
                <th className={cn("px-3 py-2 align-top text-right", stickyHeadClass)}>Hours</th>
                <th className={cn("px-3 py-2 align-top text-right", stickyHeadClass)}>Rate</th>
                <th className={cn("px-3 py-2 align-top text-right", stickyHeadClass)}>Total</th>
                <th className={cn("px-3 py-2 align-top text-left", stickyHeadClass)}>Status</th>
                <th className={cn("px-3 py-2 align-top text-left", stickyHeadClass)}>Comments</th>
              </tr>
            </thead>
            <tbody>
              {displayedEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/70">
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    {formatEntryDate(entry.date)}
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
                  <td className="align-top px-3 py-2 whitespace-normal break-words">{entry.itemName}</td>
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
                    <Badge className="bg-blue-600 text-white">Billable-Exported</Badge>
                  </td>
                  <td className="align-top px-3 py-2 whitespace-normal break-words">
                    <span className="block">{entry.comments || "-"}</span>
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

export function ExportedEntriesView({ entries, loading = false }: ExportedEntriesViewProps) {
  const [clientFilter, setClientFilter] = useState<string>("All clients")
  const [serviceFilter, setServiceFilter] = useState<string>("All services")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()


  const uniqueClients = useMemo(() => {
    const clients = [...new Set(entries.map((entry) => entry.clientName).filter(Boolean))]
    return clients.sort((a, b) => a.localeCompare(b))
  }, [entries])

  const uniqueServices = useMemo(() => {
    const services = [...new Set(entries.map((entry) => entry.itemName).filter(Boolean))]
    return services.sort((a, b) => a.localeCompare(b))
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (clientFilter !== "All clients" && entry.clientName !== clientFilter) return false
      if (serviceFilter !== "All services" && entry.itemName !== serviceFilter) return false

      if (dateFrom || dateTo) {
        const entryDate = parseISO(entry.date)
        if (!Number.isNaN(entryDate.getTime())) {
          if (dateFrom && entryDate < dateFrom) return false
          if (dateTo) {
            const end = new Date(dateTo)
            end.setHours(23, 59, 59, 999)
            if (entryDate > end) return false
          }
        }
      }

      return true
    })
  }, [entries, clientFilter, serviceFilter, dateFrom, dateTo])

  const entriesByClient = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      const groupKey = entry.billToClient || entry.clientName || "Unassigned Client"
      if (!acc[groupKey]) {
        acc[groupKey] = []
      }
      acc[groupKey].push(entry)
      return acc
    }, {} as Record<string, BillingEntry[]>)
  }, [filteredEntries])

  const totalHours = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0),
    [filteredEntries],
  )

  const totalAmount = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + (entry.total || 0), 0),
    [filteredEntries],
  )

  const resetFilters = () => {
    setClientFilter("All clients")
    setServiceFilter("All services")
    setDateFrom(undefined)
    setDateTo(undefined)

  }

  return (
    <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
      <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-lg"></div>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-slate-900">
          <span>Billable-Exported Entries</span>
          <Badge variant="outline" className="px-2 py-1 text-xs font-medium text-blue-600 border-blue-200">
            {filteredEntries.length} entries | {totalHours.toFixed(2)} hours | R{" "}
            {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </CardTitle>
        <CardDescription>
          Review exported billable entries grouped by client. Use the filters below to refine the list.
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
            <label className="text-sm font-medium text-slate-700">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateFrom && "text-slate-500",
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateTo && "text-slate-500",
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Reset Filters</label>
            <Button variant="outline" onClick={resetFilters} className="w-full">
              Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="py-4">
              <p className="text-xs uppercase text-blue-600">Entries</p>
              <p className="text-2xl font-semibold text-blue-900">{filteredEntries.length}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="py-4">
              <p className="text-xs uppercase text-emerald-600">Total Hours</p>
              <p className="text-2xl font-semibold text-emerald-900">{totalHours.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="py-4">
              <p className="text-xs uppercase text-purple-600">Total Amount</p>
              <p className="text-2xl font-semibold text-purple-900">
                R {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading exported entries...</div>
          ) : Object.keys(entriesByClient).length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No entries match the selected filters. Adjust the filters and try again.
            </div>
          ) : (
            Object.entries(entriesByClient).map(([clientName, clientEntries]) => (
              <ClientExportedEntriesCard
                key={clientName}
                clientName={clientName}
                clientEntries={clientEntries}
                stickyHeadClass={stickyHeadClass}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
