"use client"

import { useState, useMemo, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon, Copy, Edit, Trash2 } from "lucide-react"

import { PaginationControls } from "@/components/pagination-controls"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { getSupabaseClients } from "@/lib/supabase-client-storage"
import { getServiceItems } from "@/lib/supabase"
import { BillingEntryEditDialog } from "@/components/billing-entry-edit-dialog"
import type { BillingEntry } from "../types/billing"
import type { ClientInfo, InvoiceEntry } from "../types/invoice"

type BillableStatus = BillingEntry["billable"]
export type StatusFilterValue = "All" | BillableStatus

const DEFAULT_STATUS_OPTIONS: StatusFilterValue[] = ["All", "Billable", "Work in Progress", "Not Billable", "Recurring"]
const ALL_SERVICES_OPTION = "All services"

const deriveClientLabel = (entry: BillingEntry) => {
  const normalise = (value: unknown) =>
    typeof value === "string" ? value.trim() : ""
  const billTo = normalise(entry.billToClient)
  const clientName = normalise(entry.clientName)
  if (billTo && billTo !== "Internal") {
    return billTo
  }
  if (clientName) {
    return clientName
  }
  if (billTo) {
    return billTo
  }
  return "Unknown"
}

type FilterState = {
  client: string
  status: StatusFilterValue
  service: string
  dateFrom?: Date
  dateTo?: Date
}

interface BillableEntriesSelectorProps {
  billableEntries: BillingEntry[]
  selectedEntries: string[]
  onSelectionChange: (selectedIds: string[]) => void
  onGenerateInvoice: (clientName: string, entries: InvoiceEntry[]) => void
  showUserColumn?: boolean
  statusFilter: StatusFilterValue
  onStatusFilterChange: (status: StatusFilterValue) => void
  onUpdateEntry?: (entryId: string, updatedEntry: BillingEntry) => Promise<void>
  showRetainerStatus?: boolean
  onDuplicateRetainerEntry?: (entry: BillingEntry) => Promise<void>
  statusFilterOptions?: StatusFilterValue[]
  onFiltersChange?: (filters: FilterState) => void
  enableServiceFilter?: boolean
  clientFilterOptionsOverride?: string[]
  serviceFilterOptionsOverride?: string[]
  onDeleteEntry?: (entryId: string) => Promise<void>
  showRecurringAmountColumn?: boolean
}


interface ClientBillableEntryCardProps {
  clientName: string
  entries: BillingEntry[]
  selectedEntries: string[]
  onSelectionChange: (selectedIds: string[]) => void
  onGenerateInvoice: (clientName: string) => void
  onOpenEdit: (entry: BillingEntry) => void
  onDeleteRequest?: (entry: BillingEntry) => void
  stickyHeadClass: string
  showUserColumn: boolean
  showRetainerStatus: boolean
  showRecurringAmountColumn: boolean
  onDuplicateRetainer?: (entry: BillingEntry) => void
  duplicatingEntryId: string | null
  deletingEntryId: string | null
}

const ITEMS_PER_PAGE = 20

