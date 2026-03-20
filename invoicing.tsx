"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { addMonths, format } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { BillableEntriesSelector } from "./components/billable-entries-selector"
import { InvoicePreview } from "./components/invoice-preview"
import { DraftInvoiceList } from "./components/draft-invoice-list"
import { RetainerInvoiceCreator } from "./components/retainer-invoice-creator"
import { SubContractorInvoices } from "./components/sub-contractor-invoices"
import { PendingApprovalEntries } from "./components/pending-approval-entries"
import { ExportedEntriesView } from "./components/exported-entries"
import { PaginationControls } from "@/components/pagination-controls"
import {
  getTimesheetEntriesForInvoicing,
  getInvoices,
  updateTimesheetEntry,
  getClientIdByName,
  duplicateTimesheetEntryWithNewDate,
  getAllClientRecurringServices,
  updateClientRecurringService,
  deleteTimesheetEntry,
  getBillableExportedEntries,
} from "./lib/supabase"
import { useAuth } from "./contexts/auth-context"
import type { Invoice, InvoiceEntry } from "./types/invoice"
import type { BillingEntry } from "./types/billing"
import type { InvoiceRaw, ClientRecurringService } from "./lib/supabase"
import { FileText, Plus, List, Edit, Receipt, Users, Loader2 } from "lucide-react"

type StatusFilterValue = "All" | BillingEntry["billable"]

type RecurringServiceDraftState = {
  amount: string
  active: boolean
  quantity: string
}

const SERVICE_FILTER_ALL = "All services"
const ITEMS_PER_PAGE = 20


