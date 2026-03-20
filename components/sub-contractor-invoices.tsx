"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BillingEntry } from "../types/billing"
import type { InvoiceEntry } from "../types/invoice"
import {
  getAllSubContractorEntries,
  saveInvoice,
  updateTimesheetEntriesWithInvoiceId,
  getClients,
  updateTimesheetEntry,
  getClientIdByName,
  deleteTimesheetEntry,
} from "../lib/supabase"
import { generateInvoicePDF } from "../lib/pdf-generator"
import { useAuth } from "../contexts/auth-context"
import { Users, FileText, DollarSign, Clock, Send, Plus, Check, PencilLine, Trash2, Download } from "lucide-react"
import { PaginationControls } from "@/components/pagination-controls"
import { format } from "date-fns"
import { generateUniqueInvoiceNumber } from "@/lib/invoice-utils"
import { toast } from "@/components/ui/use-toast"
import { BillingEntryEditDialog } from "@/components/billing-entry-edit-dialog"

interface SubContractorInvoicesProps {
  onRefresh?: () => void
  onCreateNewInvoice?: () => void
}

const ITEMS_PER_PAGE = 20

const escapeCsvValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return ""
  }
  const stringValue = String(value)
  if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}


interface ClientSubContractorEntryCardProps {
  clientName: string
  clientEntries: BillingEntry[]
  selectedEntries: string[]
  onSelectionChange: (selectedIds: string[]) => void
  stickyHeadClass: string
  isManager: boolean
  savingMarkupId: string | null
  onMarkupInputChange: (entryId: string, value: string) => void
  onMarkupSave: (entryId: string) => void
  onOpenEdit: (entry: BillingEntry) => void
  savingEdit: boolean
  editingEntryId: string | null
  onOpenDelete: (entry: BillingEntry) => void
  deletingEntryId: string | null
}

