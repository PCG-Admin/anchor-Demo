"use client"

import { useState, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users,
  Edit,
  Trash2,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Calendar,
  UserPlus,
  Loader2,
  Building2,
  Repeat2,
  Check,
} from "lucide-react"
import {
  getSupabaseClients,
  updateClientInSupabase,
  deleteClientFromSupabase,
  addClientToSupabase,
} from "@/lib/supabase-client-storage"
import type { ClientInfo } from "@/types/invoice"
import type { ServiceItem } from "@/types/billing"
import type { ClientRecurringService } from "@/lib/supabase"
import {
  getServiceItems,
  getClientRecurringServices,
  createClientRecurringService,
  updateClientRecurringService,
  deleteClientRecurringService,
} from "@/lib/supabase"
import { sanitizeInput } from "@/lib/validation-utils"
import { EnhancedFormWrapper } from "@/components/enhanced-form-wrapper"

import { PaginationControls } from "@/components/pagination-controls"

const ITEMS_PER_PAGE = 20

interface ClientWithId extends ClientInfo {
  id?: string
  created_at?: string
  bill_to?: string // Changed from number to string to store client name directly
  bill_to_client_name?: string
}

interface RecurringServiceFormState {
  xero_item_code: string
  previous_date: string
  frequency: string
  quantity: number
  notes: string
  active: boolean
  amount: number | null
  next_date?: string | null
}

interface RecurringServiceDraft extends RecurringServiceFormState {
  tempId: string
}

const addClientFormSchema = z.object({
  name: z.string().min(2, "Client name must be at least 2 characters.").max(100, "Client name too long."),
  address: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  bill_to: z.string().optional(),
})

type AddClientFormValues = z.infer<typeof addClientFormSchema>

const DEFAULT_RECURRING_FREQUENCY = "Recurring" as const