function ClientBillableEntryCard({
  clientName,
  entries,
  selectedEntries,
  onSelectionChange,
  onGenerateInvoice,
  onOpenEdit,
  onDeleteRequest,
  stickyHeadClass,
  showUserColumn,
  showRetainerStatus,
  showRecurringAmountColumn,
  onDuplicateRetainer,
  duplicatingEntryId,
  deletingEntryId
}: ClientBillableEntryCardProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE)

  const displayedEntries = entries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const clientEntryIds = entries.map((entry) => entry.id)
  const selectedClientEntries = entries.filter((entry) => selectedEntries.includes(entry.id))
  // Calculate "all selected" based on ALL entries, not just displayed ones
  const allSelected = clientEntryIds.length > 0 && clientEntryIds.every((id) => selectedEntries.includes(id))
  const someSelected = clientEntryIds.some((id) => selectedEntries.includes(id))

  const clientTotal = selectedClientEntries.reduce((sum, entry) => sum + entry.total, 0)
  const clientHours = selectedClientEntries.reduce((sum, entry) => sum + entry.hours, 0)

  // Reset page
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(1)
    }
  }, [totalPages, page])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelection = [...new Set([...selectedEntries, ...clientEntryIds])]
      onSelectionChange(newSelection)
    } else {
      const newSelection = selectedEntries.filter((id) => !clientEntryIds.includes(id))
      onSelectionChange(newSelection)
    }
  }

  const handleSelectEntry = (entryId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedEntries, entryId])
    } else {
      onSelectionChange(selectedEntries.filter((id) => id !== entryId))
    }
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-slate-50/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
              aria-label={`Select all entries for ${clientName}`}
            />
            <CardTitle className="text-lg font-semibold text-slate-900">{clientName}</CardTitle>
            <Badge variant="secondary" className="font-medium text-slate-700">
              {entries.length} entries
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {selectedClientEntries.length > 0 && (
              <div className="text-sm text-slate-600">
                {clientHours.toFixed(2)} hours | R {clientTotal.toLocaleString()}
              </div>
            )}
            <Button
              onClick={() => onGenerateInvoice(clientName)}
              disabled={selectedClientEntries.length === 0}
            >
              Generate Invoice
            </Button>
          </div>
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
          <Table className="w-full table-fixed text-sm">
            <TableHeader>
              <TableRow className="bg-white shadow-sm">
                <TableHead className={cn("px-3 py-2 text-center", stickyHeadClass)}>Select</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Actions</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Date</TableHead>
                {showUserColumn && (
                  <TableHead className={cn("px-3 py-2", stickyHeadClass)}>User</TableHead>
                )}
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Client</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Service</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Status</TableHead>
                {showRetainerStatus && (
                  <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Retainer</TableHead>
                )}
                <TableHead className={cn("px-3 py-2 text-right", stickyHeadClass)}>Hours</TableHead>
                <TableHead className={cn("px-3 py-2 text-right", stickyHeadClass)}>Rate</TableHead>
                {showRecurringAmountColumn && (
                  <TableHead className={cn("px-3 py-2 text-right", stickyHeadClass)}>Recurring Amount</TableHead>
                )}
                <TableHead className={cn("px-3 py-2 text-right", stickyHeadClass)}>Total</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedEntries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-slate-50/60">
                  <TableCell className="px-3 py-2 text-center align-top">
                    <Checkbox
                      checked={selectedEntries.includes(entry.id)}
                      onCheckedChange={(checked) => handleSelectEntry(entry.id, checked as boolean)}
                      aria-label={`Select entry ${entry.itemName}`}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onOpenEdit(entry)}
                        disabled={false} // Since onUpdateEntry might be undefined, handled in parent but UI should show button maybe?
                        aria-label="Edit entry"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {onDeleteRequest && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => onDeleteRequest(entry)}
                          disabled={deletingEntryId === entry.id}
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">{entry.date}</TableCell>
                  {showUserColumn && (
                    <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                      {entry.loginName}
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    <div className="max-w-sm truncate" title={entry.clientName}>
                      {entry.clientName}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    <div className="max-w-md truncate" title={entry.itemName}>
                      {entry.itemName}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    <Badge
                      className={cn(
                        "font-medium",
                        entry.billable === "Billable"
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                          : entry.billable === "Work in Progress"
                            ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-white"
                            : entry.billable === "Recurring"
                              ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white"
                              : "bg-gradient-to-r from-orange-400 to-red-400 text-white",
                      )}
                    >
                      {entry.billable === "Not Billable" ? "Non-Billable" : entry.billable}
                    </Badge>
                  </TableCell>
                  {showRetainerStatus && (
                    <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "font-medium",
                            entry.retainer === "Yes"
                              ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
                              : "bg-gradient-to-r from-slate-400 to-slate-500 text-white",
                          )}
                        >
                          {entry.retainer}
                        </Badge>
                        {entry.retainer === "Yes" && onDuplicateRetainer && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onDuplicateRetainer(entry)}
                            disabled={duplicatingEntryId === entry.id}
                            title="Duplicate for next month"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2 align-top text-right whitespace-normal break-words">
                    {entry.hours}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-right whitespace-normal break-words">
                    R {entry.ratePerHour.toLocaleString()}
                  </TableCell>
                  {showRecurringAmountColumn && (
                    <TableCell className="px-3 py-2 align-top text-right whitespace-normal break-words">
                      {entry.standardItemFee && entry.standardItemFee > 0 ? (
                        <>R {entry.standardItemFee.toLocaleString()}</>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2 align-top text-right font-semibold whitespace-normal break-words">
                    R {entry.total.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    <span className="block whitespace-normal break-words">{entry.comments || "-"}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function BillableEntriesSelector({
  billableEntries,
  selectedEntries,
  onSelectionChange,
  onGenerateInvoice,
  showUserColumn = false,
  statusFilter,
  onStatusFilterChange,
  onUpdateEntry,
  showRetainerStatus = false,
  onDuplicateRetainerEntry,
  statusFilterOptions,
  onFiltersChange,
  enableServiceFilter = false,
  clientFilterOptionsOverride,
  serviceFilterOptionsOverride,
  onDeleteEntry,
  showRecurringAmountColumn = false,
}: BillableEntriesSelectorProps) {
  const [selectedClient, setSelectedClient] = useState<string>("All clients")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [selectedService, setSelectedService] = useState<string>(ALL_SERVICES_OPTION)
  const [availableClients, setAvailableClients] = useState<ClientInfo[]>([])
  const [availableServices, setAvailableServices] = useState<Array<{ name: string; rate: number }>>([])
  const [duplicatingEntryId, setDuplicatingEntryId] = useState<string | null>(null)
  const [entryPendingDelete, setEntryPendingDelete] = useState<BillingEntry | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<BillingEntry | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const statusOptions = statusFilterOptions ?? DEFAULT_STATUS_OPTIONS
  const getStatusLabel = (value: StatusFilterValue) => {
    if (value === "Not Billable") return "Non-Billable"
    if (value === "All") return "All statuses"
    return value
  }

  // Get unique bill-to clients from billable entries or provided overrides
  const clients = useMemo(() => {
    const seen = new Set<string>()

    const addClient = (value?: string | null) => {
      const trimmed = typeof value === "string" ? value.trim() : ""
      if (!trimmed || trimmed === "Internal" || seen.has(trimmed)) {
        return
      }
      seen.add(trimmed)
    }

    if (Array.isArray(clientFilterOptionsOverride)) {
      clientFilterOptionsOverride.forEach(addClient)
    }

    billableEntries.forEach((entry) => {
      addClient(deriveClientLabel(entry))
    })

    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [billableEntries, clientFilterOptionsOverride])

  const serviceFilterOptions = useMemo(() => {
    const seen = new Set<string>()

    const addService = (value?: string | null) => {
      const trimmed = typeof value === "string" ? value.trim() : ""
      if (!trimmed || seen.has(trimmed)) {
        return
      }
      seen.add(trimmed)
    }

    if (Array.isArray(serviceFilterOptionsOverride)) {
      serviceFilterOptionsOverride.forEach(addService)
    }

    billableEntries.forEach((entry) => {
      addService(entry.itemName)
    })

    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [billableEntries, serviceFilterOptionsOverride])

  const dialogClientOptions = useMemo(() => {
    const names = new Set<string>()

    availableClients.forEach((client) => {
      const trimmed = client.name?.trim()
      if (trimmed) {
        names.add(trimmed)
      }
      const billTo = typeof client.bill_to === "string" ? client.bill_to.trim() : ""
      if (billTo) {
        names.add(billTo)
      }
    })

    clients.forEach((client) => names.add(client))

    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [availableClients, clients])

  const dialogServiceOptions = useMemo(() => {
    const names = new Set<string>()

    availableServices.forEach((service) => {
      const trimmed = service.name?.trim()
      if (trimmed) {
        names.add(trimmed)
      }
    })

    billableEntries.forEach((entry) => {
      const trimmed = entry.itemName?.trim()
      if (trimmed) {
        names.add(trimmed)
      }
    })

    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [availableServices, billableEntries])

  const billToOptions = useMemo(() => {
    const values = new Set<string>()

    availableClients.forEach((client) => {
      const name = client.name?.trim()
      if (name) {
        values.add(name)
      }
      const billTo = typeof client.bill_to === "string" ? client.bill_to.trim() : ""
      if (billTo) {
        values.add(billTo)
      }
    })

    billableEntries.forEach((entry) => {
      const trimmed = entry.billToClient?.trim()
      if (trimmed) {
        values.add(trimmed)
      }
    })

    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [availableClients, billableEntries])

  useEffect(() => {
    const loadAuxData = async () => {
      try {
        const clientList = await getSupabaseClients()
        setAvailableClients(clientList)
      } catch (error) {
        console.error("Failed to load clients for inline editing", error)
        setAvailableClients([])
      }

      try {
        const services = await getServiceItems()
        setAvailableServices(services)
      } catch (error) {
        console.error("Failed to load services for inline editing", error)
        setAvailableServices([])
      }
    }

    loadAuxData()
  }, [])

  useEffect(() => {
    if (!statusOptions.includes(statusFilter)) {
      onStatusFilterChange(statusOptions[0])
    }
  }, [statusOptions, statusFilter, onStatusFilterChange])

  useEffect(() => {
    if (selectedClient !== "All clients" && !clients.includes(selectedClient)) {
      setSelectedClient("All clients")
    }
  }, [clients, selectedClient])

  useEffect(() => {
    if (!enableServiceFilter) {
      setSelectedService(ALL_SERVICES_OPTION)
      return
    }
    if (selectedService !== ALL_SERVICES_OPTION && !serviceFilterOptions.includes(selectedService)) {
      setSelectedService(ALL_SERVICES_OPTION)
    }
  }, [enableServiceFilter, serviceFilterOptions, selectedService])

  useEffect(() => {
    if (!onFiltersChange) return

    onFiltersChange({
      client: selectedClient,
      status: statusFilter,
      service: enableServiceFilter ? selectedService : ALL_SERVICES_OPTION,
      dateFrom,
      dateTo,
    })
  }, [onFiltersChange, selectedClient, statusFilter, selectedService, enableServiceFilter, dateFrom, dateTo])

  // Filter entries based on selected client, status and date range
  const filteredEntries = useMemo(() => {
    return billableEntries.filter((entry) => {
      const entryClient = deriveClientLabel(entry)
      if (entryClient === "Internal") return false
      if (statusFilter !== "All" && entry.billable !== statusFilter) return false
      if (selectedClient !== "All clients" && entryClient !== selectedClient) return false
      if (enableServiceFilter && selectedService !== ALL_SERVICES_OPTION && entry.itemName !== selectedService)
        return false
      if (dateFrom && new Date(entry.date) < dateFrom) return false
      if (dateTo && new Date(entry.date) > dateTo) return false
      return true
    })
  }, [billableEntries, selectedClient, statusFilter, selectedService, enableServiceFilter, dateFrom, dateTo])

  // Group entries by bill-to client
  const entriesByClient = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      const groupKey = deriveClientLabel(entry)
      if (!acc[groupKey]) {
        acc[groupKey] = []
      }
      acc[groupKey].push(entry)
      return acc
    }, {} as Record<string, BillingEntry[]>)
  }, [filteredEntries])

  // Calculate totals for selected entries
  const selectedTotals = useMemo(() => {
    const selected = filteredEntries.filter((entry) => selectedEntries.includes(entry.id))
    return {
      hours: selected.reduce((sum, entry) => sum + entry.hours, 0),
      amount: selected.reduce((sum, entry) => sum + entry.total, 0),
    }
  }, [filteredEntries, selectedEntries])

  const handleSelectAll = (clientName: string, checked: boolean) => {
    const clientEntries = entriesByClient[clientName] || []
    const clientEntryIds = clientEntries.map((entry) => entry.id)

    if (checked) {
      const newSelection = [...new Set([...selectedEntries, ...clientEntryIds])]
      onSelectionChange(newSelection)
    } else {
      const newSelection = selectedEntries.filter((id) => !clientEntryIds.includes(id))
      onSelectionChange(newSelection)
    }
  }

  const handleSelectEntry = (entryId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedEntries, entryId])
    } else {
      onSelectionChange(selectedEntries.filter((id) => id !== entryId))
    }
  }

  const handleGenerateInvoice = (clientName: string) => {
    const clientEntries = entriesByClient[clientName] || []
    const selectedClientEntries = clientEntries.filter((entry) => selectedEntries.includes(entry.id))

    const invoiceEntries: InvoiceEntry[] = selectedClientEntries.map((entry) => ({
      id: entry.id,
      billingEntryId: entry.id,
      date: entry.date,
      itemName: entry.itemName,
      hours: entry.hours,
      ratePerHour: entry.ratePerHour,
      total: entry.total,
      comments: entry.comments,
    }))

    onGenerateInvoice(clientName, invoiceEntries)
  }

  const handleDuplicateRetainer = async (entry: BillingEntry) => {
    if (!onDuplicateRetainerEntry) {
      return
    }

    try {
      setDuplicatingEntryId(entry.id)
      await onDuplicateRetainerEntry(entry)
    } catch (error) {
      console.error("Error duplicating retainer entry:", error)
    } finally {
      setDuplicatingEntryId(null)
    }
  }

  const handleOpenEdit = (entry: BillingEntry) => {
    if (!onUpdateEntry) return
    setEditingEntry(entry)
  }

  const handleCloseEditDialog = (open: boolean) => {
    if (!open && !savingEdit) {
      setEditingEntry(null)
    }
  }

  const handleSubmitEdit = async (updatedEntry: BillingEntry) => {
    if (!onUpdateEntry || !editingEntry) return

    try {
      setSavingEdit(true)
      await onUpdateEntry(editingEntry.id, updatedEntry)
      setEditingEntry(null)
    } catch (error) {
      console.error("Failed to save timesheet entry:", error)
      throw error
    } finally {
      setSavingEdit(false)
    }
  }

  const handleRequestDeleteEntry = (entry: BillingEntry) => {
    if (!onDeleteEntry) return
    setEntryPendingDelete(entry)
  }

  const handleDeleteDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !deletingEntryId) {
      setEntryPendingDelete(null)
    }
  }

  const handleConfirmDeleteEntry = async () => {
    if (!entryPendingDelete || !onDeleteEntry) {
      setEntryPendingDelete(null)
      return
    }

    try {
      setDeletingEntryId(entryPendingDelete.id)
      await onDeleteEntry(entryPendingDelete.id)
    } catch (error) {
      console.error("Failed to delete billing entry:", error)
    } finally {
      setDeletingEntryId(null)
      setEntryPendingDelete(null)
    }
  }

  const stickyHeadClass = "sticky top-0 z-20 bg-white"

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Timesheet Entries</CardTitle>
          <CardDescription>Select date range, client, and status to filter entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-4", enableServiceFilter && "lg:grid-cols-5")}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All clients">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => onStatusFilterChange(value as StatusFilterValue)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getStatusLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {enableServiceFilter && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Service</label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder={ALL_SERVICES_OPTION} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SERVICES_OPTION}>{ALL_SERVICES_OPTION}</SelectItem>
                    {serviceFilterOptions.map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Summary */}
      {selectedEntries.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedEntries.length} entries selected | {selectedTotals.hours} hours | R{" "}
                  {selectedTotals.amount.toLocaleString()}
                </p>
              </div>
              <Button variant="outline" onClick={() => onSelectionChange([])} disabled={selectedEntries.length === 0}>
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries by Client */}
      <div className="space-y-4">
        {Object.entries(entriesByClient).map(([clientName, entries]) => (
          <ClientBillableEntryCard
            key={clientName}
            clientName={clientName}
            entries={entries}
            selectedEntries={selectedEntries}
            onSelectionChange={onSelectionChange}
            onGenerateInvoice={handleGenerateInvoice}
            onOpenEdit={handleOpenEdit}
            onDeleteRequest={handleRequestDeleteEntry}
            stickyHeadClass={stickyHeadClass}
            showUserColumn={showUserColumn}
            showRetainerStatus={showRetainerStatus}
            showRecurringAmountColumn={showRecurringAmountColumn}
            onDuplicateRetainer={onDuplicateRetainerEntry}
            duplicatingEntryId={duplicatingEntryId}
            deletingEntryId={deletingEntryId}
          />
        ))}
      </div>

      {Object.keys(entriesByClient).length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <p>No billable entries found for the selected criteria.</p>
              <p className="mt-2 text-sm">Try adjusting your filters or date range.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <BillingEntryEditDialog
        entry={editingEntry}
        open={Boolean(editingEntry)}
        onOpenChange={handleCloseEditDialog}
        onSubmit={handleSubmitEdit}
        clientOptions={dialogClientOptions}
        serviceOptions={dialogServiceOptions}
        billToOptions={billToOptions}
        isSubmitting={savingEdit}
        title="Edit billable entry"
        description="Update the timesheet entry before generating an invoice."
      />

      <AlertDialog open={Boolean(entryPendingDelete)} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete timesheet entry</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove the selected entry from the invoicing list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {entryPendingDelete && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="font-medium text-red-800">
                {entryPendingDelete.clientName} - {entryPendingDelete.itemName}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-red-700">
                <span>{entryPendingDelete.date}</span>
                <span>
                  {entryPendingDelete.hours}h @ R {entryPendingDelete.ratePerHour.toLocaleString()}
                </span>
                <span>Total: R {entryPendingDelete.total.toLocaleString()}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingEntryId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteEntry}
              disabled={Boolean(deletingEntryId)}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deletingEntryId ? "Deleting..." : "Delete entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}