function ClientSubContractorEntryCard({
  clientName,
  clientEntries,
  selectedEntries,
  onSelectionChange,
  stickyHeadClass,
  isManager,
  savingMarkupId,
  onMarkupInputChange,
  onMarkupSave,
  onOpenEdit,
  savingEdit,
  editingEntryId,
  onOpenDelete,
  deletingEntryId
}: ClientSubContractorEntryCardProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(clientEntries.length / ITEMS_PER_PAGE)

  const displayedEntries = clientEntries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const clientEntryIds = clientEntries.map((entry) => entry.id)
  const selectedClientEntries = clientEntries.filter((entry) => selectedEntries.includes(entry.id))

  const allSelected = clientEntryIds.length > 0 && clientEntryIds.every((id) => selectedEntries.includes(id))
  const someSelected = clientEntryIds.some((id) => selectedEntries.includes(id))

  const clientTotal = selectedClientEntries.reduce((sum, entry) => sum + entry.total, 0)
  const clientHours = selectedClientEntries.reduce((sum, entry) => sum + entry.hours, 0)

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
              {clientEntries.length} entries
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm text-slate-600">
              {clientHours.toFixed(2)} hours | R {clientTotal.toLocaleString()}
            </div>
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
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Date</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Employee</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Client</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Service</TableHead>
                <TableHead className={cn("px-3 py-2 text-center", stickyHeadClass)}>Hours</TableHead>
                <TableHead className={cn("px-3 py-2 text-center", stickyHeadClass)}>Rate</TableHead>
                <TableHead className={cn("px-3 py-2 text-center", stickyHeadClass)}>Markup</TableHead>
                <TableHead className={cn("px-3 py-2 text-right", stickyHeadClass)}>Total</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Status</TableHead>
                <TableHead className={cn("px-3 py-2", stickyHeadClass)}>Comments</TableHead>
                <TableHead className={cn("px-3 py-2 text-right", stickyHeadClass)}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedEntries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-slate-50/60">
                  <TableCell className="px-3 py-2 text-center align-top">
                    <Checkbox
                      checked={selectedEntries.includes(entry.id)}
                      onCheckedChange={(checked) => handleSelectEntry(entry.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    {format(new Date(entry.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top font-medium whitespace-normal break-words">
                    {entry.loginName}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    {entry.clientName}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    {entry.itemName}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-center font-medium whitespace-normal break-words">
                    {entry.hours}h
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-center whitespace-normal break-words">
                    R {entry.ratePerHour.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-center whitespace-normal break-words">
                    {isManager ? (
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={entry.markup === undefined ? "" : entry.markup}
                          onChange={(event) => onMarkupInputChange(entry.id, event.target.value)}
                          disabled={savingMarkupId === entry.id}
                          className="h-9 w-28 text-right"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onMarkupSave(entry.id)}
                          disabled={savingMarkupId === entry.id}
                          className="h-9 px-3"
                        >
                          {savingMarkupId === entry.id ? (
                            <span className="text-xs font-medium">Saving...</span>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Confirm
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span>{entry.markup !== undefined ? `R ${entry.markup.toLocaleString()}` : "-"}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-right font-semibold whitespace-normal break-words">
                    R {entry.total.toLocaleString()}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
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
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top whitespace-normal break-words">
                    <span className="block">{entry.comments || "-"}</span>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-right whitespace-normal break-words">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenEdit(entry)}
                        disabled={savingEdit && editingEntryId === entry.id}
                        className="h-8 px-3 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenDelete(entry)}
                        disabled={Boolean(deletingEntryId)}
                        className="h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingEntryId === entry.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
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

export function SubContractorInvoices({ onRefresh, onCreateNewInvoice }: SubContractorInvoicesProps) {
  const [subContractorEntries, setSubContractorEntries] = useState<BillingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [generating, setGenerating] = useState(false)
  const [showMarkupDialog, setShowMarkupDialog] = useState(false)
  const [markupAmount, setMarkupAmount] = useState<number>(0)
  const [selectedBillToClient, setSelectedBillToClient] = useState<string>("")
  const [availableClients, setAvailableClients] = useState<Array<{ id: string; name: string }>>([])
  const [savingMarkupId, setSavingMarkupId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<BillingEntry | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [serviceFilter, setServiceFilter] = useState<string>("all")
  const [exportingFilteredEntries, setExportingFilteredEntries] = useState(false)
  const [entryPendingDelete, setEntryPendingDelete] = useState<BillingEntry | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)

  const { user } = useAuth()
  const isManager = user?.role === "admin"

  useEffect(() => {
    loadSubContractorEntries()
    loadClients()
  }, [])

  const loadSubContractorEntries = async () => {
    try {
      setLoading(true)
      const allSubContractorEntries = await getAllSubContractorEntries()
      // Only show entries that haven't been invoiced yet
      const uninvoicedEntries = allSubContractorEntries.filter((entry) => !entry.invoiceId)
      setSubContractorEntries(uninvoicedEntries)
    } catch (error) {
      console.error("Error loading sub-contractor entries:", error)
      setSubContractorEntries([])
    } finally {
      setLoading(false)
    }
  }

  const loadClients = async () => {
    try {
      const clients = await getClients()
      setAvailableClients(clients.map((client) => ({ id: client.id, name: client.client_name })))
    } catch (error) {
      console.error("Error loading clients:", error)
    }
  }

  const clientOptions = useMemo(() => {
    const unique = [...new Set(subContractorEntries.map((entry) => entry.clientName).filter(Boolean))]
    return unique.sort((a, b) => a.localeCompare(b))
  }, [subContractorEntries])

  const serviceOptions = useMemo(() => {
    const unique = [...new Set(subContractorEntries.map((entry) => entry.itemName).filter(Boolean))]
    return unique.sort((a, b) => a.localeCompare(b))
  }, [subContractorEntries])

  const billToOptions = useMemo(() => {
    const unique = new Set<string>()
    subContractorEntries.forEach((entry) => {
      if (entry.billToClient) {
        unique.add(entry.billToClient)
      }
    })
    availableClients.forEach((client) => unique.add(client.name))
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [subContractorEntries, availableClients])

  const filteredEntries = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase()

    return subContractorEntries.filter((entry) => {
      const matchesSearch =
        normalisedSearch.length === 0 ||
        [entry.clientName, entry.itemName, entry.loginName, entry.comments || ""].some((field) =>
          field.toLowerCase().includes(normalisedSearch),
        )

      const matchesClient = clientFilter === "all" || entry.clientName === clientFilter
      const matchesService = serviceFilter === "all" || entry.itemName === serviceFilter

      let matchesDateRange = true
      if (startDate || endDate) {
        if (!entry.date) {
          matchesDateRange = false
        } else {
          if (startDate && entry.date < startDate) {
            matchesDateRange = false
          }
          if (matchesDateRange && endDate && entry.date > endDate) {
            matchesDateRange = false
          }
        }
      }

      return matchesSearch && matchesClient && matchesService && matchesDateRange
    })
  }, [subContractorEntries, searchTerm, clientFilter, serviceFilter, startDate, endDate])



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

  useEffect(() => {
    setSelectedEntries((prev) => prev.filter((id) => subContractorEntries.some((entry) => entry.id === id)))
  }, [subContractorEntries])

  useEffect(() => {
    setSelectedEntries((prev) => prev.filter((id) => filteredEntries.some((entry) => entry.id === id)))
  }, [filteredEntries])

  const handleSelectClientEntries = (clientKey: string, checked: boolean) => {
    const clientEntries = entriesByClient[clientKey] ?? []
    const clientIds = clientEntries.map((entry) => entry.id)

    setSelectedEntries((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...clientIds]))
      }
      return prev.filter((id) => !clientIds.includes(id))
    })
  }

  const handleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedEntries(filteredEntries.map((entry) => entry.id))
    } else {
      setSelectedEntries([])
    }
  }

  const stickyHeadClass = "sticky top-0 z-20 bg-white"

  const handleMarkupInputChange = (entryId: string, rawValue: string) => {
    setSubContractorEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry
        const baseTotal = Number(entry.ratePerHour || 0) * Number(entry.hours || 0)
        const trimmedValue = rawValue.trim()
        if (trimmedValue === "") {
          const normalisedTotal = Number.isFinite(baseTotal) ? Number(baseTotal.toFixed(2)) : 0
          return { ...entry, markup: undefined, total: normalisedTotal }
        }
        const parsedMarkup = Number.parseFloat(trimmedValue)
        const safeMarkup = Number.isFinite(parsedMarkup) ? parsedMarkup : 0
        const markupAdjustedTotal = baseTotal + safeMarkup
        const recalculatedTotal = Number.isFinite(markupAdjustedTotal)
          ? Number(markupAdjustedTotal.toFixed(2))
          : 0
        return { ...entry, markup: safeMarkup, total: recalculatedTotal }
      }),
    )
  }

  const handleMarkupSave = async (entryId: string) => {
    const entry = subContractorEntries.find((item) => item.id === entryId)
    if (!entry) return

    const numericId = Number.parseInt(entryId, 10)
    if (Number.isNaN(numericId)) {
      console.error("Invalid entry id for markup update:", entryId)
      return
    }

    const baseTotal = Number(entry.ratePerHour || 0) * Number(entry.hours || 0)
    const markupValue = entry.markup
    const safeMarkup = Number.isFinite(markupValue ?? 0) ? (markupValue ?? 0) : 0
    const markupAdjustedTotal = baseTotal + safeMarkup
    const recalculatedTotal = Number.isFinite(markupAdjustedTotal)
      ? Number(markupAdjustedTotal.toFixed(2))
      : 0

    setSavingMarkupId(entryId)

    try {
      await updateTimesheetEntry(numericId, {
        markup: markupValue === undefined ? null : safeMarkup,
        total: recalculatedTotal,
      })
      setSubContractorEntries((prev) =>
        prev.map((item) => (item.id === entryId ? { ...item, markup: markupValue, total: recalculatedTotal } : item)),
      )
      toast({
        title: "Markup updated",
        description: `Total updated to R ${recalculatedTotal.toLocaleString()}.`,
      })
    } catch (error) {
      console.error("Failed to update markup:", error)
      toast({
        title: "Failed to update markup",
        description: "Please try again.",
        variant: "destructive",
      })
      await loadSubContractorEntries()
    } finally {
      setSavingMarkupId(null)
    }
  }

  const handleOpenEdit = (entry: BillingEntry) => {
    setEditingEntry(entry)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !savingEdit) {
      setEditingEntry(null)
    }
  }

  const handleSaveEditedEntry = async (updatedEntry: BillingEntry) => {
    setSavingEdit(true)
    try {
      const numericId = Number.parseInt(updatedEntry.id, 10)
      if (Number.isNaN(numericId)) {
        throw new Error("Invalid entry identifier")
      }

      const clientId = await getClientIdByName(updatedEntry.clientName)
      if (!clientId) {
        throw new Error(`Client "${updatedEntry.clientName}" could not be located`)
      }

      await updateTimesheetEntry(numericId, {
        entry_date: updatedEntry.date,
        activity: updatedEntry.activity,
        client: clientId,
        service: updatedEntry.itemName,
        status: updatedEntry.billable,
        retainer: updatedEntry.retainer === "Yes",
        bill_to_client: updatedEntry.billToClient,
        standard_fee: updatedEntry.standardItemFee,
        rate: updatedEntry.ratePerHour,
        hours: updatedEntry.hours,
        total: updatedEntry.total,
        markup: updatedEntry.markup ?? null,
        comments: updatedEntry.comments,
      })

      setSubContractorEntries((prev) => prev.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)))
      setEditingEntry(updatedEntry)
      toast({
        title: "Entry updated",
        description: "Sub-contractor entry details have been updated successfully.",
      })
      onRefresh?.()
    } catch (error) {
      console.error("Failed to update sub-contractor entry:", error)
      toast({
        title: "Unable to update sub-contractor entry",
        description: "Please retry the update or refresh the page.",
        variant: "destructive",
      })
      throw error
    } finally {
      setSavingEdit(false)
    }
  }

  const handleOpenDelete = (entry: BillingEntry) => {
    setEntryPendingDelete(entry)
  }

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open && !deletingEntryId) {
      setEntryPendingDelete(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!entryPendingDelete) return

    const numericId = Number.parseInt(entryPendingDelete.id, 10)
    if (Number.isNaN(numericId)) {
      toast({
        title: "Unable to delete entry",
        description: "The selected entry has an invalid identifier. Please refresh and try again.",
        variant: "destructive",
      })
      setEntryPendingDelete(null)
      return
    }

    try {
      setDeletingEntryId(entryPendingDelete.id)
      await deleteTimesheetEntry(numericId)
      setSubContractorEntries((prev) => prev.filter((entry) => entry.id !== entryPendingDelete.id))
      setSelectedEntries((prev) => prev.filter((id) => id !== entryPendingDelete.id))
      toast({
        title: "Entry deleted",
        description: "The sub-contractor entry has been removed.",
      })
      onRefresh?.()
    } catch (error) {
      console.error("Failed to delete sub-contractor entry:", error)
      toast({
        title: "Unable to delete entry",
        description: "Please retry the deletion or refresh the page.",
        variant: "destructive",
      })
    } finally {
      setDeletingEntryId(null)
      setEntryPendingDelete(null)
    }
  }

  const pendingDeleteDateLabel =
    entryPendingDelete && entryPendingDelete.date
      ? (() => {
        const parsed = new Date(entryPendingDelete.date)
        return Number.isNaN(parsed.getTime()) ? entryPendingDelete.date : format(parsed, "dd MMM yyyy")
      })()
      : ""

  const handleSelectEntry = (entryId: string, checked: boolean) => {
    setSelectedEntries((prev) => {
      if (checked) {
        return prev.includes(entryId) ? prev : [...prev, entryId]
      }
      return prev.filter((id) => id !== entryId)
    })
  }

  const handleGenerateInvoice = () => {
    if (selectedEntries.length === 0 || !user?.id) return
    setSelectedBillToClient("")
    setShowMarkupDialog(true)
  }

  const handleGenerateInvoiceWithMarkup = async () => {
    if (selectedEntries.length === 0 || !user?.id) return
    if (!selectedBillToClient) {
      alert("Please select a client to bill")
      return
    }

    try {
      setGenerating(true)
      setShowMarkupDialog(false)

      // Get selected entries
      const selectedBillingEntries = subContractorEntries.filter((entry) => selectedEntries.includes(entry.id))

      const clientName =
        availableClients.find((client) => client.id === selectedBillToClient)?.name || selectedBillToClient

      // Convert BillingEntry to InvoiceEntry with markup applied
      const invoiceEntries: InvoiceEntry[] = selectedBillingEntries.map((entry) => ({
        id: entry.id,
        billingEntryId: entry.id,
        date: entry.date,
        itemName: `${entry.itemName} (Sub-Contractor: ${entry.loginName})`,
        hours: entry.hours,
        ratePerHour: entry.ratePerHour,
        total: entry.total,
        comments: entry.comments,
      }))

      if (markupAmount > 0) {
        invoiceEntries.push({
          id: `markup-${Date.now()}`,
          billingEntryId: "markup",
          date: new Date().toISOString().split("T")[0],
          itemName: "Sub-Contractor Markup (fixed amount)",
          hours: 0,
          ratePerHour: markupAmount,
          total: markupAmount,
          comments: "",
        })
      }

      const subtotal =
        invoiceEntries.reduce((sum, entry) => sum + entry.total, 0)
      const taxRate = 15
      const taxAmount = subtotal * (taxRate / 100)
      const total = subtotal + taxAmount

      const invoiceNumber = await generateUniqueInvoiceNumber("subcontractor")

      const invoice = {
        id: crypto.randomUUID(),
        invoiceNumber,
        clientName,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
        entries: invoiceEntries,
        subtotal,
        taxRate,
        taxAmount,
        total,
        status: "Pending Approval" as const,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        notes: `Sub-Contractor Invoice - Generated from timesheet entries${markupAmount > 0 ? ` (Includes R${markupAmount.toLocaleString()} markup)` : ""
          }`,
      }

      const savedInvoice = await saveInvoice({
        invoice_number: invoice.invoiceNumber,
        bill_to: invoice.clientName,
        inv_date: invoice.issueDate,
        due_date: invoice.dueDate,
        inv_total: invoice.total,
        status: invoice.status,
        created_by: invoice.createdBy,
      })

      await updateTimesheetEntriesWithInvoiceId(
        selectedBillingEntries.map((entry) => entry.id),
        savedInvoice.uid || "",
      )

      const pdfDoc = generateInvoicePDF(invoice)

      const blob = new Blob([new Uint8Array(pdfDoc.data)], { type: pdfDoc.mime })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = pdfDoc.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSelectedEntries([])
      setMarkupAmount(0)
      setSelectedBillToClient("")
      await loadSubContractorEntries()
      onRefresh?.()

      console.log(`âœ… Generated sub-contractor invoice successfully for ${clientName}`)
    } catch (error) {
      console.error("âŒ Error generating sub-contractor invoice:", error)
    } finally {
      setGenerating(false)
    }
  }

  const handleExportFilteredEntries = () => {
    if (filteredEntries.length === 0) {
      toast({
        title: "No entries to export",
        description: "Adjust your filters to include sub-contractor entries before exporting.",
      })
      return
    }

    try {
      setExportingFilteredEntries(true)
      const headers = ["Date", "Employee", "Client", "Service", "Hours", "Rate", "Markup", "Total", "Status", "Comments"]
      const rows = filteredEntries.map((entry) => {
        const entryDate = entry.date ? new Date(entry.date) : null
        const formattedDate =
          entryDate && !Number.isNaN(entryDate.getTime()) ? format(entryDate, "yyyy-MM-dd") : entry.date || ""
        const hoursValue =
          typeof entry.hours === "number" && Number.isFinite(entry.hours) ? entry.hours.toString() : ""
        const rateValue =
          typeof entry.ratePerHour === "number" && Number.isFinite(entry.ratePerHour)
            ? entry.ratePerHour.toFixed(2)
            : ""
        const markupValue =
          typeof entry.markup === "number" && Number.isFinite(entry.markup) ? entry.markup.toFixed(2) : ""
        const totalValue =
          typeof entry.total === "number" && Number.isFinite(entry.total) ? entry.total.toFixed(2) : ""
        const statusLabel = entry.billable === "Not Billable" ? "Non-Billable" : entry.billable

        return [
          formattedDate,
          entry.loginName,
          entry.clientName,
          (entry.itemName || "").toLowerCase().includes("tax return")
            ? `${entry.itemName} - ${entry.clientName}`
            : entry.itemName,
          hoursValue,
          rateValue,
          markupValue,
          totalValue,
          statusLabel,
          entry.comments || "",
        ]
          .map(escapeCsvValue)
          .join(",")
      })

      const csv = [headers.map(escapeCsvValue).join(","), ...rows].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const fileName = `subcontractor-entries-${format(new Date(), "yyyyMMdd")}.csv`
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Export ready",
        description: `Exported ${filteredEntries.length} sub-contractor entries.`,
      })
    } catch (error) {
      console.error("Error exporting sub-contractor entries:", error)
      toast({
        title: "Unable to export entries",
        description: "Something went wrong while generating the CSV export.",
      })
    } finally {
      setExportingFilteredEntries(false)
    }
  }

  const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0)
  const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.total, 0)
  const selectedTotal = filteredEntries
    .filter((entry) => selectedEntries.includes(entry.id))
    .reduce((sum, entry) => sum + entry.total, 0)

  if (loading) {
    return (
      <div className="text-center py-8">
        <p>Loading sub-contractor entries...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-orange-600 font-medium">Total Entries</p>
                <p className="text-2xl font-bold text-orange-900">{filteredEntries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Hours</p>
                <p className="text-2xl font-bold text-blue-900">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">Total Amount</p>
                <p className="text-2xl font-bold text-green-900">R {totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-orange-600" />
                <span>Sub-Contractor Timesheet Entries</span>
              </CardTitle>
              <CardDescription className="mt-2">
                All timesheet entries with Sub-Contractor activity type from all users. Only visible to administrators.
              </CardDescription>
            </div>
            <Button
              onClick={onCreateNewInvoice}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Input
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-60 lg:w-72"
              />
              {selectedEntries.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{selectedEntries.length} selected</span>
                  <span>|</span>
                  <span>R {selectedTotal.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                variant="outline"
                onClick={handleExportFilteredEntries}
                disabled={exportingFilteredEntries || filteredEntries.length === 0}
                className="self-start"
              >
                {exportingFilteredEntries ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </>
                )}
              </Button>

              {selectedEntries.length > 0 && (
                <Button
                  onClick={handleGenerateInvoice}
                  disabled={generating}
                  className="self-start bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                >
                  {generating ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Generate Invoice
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subcontractor-start-date">From date</Label>
              <Input
                id="subcontractor-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subcontractor-end-date">To date</Label>
              <Input id="subcontractor-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subcontractor-client-filter">Client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger id="subcontractor-client-filter" className="w-full">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clientOptions.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subcontractor-service-filter">Service</Label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger id="subcontractor-service-filter" className="w-full">
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {serviceOptions.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={
                  selectedEntries.length > 0 && selectedEntries.length === filteredEntries.length
                    ? true
                    : selectedEntries.length > 0
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(checked) => handleSelectAllFiltered(checked as boolean)}
                aria-label="Select all filtered sub-contractor entries"
              />
              <span className="text-sm text-slate-600">Select all filtered entries</span>
            </div>
            {selectedEntries.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedEntries([])}>
                Clear selection
              </Button>
            )}
          </div>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center space-y-3 text-slate-500">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <Users className="h-8 w-8 text-orange-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">No sub-contractor entries found</p>
                  <p className="text-sm">Sub-contractor timesheet entries will appear here</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(entriesByClient).map(([clientName, clientEntries]) => (
                <ClientSubContractorEntryCard
                  key={clientName}
                  clientName={clientName}
                  clientEntries={clientEntries}
                  selectedEntries={selectedEntries}
                  onSelectionChange={setSelectedEntries}
                  stickyHeadClass={stickyHeadClass}
                  isManager={isManager}
                  savingMarkupId={savingMarkupId}
                  onMarkupInputChange={handleMarkupInputChange}
                  onMarkupSave={handleMarkupSave}
                  onOpenEdit={handleOpenEdit}
                  savingEdit={savingEdit}
                  editingEntryId={editingEntry ? editingEntry.id : null}
                  onOpenDelete={handleOpenDelete}
                  deletingEntryId={deletingEntryId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(entryPendingDelete)} onOpenChange={handleDeleteDialogChange}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sub-contractor entry</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove the selected entry from the sub-contractor pool.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {entryPendingDelete && (
            <div className="space-y-2 rounded-md border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <div className="font-medium text-red-800">
                {entryPendingDelete.clientName} - {entryPendingDelete.itemName}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-red-700">
                <span>{pendingDeleteDateLabel || "Unknown date"}</span>
                <span>{entryPendingDelete.hours}h @ R {entryPendingDelete.ratePerHour.toLocaleString()}</span>
                <span>Total: R {entryPendingDelete.total.toLocaleString()}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingEntryId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={Boolean(deletingEntryId)}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deletingEntryId ? "Deleting..." : "Delete entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showMarkupDialog} onOpenChange={setShowMarkupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              <span>Generate Sub-Contractor Invoice</span>
            </DialogTitle>
            <DialogDescription>
              Select the client to bill and optionally add a fixed Rand markup before generating the invoice.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="billToClient">Bill To Client *</Label>
              <select
                id="billToClient"
                value={selectedBillToClient}
                onChange={(e) => setSelectedBillToClient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              >
                <option value="">Select a client...</option>
                {availableClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="markup">Markup Amount (R) - Optional</Label>
              <Input
                id="markup"
                type="number"
                min="0"
                step="0.01"
                value={markupAmount}
                onChange={(e) => setMarkupAmount(Number.parseFloat(e.target.value) || 0)}
                placeholder="Enter markup amount (e.g., 2500)"
              />
            </div>

            {markupAmount > 0 && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Original Total:</span>
                    <span className="font-medium">R {selectedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Markup:</span>
                    <span className="font-medium text-orange-600">R {markupAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-orange-200 pt-1">
                    <span className="font-semibold">New Total:</span>
                    <span className="font-semibold text-orange-700">
                      R {(selectedTotal + markupAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowMarkupDialog(false)
                setMarkupAmount(0)
                setSelectedBillToClient("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateInvoiceWithMarkup}
              disabled={generating || !selectedBillToClient}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BillingEntryEditDialog
        entry={editingEntry}
        open={Boolean(editingEntry)}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSaveEditedEntry}
        clientOptions={clientOptions}
        serviceOptions={serviceOptions}
        billToOptions={billToOptions}
        isSubmitting={savingEdit}
        title="Edit sub-contractor entry"
        description="Adjust the captured hours, rates, or billing details before exporting to invoice."
        lockActivity
        showMarkupField
      />
    </div>
  )
}