export default function Invoicing() {
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [selectedRecurringEntries, setSelectedRecurringEntries] = useState<string[]>([])
  const [, setInvoices] = useState<Invoice[]>([])
  const [currentInvoice, setCurrentInvoice] = useState<{
    clientName: string
    entries: InvoiceEntry[]
    isEditing?: boolean
    invoiceId?: string
    type?: "regular" | "retainer" | "subcontractor"
  } | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [creatingRetainerInvoice, setCreatingRetainerInvoice] = useState(false)
  const [creatingSubContractorInvoice, setCreatingSubContractorInvoice] = useState(false)
  const [recurringPage, setRecurringPage] = useState(1)
  const [billableEntries, setBillableEntries] = useState<BillingEntry[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("All")
  const [recurringStatusFilter, setRecurringStatusFilter] = useState<StatusFilterValue>("Recurring")
  const [loading, setLoading] = useState(true)
  const [, setInvoicesLoading] = useState(true)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [clientRecurringServices, setClientRecurringServices] = useState<ClientRecurringService[]>([])
  const [recurringServicesLoading, setRecurringServicesLoading] = useState(true)
  const { user } = useAuth()
  const [recurringServiceDrafts, setRecurringServiceDrafts] = useState<Record<string, RecurringServiceDraftState>>({})
  const [savingRecurringServiceId, setSavingRecurringServiceId] = useState<string | null>(null)
  const [exportingRecurringServices, setExportingRecurringServices] = useState(false)
  const [recurringFilters, setRecurringFilters] = useState<{
    client: string
    status: StatusFilterValue
    service: string
    dateFrom?: Date
    dateTo?: Date
  }>({
    client: "All clients",
    status: "Recurring",
    service: SERVICE_FILTER_ALL,
    dateFrom: undefined,
    dateTo: undefined,
  })
  const [exportedEntries, setExportedEntries] = useState<BillingEntry[]>([])
  const [exportedEntriesLoading, setExportedEntriesLoading] = useState(true)


  const formatCurrencyValue = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "-"
    }
    return `R ${Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatDateLabel = (value: string | null | undefined) => {
    if (!value) return "-"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : format(parsed, "dd MMM yyyy")
  }

  const amountToInputValue = (value: number | null | undefined) =>
    value === null || value === undefined || Number.isNaN(Number(value)) || Number(value) === 0
      ? ""
      : Number(value).toFixed(2)

  const quantityToInputValue = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return ""
    }
    return Number(value).toString()
  }

  const parseAmountInput = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === "") return null
    const parsed = Number.parseFloat(trimmed)
    return Number.isNaN(parsed) ? Number.NaN : Number(parsed.toFixed(2))
  }

  const parseQuantityInput = (value: string | undefined) => {
    if (value === undefined || value === null) return null
    const trimmed = value.trim()
    if (trimmed === "") return null
    const parsed = Number.parseFloat(trimmed)
    return Number.isNaN(parsed) ? Number.NaN : Number(parsed)
  }

  const amountsEqual = (a: number | null, b: number | null | undefined) => {
    const normalise = (value: number | null | undefined) => {
      if (value === null || value === undefined || Number.isNaN(value)) return null
      return Number(value.toFixed(2))
    }
    return normalise(a) === normalise(b)
  }

  const findRecurringServiceById = (serviceId: string) =>
    clientRecurringServices.find((service) => service.id === serviceId)

  const regularBillableEntries = useMemo(
    () => billableEntries.filter((entry) => entry.billable !== "Recurring" && entry.activity !== "Sub-Contractor"),
    [billableEntries],
  )

  const recurringBillableEntries = useMemo(
    () => billableEntries.filter((entry) => entry.billable === "Recurring"),
    [billableEntries],
  )

  const recurringServiceFilterOptions = useMemo(() => {
    const services = new Set<string>()
    const addService = (value?: string | null) => {
      const trimmed = typeof value === "string" ? value.trim() : ""
      if (!trimmed) return
      services.add(trimmed)
    }

    clientRecurringServices.forEach((service) => {
      if (service.service_name) {
        addService(service.service_name)
      } else if (service.xero_item_code) {
        addService(service.xero_item_code)
      }
    })
    recurringBillableEntries.forEach((entry) => {
      addService(entry.itemName)
    })
    return Array.from(services).sort((a, b) => a.localeCompare(b))
  }, [clientRecurringServices, recurringBillableEntries])

  const recurringClientFilterOptions = useMemo(() => {
    const clients = new Set<string>()
    const addClient = (value?: string | null) => {
      const trimmed = typeof value === "string" ? value.trim() : ""
      if (!trimmed || trimmed === "Internal") return
      clients.add(trimmed)
    }

    clientRecurringServices.forEach((service) => {
      addClient(service.client_name)
    })

    recurringBillableEntries.forEach((entry) => {
      addClient(entry.billToClient)
      addClient(entry.clientName)
    })

    return Array.from(clients).sort((a, b) => a.localeCompare(b))
  }, [clientRecurringServices, recurringBillableEntries])

  const filteredRecurringServices = useMemo(() => {
    const normalise = (value: unknown) =>
      typeof value === "string" ? value.trim().toLowerCase() : ""

    const fromDate = recurringFilters.dateFrom ? new Date(recurringFilters.dateFrom) : undefined
    const toDate = recurringFilters.dateTo ? new Date(recurringFilters.dateTo) : undefined

    if (fromDate) {
      fromDate.setHours(0, 0, 0, 0)
    }
    if (toDate) {
      toDate.setHours(23, 59, 59, 999)
    }

    return clientRecurringServices.filter((service) => {
      if (!(service.frequency || "").toLowerCase().includes("recurr")) {
        return false
      }

      if (recurringFilters.client !== "All clients") {
        const serviceClient = normalise(service.client_name)
        if (!serviceClient || serviceClient !== normalise(recurringFilters.client)) {
          return false
        }
      }

      if (recurringFilters.service !== SERVICE_FILTER_ALL) {
        const filterService = normalise(recurringFilters.service)
        const candidates = [
          normalise(service.service_name),
          normalise(service.xero_item_code),
        ].filter(Boolean)

        if (!candidates.includes(filterService)) {
          return false
        }
      }

      if (fromDate || toDate) {
        const previousDate = service.previous_date ? new Date(service.previous_date) : undefined
        if (!previousDate) {
          return false
        }

        if (fromDate && previousDate < fromDate) {
          return false
        }

        if (toDate && previousDate > toDate) {
          return false
        }
      }

      return true
    })
  }, [clientRecurringServices, recurringFilters])

  const recurringServicesByClient = useMemo(() => {
    const grouped = new Map<string, { clientId: string; clientName: string; services: ClientRecurringService[] }>()
    filteredRecurringServices.forEach((service) => {
      const key = service.client_id || service.id
      if (!grouped.has(key)) {
        grouped.set(key, {
          clientId: service.client_id || key,
          clientName: service.client_name || "Unassigned Client",
          services: [],
        })
      }
      grouped.get(key)!.services.push(service)
    })

    return Array.from(grouped.values()).map((group) => ({
      clientId: group.clientId,
      clientName: group.clientName,
      services: [...group.services].sort((a, b) => a.previous_date.localeCompare(b.previous_date)),
    }))
  }, [filteredRecurringServices])

  const totalRecurringAmount = useMemo(() => {
    return filteredRecurringServices.reduce((sum, service) => sum + (service.amount ?? 0), 0)
  }, [filteredRecurringServices])

  const loadRecurringServices = async () => {
    try {
      setRecurringServicesLoading(true)
      const services = await getAllClientRecurringServices()
      setClientRecurringServices(services)
    } catch (error) {
      console.error("Error loading recurring services:", error)
      setClientRecurringServices([])
    } finally {
      setRecurringServicesLoading(false)
    }
  }

  const loadExportedEntries = async () => {
    if (!user?.id) {
      setExportedEntries([])
      setExportedEntriesLoading(false)
      return
    }

    try {
      setExportedEntriesLoading(true)
      const entries = await getBillableExportedEntries(user.id, user.role === "admin")
      setExportedEntries(entries)
    } catch (error) {
      console.error("Error loading billable-exported entries:", error)
      setExportedEntries([])
    } finally {
      setExportedEntriesLoading(false)
    }
  }

  const activeRecurringPendingEntries = useMemo(() => {
    return clientRecurringServices
      .filter((service) => Boolean(service.active))
      .map((service) => {
        const serviceName = service.service_name || service.xero_item_code || "Recurring Service"
        const serviceDate = service.next_date || service.previous_date || new Date().toISOString()

        return {
          id: `recurring-${service.id}`,
          loginName: "Recurring Service",
          date: serviceDate,
          activity: "Recurring Service" as BillingEntry["activity"],
          clientName: service.client_name || "Unknown Client",
          clientId: service.client_id,
          itemName: serviceName,
          hours: Number.isFinite(Number(service.quantity)) ? Number(service.quantity) : 0,
          billable: "Recurring" as BillingEntry["billable"],
          standardItemFee: service.amount ?? 0,
          ratePerHour: service.amount ?? 0,
          total: service.amount ?? 0,
          comments: service.notes || "",
          retainer: "No" as const,
          billToClient: service.client_name || "",
          invoiceId: null,
          xeroItemCode: service.xero_item_code ?? null,
          source: "recurring" as const,
        } satisfies BillingEntry
      })
  }, [clientRecurringServices])

  const billablePendingEntries = useMemo(() => {
    const timesheetPending = billableEntries.filter((entry) => entry.billable === "Billable")

    return [...timesheetPending, ...activeRecurringPendingEntries]
  }, [billableEntries, activeRecurringPendingEntries])

  useEffect(() => {
    const allowedIds = new Set(regularBillableEntries.map((entry) => entry.id))
    setSelectedEntries((prev) => {
      const filtered = prev.filter((id) => allowedIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [regularBillableEntries])

  useEffect(() => {
    const allowedIds = new Set(recurringBillableEntries.map((entry) => entry.id))
    setSelectedRecurringEntries((prev) => {
      const filtered = prev.filter((id) => allowedIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [recurringBillableEntries])

  useEffect(() => {
    const loadInvoices = async () => {
      if (!user?.id) {
        setInvoicesLoading(false)
        return
      }

      try {
        setInvoicesLoading(true)
        const rawInvoices = await getInvoices(user.id)

        // Transform InvoiceRaw to Invoice format
        const transformedInvoices: Invoice[] = rawInvoices.map((raw: InvoiceRaw) => ({
          id: raw.uid || "",
          invoiceNumber: raw.invoice_number,
          clientName: raw.bill_to,
          issueDate: raw.inv_date,
          dueDate: raw.due_date,
          entries: [], // Will be populated when viewing individual invoice
          subtotal: raw.inv_total,
          taxRate: 0, // Default values - could be enhanced later
          taxAmount: 0,
          total: raw.inv_total,
          status: (raw.status as "Draft" | "Sent" | "Paid" | "Overdue" | "Pending Approval") || "Draft",
          createdBy: raw.created_by,
          createdAt: raw.created_at || new Date().toISOString(),
        }))

        setInvoices(transformedInvoices)
      } catch (error) {
        console.error("Error loading invoices:", error)
        setInvoices([])
      } finally {
        setInvoicesLoading(false)
      }
    }

    loadInvoices()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setClientRecurringServices([])
      setRecurringServicesLoading(false)
      return
    }

    loadRecurringServices()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setExportedEntries([])
      setExportedEntriesLoading(false)
      return
    }

    loadExportedEntries()
  }, [user?.id, user?.role])

  useEffect(() => {
    setRecurringServiceDrafts(
      filteredRecurringServices.reduce<Record<string, RecurringServiceDraftState>>((acc, service) => {
        acc[service.id] = {
          amount: amountToInputValue(service.amount),
          active: Boolean(service.active),
          quantity: quantityToInputValue(service.quantity),
        }
        return acc
      }, {}),
    )
  }, [filteredRecurringServices])

  useEffect(() => {
    const loadTimesheetEntries = async () => {
      if (!user?.id) {
        console.log("No user ID available")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const entries = await getTimesheetEntriesForInvoicing(user.id, user.role === "admin")
        setBillableEntries(entries)
      } catch (error) {
        console.error("Error loading timesheet entries:", error)
        setBillableEntries([])
      } finally {
        setLoading(false)
      }
    }

    loadTimesheetEntries()
  }, [user?.id])

  useEffect(() => {
    const loadPendingApprovalCount = async () => {
      if (!user?.id) return

      try {
        const { getDraftInvoices } = await import("./lib/supabase")
        const pendingInvoices = await getDraftInvoices(user.id, user.role === "admin")
        setPendingApprovalCount(pendingInvoices.length)
      } catch (error) {
        console.error("Error loading pending approval count:", error)
        setPendingApprovalCount(0)
      }
    }

    loadPendingApprovalCount()
  }, [user?.id, user?.role])

  const handleRecurringFiltersChange = useCallback(
    (filters: {
      client: string
      status: StatusFilterValue
      service: string
      dateFrom?: Date
      dateTo?: Date
    }) => {
      const datesEqual = (a?: Date, b?: Date) => {
        if (!a && !b) return true
        if (!a || !b) return false
        return a.getTime() === b.getTime()
      }

      setRecurringFilters((previous) => {
        if (
          previous.client === filters.client &&
          previous.status === filters.status &&
          previous.service === filters.service &&
          datesEqual(previous.dateFrom, filters.dateFrom) &&
          datesEqual(previous.dateTo, filters.dateTo)
        ) {
          return previous
        }
        return { ...filters }
      })
    },
    [],
  )

  const handleGenerateInvoice = (clientName: string, entries: InvoiceEntry[]) => {
    setCurrentInvoice({ clientName, entries, type: "regular" })
  }

  const handleGenerateRetainerInvoice = (clientName: string, entries: InvoiceEntry[]) => {
    setCurrentInvoice({ clientName, entries, type: "retainer" })
  }

  const handleEditDraftInvoice = (
    invoiceId: string,
    clientName: string,
    entries: BillingEntry[],
    invoiceNumber?: string,
  ) => {
    const invoiceEntries: InvoiceEntry[] = entries.map((entry) => ({
      id: entry.id,
      billingEntryId: entry.id,
      date: entry.date,
      itemName: entry.itemName,
      hours: entry.hours,
      ratePerHour: entry.ratePerHour,
      total: entry.total,
      comments: entry.comments,
    }))

    const normalisedInvoiceNumber = invoiceNumber?.toLowerCase() || ""
    const invoiceType = normalisedInvoiceNumber.startsWith("r-inv")
      ? "retainer"
      : normalisedInvoiceNumber.startsWith("sc-inv")
        ? "subcontractor"
        : "regular"

    setCurrentInvoice({
      clientName,
      entries: invoiceEntries,
      isEditing: true,
      invoiceId,
      type: invoiceType,
    })
  }

  const handleSaveInvoice = (invoice: Invoice) => {
    const invoiceContext = currentInvoice
    setCurrentInvoice(null)
    const invoicedEntryIds = invoice.entries.map((entry) => entry.billingEntryId)
    if (invoiceContext?.type === "retainer") {
      setSelectedRecurringEntries(selectedRecurringEntries.filter((id) => !invoicedEntryIds.includes(id)))
    } else {
      setSelectedEntries(selectedEntries.filter((id) => !invoicedEntryIds.includes(id)))
    }

    handleRefreshData()
    handleRefreshBillableEntries()
  }

  const handleCancelInvoice = () => {
    setCurrentInvoice(null)
  }

  const handleCreateRetainerInvoice = () => {
    setCreatingRetainerInvoice(true)
  }

  const handleCreateSubContractorInvoice = () => {
    setCreatingSubContractorInvoice(true)
  }

  const handleSaveRetainerInvoice = () => {
    setCreatingRetainerInvoice(false)
    handleRefreshData()
  }

  const handleSaveSubContractorInvoice = () => {
    setCreatingSubContractorInvoice(false)
    handleRefreshData()
  }

  const handleInlineUpdateEntry = async (entryId: string, updatedEntry: BillingEntry) => {
    try {
      const clientId = await getClientIdByName(updatedEntry.clientName)
      if (!clientId) {
        throw new Error(`Client ${updatedEntry.clientName} not found`)
      }

      await updateTimesheetEntry(Number.parseInt(entryId), {
        entry_date: updatedEntry.date,
        activity: updatedEntry.activity,
        client: clientId,
        service: updatedEntry.itemName,
        status: updatedEntry.billable,
        retainer: false,
        bill_to_client: updatedEntry.billToClient,
        standard_fee: updatedEntry.standardItemFee,
        rate: updatedEntry.ratePerHour,
        hours: updatedEntry.hours,
        total: updatedEntry.total,
        comments: updatedEntry.comments,
      })

      setBillableEntries((prev) => prev.map((entry) => (entry.id === entryId ? updatedEntry : entry)))
      handleRefreshBillableEntries()
    } catch (error) {
      console.error("Error updating timesheet entry inline:", error)
      throw error
    }
  }

  const handleDeleteBillableEntry = async (entryId: string) => {
    const numericId = Number.parseInt(entryId, 10)
    if (Number.isNaN(numericId)) {
      toast({
        title: "Unable to delete entry",
        description: "The entry identifier is invalid. Please refresh the page and try again.",
        variant: "destructive",
      })
      return
    }

    try {
      await deleteTimesheetEntry(numericId)
      setBillableEntries((prev) => prev.filter((entry) => entry.id !== entryId))
      setSelectedEntries((prev) => prev.filter((id) => id !== entryId))
      await handleRefreshBillableEntries()
      toast({
        title: "Timesheet entry deleted",
        description: "The entry has been removed from the invoicing list.",
      })
    } catch (error) {
      console.error("Failed to delete timesheet entry:", error)
      toast({
        title: "Unable to delete entry",
        description: "We couldn't remove that entry. Please refresh and try again.",
        variant: "destructive",
      })
    }
  }

  const handleExportRecurringServices = async () => {
    const servicesToExport = filteredRecurringServices

    if (servicesToExport.length === 0) {
      toast({
        title: "No recurring services",
        description: "Adjust your filters or capture recurring services before exporting.",
      })
      return
    }

    setExportingRecurringServices(true)
    try {
      const now = new Date()
      const previousDate = format(now, "yyyy-MM-dd")
      const nextDate = format(addMonths(now, 1), "yyyy-MM-dd")

      await Promise.all(
        servicesToExport.map((service) =>
          updateClientRecurringService(service.id, {
            previous_date: previousDate,
            next_date: nextDate,
          }),
        ),
      )

      const refreshedServices = await getAllClientRecurringServices()
      setClientRecurringServices(refreshedServices)

      const headers = [
        "Client",
        "Service",
        "Xero Item Code",
        "Previous Date",
        "Next Date",
        "Frequency",
        "Quantity",
        "Amount",
        "Active",
        "Notes",
      ]

      const escapeCsv = (value: string | number | null | undefined) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`

      const rows = servicesToExport.map((service) => [
        service.client_name ?? "",
        service.service_name ?? service.xero_item_code ?? "",
        service.xero_item_code ?? "",
        previousDate,
        nextDate,
        service.frequency ?? "",
        Number.isFinite(service.quantity) ? service.quantity : "",
        service.amount ?? "",
        service.active ? "Active" : "Inactive",
        service.notes ?? "",
      ])

      const csvContent = [headers, ...rows]
        .map((row) => row.map((value) => escapeCsv(value)).join(","))
        .join("\r\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `recurring-services-${format(now, "yyyyMMdd")}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Recurring services exported",
        description: "Next billing dates have been updated and the CSV file has been downloaded.",
      })
    } catch (error) {
      console.error("Error exporting recurring services:", error)
      toast({
        title: "Export failed",
        description: "Unable to export recurring services. Please try again.",
        variant: "destructive",
      })
    } finally {
      setExportingRecurringServices(false)
    }
  }

  const handleRecurringDraftChange = (
    serviceId: string,
    field: "amount" | "active" | "quantity",
    value: string | boolean,
  ) => {
    setRecurringServiceDrafts((prev) => {
      const service = findRecurringServiceById(serviceId)
      const existing =
        prev[serviceId] ??
        {
          amount: amountToInputValue(service?.amount),
          active: Boolean(service?.active),
          quantity: quantityToInputValue(service?.quantity),
        }
      const next: RecurringServiceDraftState =
        field === "amount"
          ? { ...existing, amount: value as string }
          : field === "quantity"
            ? { ...existing, quantity: value as string }
            : { ...existing, active: value as boolean }
      return { ...prev, [serviceId]: next }
    })
  }

  const handleResetRecurringDraft = (serviceId: string) => {
    const service = findRecurringServiceById(serviceId)
    if (!service) return
    setRecurringServiceDrafts((prev) => ({
      ...prev,
      [serviceId]: {
        amount: amountToInputValue(service.amount),
        active: Boolean(service.active),
        quantity: quantityToInputValue(service.quantity),
      },
    }))
  }

  const handleSaveRecurringService = async (serviceId: string) => {
    const service = findRecurringServiceById(serviceId)
    const draft = recurringServiceDrafts[serviceId]
    if (!service || !draft) return

    const parsedAmount = parseAmountInput(draft.amount)
    if (Number.isNaN(parsedAmount)) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid numeric amount.",
        variant: "destructive",
      })
      return
    }

    const parsedQuantity = parseQuantityInput(draft.quantity)
    if (Number.isNaN(parsedQuantity) || (parsedQuantity !== null && parsedQuantity < 0)) {
      toast({
        title: "Invalid quantity",
        description: "Quantity must be zero or a positive number.",
        variant: "destructive",
      })
      return
    }

    setSavingRecurringServiceId(serviceId)
    try {
      const updated = await updateClientRecurringService(serviceId, {
        amount: parsedAmount,
        active: draft.active,
        quantity: parsedQuantity ?? service.quantity ?? 0,
      })

      setClientRecurringServices((prev) => prev.map((entry) => (entry.id === serviceId ? updated : entry)))
      setRecurringServiceDrafts((prev) => ({
        ...prev,
        [serviceId]: {
          amount: amountToInputValue(updated.amount),
          active: Boolean(updated.active),
          quantity: quantityToInputValue(updated.quantity),
        },
      }))

      toast({
        title: "Recurring service updated",
        description: "The recurring charge details were saved.",
      })
    } catch (error) {
      console.error("Error updating recurring service:", error)
      toast({
        title: "Unable to save recurring service",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingRecurringServiceId(null)
    }
  }

  const handleCancelRetainerInvoice = () => {
    setCreatingRetainerInvoice(false)
  }

  const handleCancelSubContractorInvoice = () => {
    setCreatingSubContractorInvoice(false)
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice)
  }

  const handleCloseViewInvoice = () => {
    setViewingInvoice(null)
  }

  const handleRefreshData = () => {
    if (user?.id) {
      handleRefreshBillableEntries()
      loadRecurringServices()
      loadExportedEntries()
      const loadData = async () => {
        const rawInvoices = await getInvoices(user.id)
        const transformedInvoices: Invoice[] = rawInvoices.map((raw: InvoiceRaw) => ({
          id: raw.uid || "",
          invoiceNumber: raw.invoice_number,
          clientName: raw.bill_to,
          issueDate: raw.inv_date,
          dueDate: raw.due_date,
          entries: [],
          subtotal: raw.inv_total,
          taxRate: 0,
          taxAmount: 0,
          total: raw.inv_total,
          status: (raw.status as "Draft" | "Sent" | "Paid" | "Overdue" | "Pending Approval") || "Draft",
          createdBy: raw.created_by,
          createdAt: raw.created_at || new Date().toISOString(),
        }))
        setInvoices(transformedInvoices)

        const { getDraftInvoices } = await import("./lib/supabase")
        const pendingInvoices = await getDraftInvoices(user.id, user.role === "admin")
        setPendingApprovalCount(pendingInvoices.length)
      }
      loadData()
    }
  }

  const handleRefreshBillableEntries = async () => {
    if (!user?.id) return

    try {
      const entries = await getTimesheetEntriesForInvoicing(user.id, user.role === "admin")
      setBillableEntries(entries)
    } catch (error) {
      console.error("Error refreshing timesheet entries:", error)
    }
  }

  const handlePendingEntriesExported = async (exportedEntryIds: string[]) => {
    if (!exportedEntryIds.length) return

    const timesheetIds = exportedEntryIds.filter((id) => /^\d+$/.test(id))

    if (timesheetIds.length > 0) {
      setBillableEntries((prev) => prev.filter((entry) => !timesheetIds.includes(entry.id)))
    }

    await handleRefreshBillableEntries()
    await loadRecurringServices()
    await loadExportedEntries()
  }

  const handleDuplicateRetainerTimesheetEntry = async (entry: BillingEntry) => {
    try {
      const originalDate = new Date(entry.date)
      if (Number.isNaN(originalDate.getTime())) {
        throw new Error(`Invalid entry date for timesheet ${entry.id}`)
      }

      const duplicateDate = format(addMonths(originalDate, 1), "yyyy-MM-dd")
      await duplicateTimesheetEntryWithNewDate(Number.parseInt(entry.id, 10), duplicateDate)

      toast({
        title: "Retainer entry duplicated",
        description: `Created a copy dated ${duplicateDate}.`,
      })

      await handleRefreshBillableEntries()
    } catch (error) {
      console.error("Error duplicating retainer entry:", error)
      toast({
        title: "Failed to duplicate entry",
        description: "We couldn't create the retainer entry. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  if (viewingInvoice) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <InvoicePreview
          clientName={viewingInvoice.clientName}
          entries={viewingInvoice.entries}
          onSave={() => { }}
          onCancel={handleCloseViewInvoice}
          invoiceId={viewingInvoice.id}
          invoiceStatus={viewingInvoice.status}
        />
      </div>
    )
  }

  if (creatingRetainerInvoice) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <RetainerInvoiceCreator onSave={handleSaveRetainerInvoice} onCancel={handleCancelRetainerInvoice} />
      </div>
    )
  }

  if (creatingSubContractorInvoice) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <RetainerInvoiceCreator
          onSave={handleSaveSubContractorInvoice}
          onCancel={handleCancelSubContractorInvoice}
          invoiceType="subcontractor"
        />
      </div>
    )
  }

  if (currentInvoice) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <InvoicePreview
          clientName={currentInvoice.clientName}
          entries={currentInvoice.entries}
          onSave={handleSaveInvoice}
          onCancel={handleCancelInvoice}
          isEditing={currentInvoice.isEditing}
          invoiceId={currentInvoice.invoiceId}
          onRefreshBillableEntries={handleRefreshBillableEntries}
          invoiceType={currentInvoice.type}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-green-800 to-emerald-800 bg-clip-text text-transparent">
              Invoicing
            </h1>
            <p className="text-slate-600 text-lg">Create and manage client invoices from billable hours</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="bg-white/70 backdrop-blur-sm border shadow-sm">
          <TabsTrigger
            value="create"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Invoices</span>
          </TabsTrigger>
          <TabsTrigger
            value="retainer"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <Receipt className="h-4 w-4" />
            <span>Recurring Service Items</span>
          </TabsTrigger>
          {user?.role === "admin" && (
            <TabsTrigger
              value="subcontractor"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>Sub-Contractor Invoices</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="drafts"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <Edit className="h-4 w-4" />
            <span>Pending Approval</span>
            {pendingApprovalCount > 0 && (
              <span className="ml-2 rounded-full bg-orange-100 text-orange-600 px-2 py-0.5 text-xs font-medium">
                {pendingApprovalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="finalised"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <List className="h-4 w-4" />
            <span>Finalised Invoices</span>
            {exportedEntries.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 text-blue-600 px-2 py-0.5 text-xs font-medium">
                {exportedEntries.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p>Loading billable entries...</p>
            </div>
          ) : (
            <BillableEntriesSelector
              billableEntries={regularBillableEntries}
              selectedEntries={selectedEntries}
              onSelectionChange={setSelectedEntries}
              onGenerateInvoice={handleGenerateInvoice}
              showUserColumn={user?.role === "admin"}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onUpdateEntry={handleInlineUpdateEntry}
              onDeleteEntry={handleDeleteBillableEntry}
            />
          )}
        </TabsContent>

        <TabsContent value="retainer" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p>Loading retainer entries...</p>
            </div>
          ) : (
            <>
              <BillableEntriesSelector
                billableEntries={recurringBillableEntries}
                selectedEntries={selectedRecurringEntries}
                onSelectionChange={setSelectedRecurringEntries}
                onGenerateInvoice={handleGenerateRetainerInvoice}
                showUserColumn={user?.role === "admin"}
                statusFilter={recurringStatusFilter}
                onStatusFilterChange={setRecurringStatusFilter}
                statusFilterOptions={["Recurring"]}
                onUpdateEntry={handleInlineUpdateEntry}
                showRetainerStatus
                showRecurringAmountColumn
                onDuplicateRetainerEntry={handleDuplicateRetainerTimesheetEntry}
                enableServiceFilter
                onFiltersChange={handleRecurringFiltersChange}
                clientFilterOptionsOverride={recurringClientFilterOptions}
                serviceFilterOptionsOverride={recurringServiceFilterOptions}
              />
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="space-y-1">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-900">Assigned Recurring Charges</CardTitle>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <Badge variant="outline" className="w-fit text-xs font-semibold">
                        Total {formatCurrencyValue(totalRecurringAmount)}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportRecurringServices}
                        disabled={
                          exportingRecurringServices || recurringServicesLoading || filteredRecurringServices.length === 0
                        }
                      >
                        {exportingRecurringServices ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          "Export Recurring Services"
                        )}
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Services listed here are automatically included when generating retainer invoices.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recurringServicesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading recurring charges...
                    </div>
                  ) : recurringServicesByClient.length === 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                      No recurring services captured yet. Assign recurring services from the Manage Clients page.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="mb-4">
                        <PaginationControls
                          currentPage={recurringPage}
                          totalPages={Math.ceil(recurringServicesByClient.length / ITEMS_PER_PAGE)}
                          onPageChange={setRecurringPage}
                          itemName="clients"
                        />
                      </div>
                      {recurringServicesByClient
                        .slice((recurringPage - 1) * ITEMS_PER_PAGE, recurringPage * ITEMS_PER_PAGE)
                        .map((group) => {
                          const groupTotal = group.services.reduce((sum, service) => sum + (service.amount ?? 0), 0)
                          return (
                            <div key={group.clientId} className="rounded-lg border border-slate-200">
                              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="font-semibold text-slate-900">{group.clientName}</p>
                                  <p className="text-xs text-slate-500">
                                    {group.services.length} {group.services.length === 1 ? "recurring service" : "recurring services"}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="w-fit">
                                  {formatCurrencyValue(groupTotal)}
                                </Badge>
                              </div>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Service</TableHead>
                                      <TableHead>Previous Date</TableHead>
                                      <TableHead>Frequency</TableHead>
                                      <TableHead>Next Date</TableHead>
                                      <TableHead className="text-right">Quantity</TableHead>
                                      <TableHead className="text-right">Amount</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Notes</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.services.map((service) => {
                                      const draft =
                                        recurringServiceDrafts[service.id] ??
                                        {
                                          amount: amountToInputValue(service.amount),
                                          active: Boolean(service.active),
                                        }
                                      const parsedAmountRaw = parseAmountInput(draft.amount)
                                      const amountError = Number.isNaN(parsedAmountRaw)
                                      const parsedAmount = amountError ? null : (parsedAmountRaw as number | null)
                                      const parsedQuantityRaw = parseQuantityInput(draft.quantity)
                                      const quantityError = Number.isNaN(parsedQuantityRaw)
                                      const parsedQuantity = quantityError ? null : (parsedQuantityRaw as number | null)
                                      const amountChanged =
                                        !amountError && !amountsEqual(parsedAmount, service.amount ?? null)
                                      const quantityChanged =
                                        !quantityError &&
                                        (parsedQuantity ?? 0) !==
                                        (Number.isFinite(Number(service.quantity)) ? Number(service.quantity) : 0)
                                      const activeChanged = draft.active !== service.active
                                      const hasChanges = amountChanged || activeChanged || quantityChanged
                                      const canSave =
                                        hasChanges &&
                                        !amountError &&
                                        !quantityError &&
                                        savingRecurringServiceId !== service.id
                                      const showReset = hasChanges || amountError || quantityError

                                      return (
                                        <TableRow key={service.id}>
                                          <TableCell>
                                            <div className="font-medium text-slate-900">
                                              {service.service_name || "Service item"}
                                            </div>
                                            <div className="text-xs text-slate-500">{service.xero_item_code}</div>
                                          </TableCell>
                                          <TableCell>{formatDateLabel(service.previous_date)}</TableCell>
                                          <TableCell>{service.frequency || "-"}</TableCell>
                                          <TableCell>{formatDateLabel(service.next_date)}</TableCell>
                                          <TableCell className="text-right">
                                            <Input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={draft.quantity}
                                              onChange={(event) =>
                                                handleRecurringDraftChange(service.id, "quantity", event.target.value)
                                              }
                                              disabled={savingRecurringServiceId === service.id}
                                              className={`h-9 w-24 text-right ${quantityError ? "border-red-500 focus-visible:ring-red-500" : ""
                                                }`}
                                            />
                                          </TableCell>
                                          <TableCell className="align-top text-right">
                                            <div className="flex flex-col items-end gap-1">
                                              <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={draft.amount}
                                                onChange={(event) =>
                                                  handleRecurringDraftChange(service.id, "amount", event.target.value)
                                                }
                                                disabled={savingRecurringServiceId === service.id}
                                                className={`h-9 w-32 text-right ${amountError ? "border-red-500 focus-visible:ring-red-500" : ""
                                                  }`}
                                              />
                                              {amountError && (
                                                <span className="text-xs text-red-600">Enter a valid amount</span>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className="align-top">
                                            <div className="flex items-center gap-3">
                                              <Badge
                                                className={
                                                  draft.active
                                                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                                    : "bg-gradient-to-r from-slate-400 to-slate-500 text-white"
                                                }
                                              >
                                                {draft.active ? "Active" : "Inactive"}
                                              </Badge>
                                              <Select
                                                value={draft.active ? "active" : "inactive"}
                                                onValueChange={(value) =>
                                                  handleRecurringDraftChange(service.id, "active", value === "active")
                                                }
                                                disabled={savingRecurringServiceId === service.id}
                                              >
                                                <SelectTrigger className="h-9 w-32">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="active">Active</SelectItem>
                                                  <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </TableCell>
                                          <TableCell className="max-w-xs text-sm text-slate-600">
                                            {service.notes ? (
                                              <span className="line-clamp-2">{service.notes}</span>
                                            ) : (
                                              "-"
                                            )}
                                          </TableCell>
                                          <TableCell className="align-top text-right">
                                            <div className="flex justify-end gap-2">
                                              <Button
                                                size="sm"
                                                onClick={() => handleSaveRecurringService(service.id)}
                                                disabled={!canSave}
                                              >
                                                {savingRecurringServiceId === service.id ? (
                                                  <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Saving...
                                                  </>
                                                ) : (
                                                  "Save"
                                                )}
                                              </Button>
                                              {showReset && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => handleResetRecurringDraft(service.id)}
                                                  disabled={savingRecurringServiceId === service.id}
                                                >
                                                  Reset
                                                </Button>
                                              )}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button
                  onClick={handleCreateRetainerInvoice}
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Custom Retainer Invoice
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {user?.role === "admin" && (
          <TabsContent value="subcontractor" className="space-y-4">
            <SubContractorInvoices
              onRefresh={handleRefreshData}
              onCreateNewInvoice={handleCreateSubContractorInvoice}
            />
          </TabsContent>
        )}

        <TabsContent value="drafts" className="space-y-4">
          <PendingApprovalEntries
            entries={billablePendingEntries}
            loading={loading}
            onUpdateEntry={handleInlineUpdateEntry}
            onEntriesExported={handlePendingEntriesExported}
          />
          <DraftInvoiceList onEditInvoice={handleEditDraftInvoice} onRefresh={handleRefreshData} />
        </TabsContent>

        <TabsContent value="finalised" className="space-y-4">
          <ExportedEntriesView entries={exportedEntries} loading={exportedEntriesLoading} />
        </TabsContent>

      </Tabs>
    </div>
  )
}