const withRecurringFrequency = <T extends { frequency?: string | null }>(service: T): T => ({
  ...service,
  frequency: service.frequency ?? DEFAULT_RECURRING_FREQUENCY,
})

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  return `R ${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const createRecurringServiceDraft = (): RecurringServiceFormState => ({
  xero_item_code: "",
  previous_date: new Date().toISOString().split("T")[0],
  frequency: DEFAULT_RECURRING_FREQUENCY,
  quantity: 1,
  notes: "",
  active: true,
  amount: null,
  next_date: null,
})

const normaliseAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null
  }

  return Number(Number(value).toFixed(2))
}

export function ManageClientsPage() {
  const [clients, setClients] = useState<ClientWithId[]>([])
  const [filteredClients, setFilteredClients] = useState<ClientWithId[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [editingClient, setEditingClient] = useState<ClientWithId | null>(null)
  const [originalEditingClient, setOriginalEditingClient] = useState<ClientWithId | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<ClientWithId | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isAddingClient, setIsAddingClient] = useState(false)
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([])
  const [serviceItemsLoading, setServiceItemsLoading] = useState(false)
  const [serviceItemsError, setServiceItemsError] = useState<string | null>(null)
  const [pendingRecurringServices, setPendingRecurringServices] = useState<RecurringServiceDraft[]>([])
  const [newClientRecurringDraft, setNewClientRecurringDraft] = useState<RecurringServiceFormState>(
    createRecurringServiceDraft(),
  )
  const [clientPage, setClientPage] = useState(1)
  const [clientRecurringServices, setClientRecurringServices] = useState<ClientRecurringService[]>([])
  const [clientRecurringServicesLoading, setClientRecurringServicesLoading] = useState(false)
  const [dirtyServiceIds, setDirtyServiceIds] = useState<string[]>([])
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null)
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null)
  const [isCreatingClientService, setIsCreatingClientService] = useState(false)
  const [editDialogNewServiceDraft, setEditDialogNewServiceDraft] = useState<RecurringServiceFormState>(
    createRecurringServiceDraft(),
  )

  const serviceItemMap = useMemo(() => {
    const lookup = new Map<string, ServiceItem>()
    serviceItems.forEach((item) => lookup.set(item.code, item))
    return lookup
  }, [serviceItems])

  const addClientForm = useForm<AddClientFormValues>({
    resolver: zodResolver(addClientFormSchema),
    defaultValues: {
      name: "",
      address: "",
      email: "",
      phone: "",
      bill_to: "", // Updated default value to be a non-empty string
    },
  })

  const watchedClientName = addClientForm.watch("name")

  useEffect(() => {
    if (watchedClientName && watchedClientName.trim() !== "") {
      addClientForm.setValue("bill_to", watchedClientName)
    }
  }, [watchedClientName, addClientForm])

  // Load clients on component mount
  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    const loadServiceItemsList = async () => {
      try {
        setServiceItemsLoading(true)
        setServiceItemsError(null)
        const items = await getServiceItems()
        setServiceItems(items)
      } catch (error) {
        console.error("Error loading service items:", error)
        setServiceItemsError("Failed to load service items")
      } finally {
        setServiceItemsLoading(false)
      }
    }

    loadServiceItemsList()
  }, [])

  useEffect(() => {
    if (!isAddDialogOpen) {
      setPendingRecurringServices([])
      setNewClientRecurringDraft(createRecurringServiceDraft())
    }
  }, [isAddDialogOpen])

  useEffect(() => {
    const clientId = editingClient?.id
    if (isEditDialogOpen && clientId) {
      const loadRecurringServices = async () => {
        try {
          setClientRecurringServicesLoading(true)
          const assignments = await getClientRecurringServices(clientId)
          setClientRecurringServices(assignments.map(withRecurringFrequency))
          setDirtyServiceIds([])
        } catch (error) {
          console.error("Error loading client recurring services:", error)
          toast({
            title: "Unable to load recurring services",
            description: "Please refresh the page or try again later.",
            variant: "destructive",
          })
        } finally {
          setClientRecurringServicesLoading(false)
        }
      }

      loadRecurringServices()
    } else if (!isEditDialogOpen) {
      setClientRecurringServices([])
      setDirtyServiceIds([])
      setUpdatingServiceId(null)
      setDeletingServiceId(null)
      setEditDialogNewServiceDraft(createRecurringServiceDraft())
    }
  }, [isEditDialogOpen, editingClient?.id])

  // Filter clients based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredClients(clients)
    } else {
      const filtered = clients.filter(
        (client) =>
          client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.address.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredClients(filtered)
    }
    setClientPage(1)
  }, [clients, searchTerm])

  const loadClients = async () => {
    try {
      setIsLoading(true)
      const clientsData = await getSupabaseClients()
      setClients(clientsData)
    } catch (error) {
      console.error("Error loading clients:", error)
      toast({
        title: "Error Loading Clients",
        description: "Failed to load client data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getSuggestedAmountForService = (code: string, quantity: number) => {
    const item = serviceItemMap.get(code)
    if (!item) return null

    const total = Number(item.rate) * quantity
    return Number.isFinite(total) ? Number(total.toFixed(2)) : null
  }

  const markServiceDirty = (serviceId: string) => {
    setDirtyServiceIds((prev) => (prev.includes(serviceId) ? prev : [...prev, serviceId]))
  }

  const clearServiceDirty = (serviceId: string) => {
    setDirtyServiceIds((prev) => prev.filter((id) => id !== serviceId))
  }

  const handlePendingServiceSelect = (value: string) => {
    setNewClientRecurringDraft((prev) => {
      const suggested = getSuggestedAmountForService(value, prev.quantity)
      return {
        ...prev,
        xero_item_code: value,
        amount: prev.amount ?? normaliseAmount(suggested),
      }
    })
  }

  const handlePendingQuantityChange = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue)
    const quantity = Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 1
    setNewClientRecurringDraft((prev) => ({
      ...prev,
      quantity,
    }))
  }

  const handlePendingAmountChange = (rawValue: string) => {
    if (rawValue === "") {
      setNewClientRecurringDraft((prev) => ({ ...prev, amount: null }))
      return
    }

    const parsed = Number.parseFloat(rawValue)
    setNewClientRecurringDraft((prev) => ({ ...prev, amount: normaliseAmount(parsed) }))
  }

  const handlePendingRecurringServiceAdd = () => {
    if (!newClientRecurringDraft.xero_item_code) {
      toast({
        title: "Select a service item",
        description: "Choose a service item before adding a recurring assignment.",
        variant: "destructive",
      })
      return
    }

    const draftAmount =
      newClientRecurringDraft.amount ?? getSuggestedAmountForService(newClientRecurringDraft.xero_item_code, newClientRecurringDraft.quantity)

    const tempId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)

    const draft: RecurringServiceDraft = {
      tempId,
      ...newClientRecurringDraft,
      frequency: DEFAULT_RECURRING_FREQUENCY,
      amount: normaliseAmount(draftAmount),
    }

    setPendingRecurringServices((prev) => [...prev, withRecurringFrequency(draft)])
    setNewClientRecurringDraft(createRecurringServiceDraft())
  }

  const handlePendingRecurringServiceRemove = (tempId: string) => {
    setPendingRecurringServices((prev) => prev.filter((service) => service.tempId !== tempId))
  }

  const handleExistingServiceChange = <Key extends keyof ClientRecurringService>(
    serviceId: string,
    field: Key,
    value: ClientRecurringService[Key],
  ) => {
    setClientRecurringServices((prev) =>
      prev.map((service) => (service.id === serviceId ? { ...service, [field]: value } : service)),
    )
    markServiceDirty(serviceId)
  }

  const handleExistingServiceAmountChange = (serviceId: string, rawValue: string) => {
    const parsed = rawValue === "" ? null : normaliseAmount(Number.parseFloat(rawValue))
    handleExistingServiceChange(serviceId, "amount", parsed as ClientRecurringService["amount"])
  }

  const handleExistingServiceQuantityChange = (serviceId: string, rawValue: string) => {
    const parsed = Number.parseFloat(rawValue)
    const quantity = Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 1
    handleExistingServiceChange(serviceId, "quantity", quantity as ClientRecurringService["quantity"])
  }

  const handleSaveRecurringService = async (serviceId: string) => {
    const service = clientRecurringServices.find((entry) => entry.id === serviceId)
    if (!service) return

    setUpdatingServiceId(serviceId)
    try {
      const updated = await updateClientRecurringService(serviceId, {
        xero_item_code: service.xero_item_code,
        previous_date: service.previous_date,
        frequency: DEFAULT_RECURRING_FREQUENCY,
        quantity: service.quantity,
        notes: service.notes,
        active: service.active,
        amount: normaliseAmount(service.amount),
      })

      setClientRecurringServices((prev) =>
        prev.map((entry) => (entry.id === serviceId ? withRecurringFrequency(updated) : entry)),
      )
      clearServiceDirty(serviceId)
      toast({
        title: "Recurring charge updated",
        description: `${service.client_name || "Client"}'s recurring service was saved.`,
      })
    } catch (error: any) {
      console.error("Error saving recurring service:", error)
      toast({
        title: "Unable to update recurring charge",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdatingServiceId(null)
    }
  }

  const handleDeleteRecurringService = async (serviceId: string) => {
    setDeletingServiceId(serviceId)
    try {
      await deleteClientRecurringService(serviceId)
      setClientRecurringServices((prev) => prev.filter((service) => service.id !== serviceId))
      clearServiceDirty(serviceId)
      toast({
        title: "Recurring service removed",
        description: "The recurring charge has been deleted.",
      })
    } catch (error: any) {
      console.error("Error deleting recurring service:", error)
      toast({
        title: "Unable to delete recurring service",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingServiceId(null)
    }
  }

  const handleEditDialogDraftChange = <Key extends keyof RecurringServiceFormState>(
    field: Key,
    value: RecurringServiceFormState[Key],
  ) => {
    setEditDialogNewServiceDraft((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleEditDialogServiceSelect = (value: string) => {
    setEditDialogNewServiceDraft((prev) => {
      const suggested = getSuggestedAmountForService(value, prev.quantity)
      return {
        ...prev,
        xero_item_code: value,
        amount: prev.amount ?? normaliseAmount(suggested),
      }
    })
  }

  const handleEditDialogQuantityChange = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue)
    const quantity = Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 1
    setEditDialogNewServiceDraft((prev) => ({
      ...prev,
      quantity,
    }))
  }

  const handleEditDialogAmountChange = (rawValue: string) => {
    if (rawValue === "") {
      setEditDialogNewServiceDraft((prev) => ({ ...prev, amount: null }))
      return
    }

    const parsed = Number.parseFloat(rawValue)
    setEditDialogNewServiceDraft((prev) => ({ ...prev, amount: normaliseAmount(parsed) }))
  }

  const handleCreateRecurringServiceForClient = async () => {
    if (!editingClient?.id) {
      toast({
        title: "Client not ready",
        description: "Save the client details before adding recurring services.",
        variant: "destructive",
      })
      return
    }

    if (!editDialogNewServiceDraft.xero_item_code) {
      toast({
        title: "Select a service item",
        description: "Choose which service item to assign before saving.",
        variant: "destructive",
      })
      return
    }

    setIsCreatingClientService(true)
    try {
      const created = await createClientRecurringService({
        client_id: editingClient.id,
        xero_item_code: editDialogNewServiceDraft.xero_item_code,
        previous_date: editDialogNewServiceDraft.previous_date,
        frequency: DEFAULT_RECURRING_FREQUENCY,
        quantity: editDialogNewServiceDraft.quantity,
        notes: editDialogNewServiceDraft.notes || null,
        active: editDialogNewServiceDraft.active,
        amount:
          editDialogNewServiceDraft.amount ?? getSuggestedAmountForService(editDialogNewServiceDraft.xero_item_code, editDialogNewServiceDraft.quantity),
        next_date: editDialogNewServiceDraft.next_date ?? null,
      })

      setClientRecurringServices((prev) => [...prev, withRecurringFrequency(created)])
      setEditDialogNewServiceDraft(createRecurringServiceDraft())
      toast({
        title: "Recurring service added",
        description: "The recurring charge has been assigned to the client.",
      })
    } catch (error: any) {
      console.error("Error creating recurring service:", error)
      toast({
        title: "Unable to add recurring service",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingClientService(false)
    }
  }

  const handleAddClient = async (values: AddClientFormValues) => {
    setIsAddingClient(true)
    try {
      const sanitizedValues = {
        ...values,
        name: sanitizeInput(values.name),
        address: values.address ? sanitizeInput(values.address) : undefined,
        email: values.email ? sanitizeInput(values.email.toLowerCase()) : undefined,
        phone: values.phone ? sanitizeInput(values.phone) : undefined,
      }

      const newClient: ClientInfo & { bill_to?: string } = {
        name: sanitizedValues.name,
        address: sanitizedValues.address,
        email: sanitizedValues.email,
        phone: sanitizedValues.phone,
        bill_to: values.bill_to,
      }

      const clientId = await addClientToSupabase(newClient)

      if (pendingRecurringServices.length > 0) {
        try {
          await Promise.all(
            pendingRecurringServices.map((service) =>
              createClientRecurringService({
                client_id: clientId,
                xero_item_code: service.xero_item_code,
                previous_date: service.previous_date,
                frequency: DEFAULT_RECURRING_FREQUENCY,
                quantity: service.quantity,
                notes: service.notes || null,
                active: service.active,
                amount:
                  service.amount ??
                  getSuggestedAmountForService(service.xero_item_code, service.quantity) ??
                  null,
                next_date: service.next_date ?? null,
              }),
            ),
          )
        } catch (error) {
          console.error("Error creating recurring services for client:", error)
          toast({
            title: "Client added, but recurring charges failed",
            description:
              "The client was created, but some recurring services could not be assigned. Please edit the client to retry.",
            variant: "destructive",
          })
        }
      }

      // Reload clients to get the new one
      await loadClients()

      addClientForm.reset()
      setIsAddDialogOpen(false)
      setPendingRecurringServices([])
      setNewClientRecurringDraft(createRecurringServiceDraft())

      toast({
        title: "Client Added Successfully!",
        description: `${newClient.name} has been added to your client database.`,
      })
    } catch (error: any) {
      console.error("Error adding client:", error)
      toast({
        title: "Failed to Add Client",
        description:
          error.message || "Unable to save client information. Please verify all fields are correct and try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingClient(false)
    }
  }

  const handleEditClient = (client: ClientWithId) => {
    setEditingClient({ ...client })
    setOriginalEditingClient({ ...client })
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingClient || !originalEditingClient) return

    try {
      const recurringOperations: Promise<void>[] = []

      if (editingClient.id) {
        const hasNewServiceDraft = Boolean(editDialogNewServiceDraft.xero_item_code)

        if (hasNewServiceDraft) {
          const payload = {
            client_id: editingClient.id,
            xero_item_code: editDialogNewServiceDraft.xero_item_code,
            previous_date: editDialogNewServiceDraft.previous_date,
            frequency: DEFAULT_RECURRING_FREQUENCY,
            quantity: editDialogNewServiceDraft.quantity,
            notes: editDialogNewServiceDraft.notes || null,
            active: editDialogNewServiceDraft.active,
            amount:
              editDialogNewServiceDraft.amount ??
              getSuggestedAmountForService(
                editDialogNewServiceDraft.xero_item_code,
                editDialogNewServiceDraft.quantity,
              ) ??
              null,
          }

          recurringOperations.push(
            createClientRecurringService(payload).then(() => {
              // no-op here, we'll refresh list after all operations
            }),
          )
        }

        dirtyServiceIds.forEach((serviceId) => {
          const service = clientRecurringServices.find((entry) => entry.id === serviceId)
          if (!service) return

          recurringOperations.push(
            updateClientRecurringService(serviceId, {
              xero_item_code: service.xero_item_code,
              previous_date: service.previous_date,
              frequency: DEFAULT_RECURRING_FREQUENCY,
              quantity: service.quantity,
              notes: service.notes || null,
              active: service.active,
              amount:
                service.amount ??
                getSuggestedAmountForService(service.xero_item_code, service.quantity) ??
                null,
            }).then(() => {
              // handled after refresh
            }),
          )
        })

        if (recurringOperations.length > 0) {
          await Promise.all(recurringOperations)
          const refreshedServices = await getClientRecurringServices(editingClient.id)
          setClientRecurringServices(refreshedServices.map(withRecurringFrequency))
          setDirtyServiceIds([])
          setEditDialogNewServiceDraft(createRecurringServiceDraft())
        }
      }

      await updateClientInSupabase(originalEditingClient.name, editingClient)

      setClients(clients.map((c) => (c.name === originalEditingClient.name ? editingClient : c)))

      setIsEditDialogOpen(false)
      setEditingClient(null)
      setOriginalEditingClient(null)

      toast({
        title: "Client Updated",
        description: `${editingClient.name} has been updated successfully.`,
      })
    } catch (error: any) {
      console.error("Error updating client:", error)
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update client. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteClient = (client: ClientWithId) => {
    setClientToDelete(client)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!clientToDelete) return

    try {
      await deleteClientFromSupabase(clientToDelete.name)

      setClients(clients.filter((c) => c.name !== clientToDelete.name))

      setIsDeleteDialogOpen(false)
      setClientToDelete(null)

      toast({
        title: "Client Deleted",
        description: `${clientToDelete.name} has been removed from the system.`,
      })
    } catch (error: any) {
      console.error("Error deleting client:", error)
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete client. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
              Manage Clients
            </h1>
            <p className="text-slate-600 text-lg">Add, view, edit, and manage your client database.</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {" "}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Clients</p>
                  <p className="text-2xl font-bold text-blue-900">{clients.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Clients</p>
                  <p className="text-2xl font-bold text-green-900">{clients.length}</p>
                </div>
                <Badge className="bg-green-500 text-white">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Client Directory</CardTitle>
              <CardDescription>Search and manage your client database</CardDescription>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Client
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Search clients by name, email, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Clients Table */}
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
              <p className="text-slate-500">Loading your clients...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-lg font-medium text-slate-700">No clients found</p>
              <p className="text-sm">
                {searchTerm ? "Try adjusting your search terms" : "Get started by adding your first client"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                <PaginationControls
                  currentPage={clientPage}
                  totalPages={Math.ceil(filteredClients.length / ITEMS_PER_PAGE)}
                  onPageChange={setClientPage}
                  itemName="clients"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="font-semibold text-slate-700">Name</TableHead>
                    <TableHead className="font-semibold text-slate-700">Email</TableHead>
                    <TableHead className="font-semibold text-slate-700">Phone</TableHead>
                    <TableHead className="font-semibold text-slate-700">Address</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients
                    .slice((clientPage - 1) * ITEMS_PER_PAGE, clientPage * ITEMS_PER_PAGE)
                    .map((client, index) => (
                      <TableRow key={index} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {client.email && (
                              <div className="flex items-center text-sm text-slate-600">
                                <Mail className="h-3 w-3 mr-1" />
                                {client.email}
                              </div>
                            )}
                            {client.phone && (
                              <div className="flex items-center text-sm text-slate-600">
                                <Phone className="h-3 w-3 mr-1" />
                                {client.phone}
                              </div>
                            )}
                            {!client.email && !client.phone && (
                              <span className="text-sm text-slate-400">No contact info</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.address ? (
                            <div className="flex items-start text-sm text-slate-600">
                              <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{client.address}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">No address</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-slate-600">
                            <Building2 className="h-3 w-3 mr-1" />
                            {client.bill_to || "Not assigned"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-slate-600">
                            <Calendar className="h-3 w-3 mr-1" />
                            {client.created_at ? new Date(client.created_at).toLocaleDateString() : "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right w-[120px] sticky right-0 bg-white border-l">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClient(client)}
                              className="hover:bg-blue-50 hover:border-blue-200 h-8 w-8 p-0"
                              title="Edit client"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClient(client)}
                              className="hover:bg-red-50 hover:border-red-200 text-red-600 h-8 w-8 p-0"
                              title="Delete client"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <span>Add New Client</span>
            </DialogTitle>
            <DialogDescription>Enter the details for a new client to add them to the database</DialogDescription>
          </DialogHeader>
          <EnhancedFormWrapper
            formId="add-client"
            onSubmit={addClientForm.handleSubmit(handleAddClient)}
            maxSubmissions={3}
            rateLimitWindowMs={300000}
          >
            <Form {...addClientForm}>
              <div className="space-y-4">
                <FormField
                  control={addClientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Acme Corp"
                          value={field.value}
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
                  control={addClientForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Street, City, Postal Code, Country"
                          className="resize-y"
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
                  control={addClientForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="client@example.com"
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
                  control={addClientForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+27 12 345 6789"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^\d+\-$$$$\s]/g, "")
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
                  control={addClientForm.control}
                  name="bill_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill To Client</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select bill to client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="none">None</SelectItem>
                          {/* Show the current client name being added */}
                          {watchedClientName && watchedClientName.trim() !== "" && (
                            <SelectItem value={watchedClientName}>{watchedClientName} (Current)</SelectItem>
                          )}
                          {/* Show all existing clients */}
                          {clients
                            .filter((client) => client.name !== watchedClientName)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((client) => (
                              <SelectItem key={client.name} value={client.name}>
                                {client.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-blue-100 p-2 text-blue-600">
                        <Repeat2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Recurring Service Assignments</p>
                        <p className="text-sm text-slate-600">
                          Assign services that should be billed automatically for this client.
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {pendingRecurringServices.length} {pendingRecurringServices.length === 1 ? "service" : "services"}
                    </Badge>
                  </div>
                  {serviceItemsError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {serviceItemsError}
                    </div>
                  ) : null}
                  {pendingRecurringServices.length === 0 ? (
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      No recurring services assigned yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingRecurringServices.map((service) => {
                        const item = serviceItemMap.get(service.xero_item_code)
                        return (
                          <div
                            key={service.tempId}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {item?.name || "Selected service"}
                                  <span className="ml-2 text-xs text-slate-500">{service.xero_item_code}</span>
                                </p>
                                <p className="text-xs text-slate-500">
                                  Previous Date: {service.previous_date} • {DEFAULT_RECURRING_FREQUENCY}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePendingRecurringServiceRemove(service.tempId)}
                                className="text-slate-500 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove recurring service</span>
                              </Button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                              <span>Quantity: {service.quantity}</span>
                              <span>Amount: {formatCurrency(service.amount)}</span>
                              <span>Status: {service.active ? "Active" : "Inactive"}</span>
                            </div>
                            {service.notes ? (
                              <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                Notes: {service.notes}
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-1">
                      <Label>Service Item *</Label>
                      <Select
                        value={newClientRecurringDraft.xero_item_code}
                        onValueChange={handlePendingServiceSelect}
                        disabled={serviceItemsLoading || serviceItems.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={serviceItemsLoading ? "Loading services..." : "Select service"} />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceItemsLoading ? (
                            <SelectItem value="loading" disabled>
                              Loading...
                            </SelectItem>
                          ) : (
                            serviceItems.map((item) => (
                              <SelectItem key={item.code} value={item.code}>
                                {item.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Label>Previous Date *</Label>
                      <Input
                        type="date"
                        value={newClientRecurringDraft.previous_date}
                        onChange={(event) =>
                          setNewClientRecurringDraft((prev) => ({
                            ...prev,
                            previous_date: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newClientRecurringDraft.quantity}
                        onChange={(event) => handlePendingQuantityChange(event.target.value)}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Label>Amount (R)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newClientRecurringDraft.amount && newClientRecurringDraft.amount !== 0 ? newClientRecurringDraft.amount : ""}
                        onChange={(event) => handlePendingAmountChange(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Checkbox
                        checked={newClientRecurringDraft.active}
                        onCheckedChange={(checked) =>
                          setNewClientRecurringDraft((prev) => ({
                            ...prev,
                            active: Boolean(checked),
                          }))
                        }
                      />
                      <span className="text-sm text-slate-700">Active recurring charge</span>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        rows={2}
                        placeholder="Add any context or invoice notes"
                        value={newClientRecurringDraft.notes}
                        onChange={(event) =>
                          setNewClientRecurringDraft((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePendingRecurringServiceAdd}
                      disabled={
                        serviceItemsLoading ||
                        serviceItems.length === 0 ||
                        isAddingClient ||
                        !newClientRecurringDraft.xero_item_code
                      }
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Add Recurring Service
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isAddingClient}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isAddingClient}>
                    {isAddingClient ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding Client...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Client
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Form>
          </EnhancedFormWrapper>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information below.</DialogDescription>
          </DialogHeader>
          {editingClient && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Client Name</Label>
                <Input
                  id="edit-name"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingClient.email || ""}
                  onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editingClient.phone || ""}
                  onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  value={editingClient.address || ""}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-bill-to">Bill To Client</Label>
                <Select
                  value={editingClient.bill_to || "none"}
                  onValueChange={(value) =>
                    setEditingClient({ ...editingClient, bill_to: value === "none" ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bill to client" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    <SelectItem value="none">None</SelectItem>
                    {clients
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((client) => (
                        <SelectItem key={client.name} value={client.name}>
                          {client.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-blue-100 p-2 text-blue-600">
                      <Repeat2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Recurring Service Assignments</p>
                      <p className="text-sm text-slate-600">
                        Manage the client's retained service items and automated charges.
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {clientRecurringServices.length}{" "}
                    {clientRecurringServices.length === 1 ? "service" : "services"}
                  </Badge>
                </div>
                {clientRecurringServicesLoading ? (
                  <div className="flex items-center justify-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Loading recurring services...
                  </div>
                ) : clientRecurringServices.length === 0 ? (
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    No recurring services captured for this client yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientRecurringServices.map((service) => {
                      const item = serviceItemMap.get(service.xero_item_code)
                      const isDirty = dirtyServiceIds.includes(service.id)
                      const isSaving = updatingServiceId === service.id
                      const isRemoving = deletingServiceId === service.id

                      return (
                        <div
                          key={service.id}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <Label>Service Item</Label>
                              <Select
                                value={service.xero_item_code}
                                onValueChange={(value) => handleExistingServiceChange(service.id, "xero_item_code", value as ClientRecurringService["xero_item_code"])}
                                disabled={isSaving}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select service" />
                                </SelectTrigger>
                                <SelectContent>
                                  {serviceItems.map((option) => (
                                    <SelectItem key={option.code} value={option.code}>
                                      {option.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="mt-1 text-xs text-slate-500">
                                {item?.name || "Current service"} &middot; {service.xero_item_code}
                              </p>
                            </div>
                            <div>
                              <Label>Previous Date</Label>
                              <Input
                                type="date"
                                value={service.previous_date}
                                onChange={(event) =>
                                  handleExistingServiceChange(service.id, "previous_date", event.target.value as ClientRecurringService["previous_date"])
                                }
                                disabled={isSaving}
                              />
                            </div>
                            <div>
                              <Label>Quantity</Label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={service.quantity}
                                onChange={(event) => handleExistingServiceQuantityChange(service.id, event.target.value)}
                                disabled={isSaving}
                              />
                            </div>
                            <div>
                              <Label>Amount (R)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={service.amount && service.amount !== 0 ? service.amount : ""}
                                onChange={(event) => handleExistingServiceAmountChange(service.id, event.target.value)}
                                disabled={isSaving}
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                              <Checkbox
                                checked={service.active}
                                onCheckedChange={(checked) =>
                                  handleExistingServiceChange(service.id, "active", Boolean(checked) as ClientRecurringService["active"])
                                }
                                disabled={isSaving}
                              />
                              <span className="text-sm text-slate-700">Active recurring charge</span>
                            </div>
                            <div className="md:col-span-2">
                              <Label>Notes</Label>
                              <Textarea
                                rows={2}
                                value={service.notes || ""}
                                onChange={(event) =>
                                  handleExistingServiceChange(
                                    service.id,
                                    "notes",
                                    event.target.value as ClientRecurringService["notes"],
                                  )
                                }
                                disabled={isSaving}
                              />
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">
                              Last amount: {formatCurrency(service.amount)} • Quantity {service.quantity}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleSaveRecurringService(service.id)}
                                disabled={!isDirty || isSaving || isRemoving}
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Check className="mr-2 h-3 w-3" />
                                    Save changes
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteRecurringService(service.id)}
                                disabled={isSaving || isRemoving}
                                className="text-red-600 hover:bg-red-50"
                              >
                                {isRemoving ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Removing...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Remove
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-800">Add New Recurring Service</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Service Item *</Label>
                      <Select
                        value={editDialogNewServiceDraft.xero_item_code}
                        onValueChange={handleEditDialogServiceSelect}
                        disabled={isCreatingClientService || serviceItemsLoading || serviceItems.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceItems.map((item) => (
                            <SelectItem key={item.code} value={item.code}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Previous Date *</Label>
                      <Input
                        type="date"
                        value={editDialogNewServiceDraft.previous_date}
                        onChange={(event) => handleEditDialogDraftChange("previous_date", event.target.value)}
                        disabled={isCreatingClientService}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editDialogNewServiceDraft.quantity}
                        onChange={(event) => handleEditDialogQuantityChange(event.target.value)}
                        disabled={isCreatingClientService}
                      />
                    </div>
                    <div>
                      <Label>Amount (R)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editDialogNewServiceDraft.amount ?? ""}
                        onChange={(event) => handleEditDialogAmountChange(event.target.value)}
                        disabled={isCreatingClientService}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Checkbox
                        checked={editDialogNewServiceDraft.active}
                        onCheckedChange={(checked) => handleEditDialogDraftChange("active", Boolean(checked))}
                        disabled={isCreatingClientService}
                      />
                      <span className="text-sm text-slate-700">Active recurring charge</span>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        rows={2}
                        placeholder="Add any context or invoice notes"
                        value={editDialogNewServiceDraft.notes}
                        onChange={(event) => handleEditDialogDraftChange("notes", event.target.value)}
                        disabled={isCreatingClientService}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateRecurringServiceForClient}
                      disabled={
                        isCreatingClientService ||
                        serviceItems.length === 0 ||
                        !editDialogNewServiceDraft.xero_item_code
                      }
                    >
                      {isCreatingClientService ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-3 w-3" />
                          Add service
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false)
                    setEditingClient(null)
                    setOriginalEditingClient(null)
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} className="bg-blue-500 hover:bg-blue-600">
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{clientToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Client
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}
