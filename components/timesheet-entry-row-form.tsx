"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { useFormContext } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getServiceItems, type ServiceItem, getOrCreateClientId } from "@/lib/supabase"
import { getSupabaseClients } from "@/lib/supabase-client-storage"
import type { ClientInfo } from "../types/invoice"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  activity: z.enum(["External", "Internal", "Sub-Contractor"], {
    required_error: "Please select an activity type",
  }),
  clientName: z.string({
    required_error: "Please select a client",
  }),
  itemName: z.string({
    required_error: "Please select a service item",
  }),
  hours: z
    .number({
      required_error: "Hours is required",
      invalid_type_error: "Hours must be a number",
    })
    .positive("Hours must be positive"),
  billable: z.enum(["Billable", "Not Billable", "Work in Progress", "Recurring"], {
    required_error: "Please select billable status",
  }),
  standardItemFee: z.number(),
  ratePerHour: z.number(),
  total: z.number(),
  comments: z.string().optional(),
  billToClient: z
    .string({
      required_error: "Please select bill to client",
    })
    .min(1, "Bill To Client must be selected"),
})

type FormValues = z.infer<typeof formSchema>

interface TimesheetEntryRowFormProps {
  onSubmit: (values: FormValues) => void
  isEditing?: boolean
  onCancel?: () => void
}

export function TimesheetEntryRowForm({ onSubmit, isEditing = false, onCancel }: TimesheetEntryRowFormProps) {
  const formContext = useFormContext<FormValues>()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [openClientSelect, setOpenClientSelect] = useState(false)
  const [openDatePicker, setOpenDatePicker] = useState(false)
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [openBillToClientSelect, setOpenBillToClientSelect] = useState(false)
  const [loadingClients, setLoadingClients] = useState(true)
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([])
  const [loadingServiceItems, setLoadingServiceItems] = useState(true)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [openServiceSelect, setOpenServiceSelect] = useState(false)

  // Safe access to form values with null checks
  const watchedHours = formContext?.watch?.("hours") ?? 0
  const watchedRate = formContext?.watch?.("ratePerHour") ?? 0
  const watchedItemName = formContext?.watch?.("itemName") ?? ""
  const watchedActivity = formContext?.watch?.("activity") ?? "External"
  const watchedBillable = formContext?.watch?.("billable") ?? "Billable"
  const watchedStandardItemFee = formContext?.watch?.("standardItemFee") ?? 0
  const watchedClientName = formContext?.watch?.("clientName") ?? ""
  const watchedBillToClient = formContext?.watch?.("billToClient") ?? ""

  useEffect(() => {
    // Load clients from Supabase on component mount
    const loadClients = async () => {
      try {
        setLoadingClients(true)
        const loadedClients = await getSupabaseClients()

        // Add "Internal" as a selectable option if not already present
        if (!loadedClients.some((client) => client.name === "Internal")) {
          loadedClients.push({ name: "Internal", address: "", email: "" })
        }

        setClients(loadedClients)
      } catch (error) {
        console.error("Error loading clients:", error)
        toast({
          title: "Failed to Load Clients",
          description: "Unable to load client list from database. Please refresh the page and try again.",
          variant: "destructive",
        })
        // Fallback to just Internal client
        setClients([{ name: "Internal", address: "", email: "" }])
      } finally {
        setLoadingClients(false)
      }
    }

    const loadServiceItems = async () => {
      try {
        setLoadingServiceItems(true)
        const items = await getServiceItems()
        setServiceItems(items)
      } catch (error) {
        console.error("Error loading service items:", error)
        toast({
          title: "Failed to Load Service Items",
          description: "Unable to load service items from database. Please refresh the page and try again.",
          variant: "destructive",
        })
        setServiceItems([])
      } finally {
        setLoadingServiceItems(false)
      }
    }

    loadClients()
    loadServiceItems()
  }, [])

  const handleClientSelect = useCallback(
    (clientValue: string) => {
      if (formContext?.setValue) {
        formContext.setValue("clientName", clientValue)
        setOpenClientSelect(false)

        const selectedClient = clients.find((client) => client.name === clientValue)
        if (selectedClient && selectedClient.bill_to) {
          formContext.setValue("billToClient", selectedClient.bill_to)
        } else if (clientValue === "Internal") {
          formContext.setValue("billToClient", "Internal")
        } else {
          formContext.setValue("billToClient", clientValue)
        }
      }
    },
    [formContext, clients],
  )

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date && formContext?.setValue) {
        formContext.setValue("date", date)
        setOpenDatePicker(false)
      }
    },
    [formContext],
  )

  const handleServiceSelect = useCallback(
    (serviceName: string) => {
      if (formContext?.setValue) {
        formContext.setValue("itemName", serviceName)
        setOpenServiceSelect(false)
      }
    },
    [formContext],
  )

  useEffect(() => {
    if (watchedItemName && formContext?.setValue && formContext?.getValues) {
      const selectedItem = serviceItems.find((item) => item.name === watchedItemName)
      if (selectedItem) {
        if (formContext.getValues("standardItemFee") !== selectedItem.rate) {
          formContext.setValue("standardItemFee", selectedItem.rate)
        }
      }
    }
  }, [watchedItemName, formContext, serviceItems])

  useEffect(() => {
    if (!formContext?.setValue || !formContext?.getValues) return

    console.log("[v0] Activity changed to:", watchedActivity)
    console.log("[v0] Current billable status:", watchedBillable)

    if (watchedActivity === "Internal") {
      if (formContext.getValues("clientName") !== "Internal") {
        formContext.setValue("clientName", "Internal")
      }
      if (formContext.getValues("billToClient") !== "Internal") {
        formContext.setValue("billToClient", "Internal")
      }
      const currentBillable = formContext.getValues("billable")
      if (currentBillable === "Billable" || currentBillable === "Recurring") {
        formContext.setValue("billable", "Not Billable")
      }
      if (formContext.getValues("ratePerHour") !== 0) {
        formContext.setValue("ratePerHour", 0)
      }
      if (formContext.getValues("total") !== 0) {
        formContext.setValue("total", 0)
      }
    } else if (watchedActivity === "Sub-Contractor") {
      const currentBillable = formContext.getValues("billable")
      if (currentBillable === "Not Billable" || currentBillable === "Work in Progress") {
        formContext.setValue("billable", "Billable")
      }
      if (formContext.getValues("clientName") === "Internal") {
        formContext.setValue("clientName", "")
      }
      if (formContext.getValues("billToClient") === "Internal") {
        formContext.setValue("billToClient", "")
      }
    } else {
      if (formContext.getValues("clientName") === "Internal") {
        formContext.setValue("clientName", "")
      }
      if (formContext.getValues("billToClient") === "Internal") {
        formContext.setValue("billToClient", "")
      }
    }

    console.log("[v0] After useEffect, billable status:", formContext.getValues("billable"))
  }, [watchedActivity, formContext])

  useEffect(() => {
    if (!formContext?.setValue || !formContext?.getValues) return

    let newTotal = 0

    if (watchedHours) {
      if (watchedRate && watchedRate > 0) {
        newTotal = watchedHours * watchedRate
      } else if (watchedStandardItemFee && watchedStandardItemFee > 0) {
        newTotal = watchedHours * watchedStandardItemFee
      }
    }

    if (formContext.getValues("total") !== newTotal) {
      formContext.setValue("total", newTotal)
    }
  }, [watchedHours, watchedRate, watchedBillable, watchedStandardItemFee, formContext])

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (e.message.includes("ResizeObserver loop completed with undelivered notifications")) {
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  const validateRequiredFields = () => {
    const errors: string[] = []

    if (!watchedClientName || watchedClientName.trim() === "") {
      errors.push("Client must be selected")
    }

    if (!watchedItemName || watchedItemName.trim() === "") {
      errors.push("Service item must be selected")
    }

    if (!watchedBillToClient || watchedBillToClient.trim() === "") {
      errors.push("Bill To Client must be selected")
    }

    if (!watchedHours || watchedHours <= 0) {
      errors.push("Hours must be greater than 0")
    }

    setValidationErrors(errors)
    return errors
  }

  const handleSubmit = async () => {
    if (!formContext?.handleSubmit || !formContext?.getValues) return

    const errors = validateRequiredFields()
    if (errors.length > 0) {
      const errorList = errors.map((error, index) => `${index + 1}. ${error}`).join("\n")
      toast({
        title: "Timesheet Entry Validation Failed",
        description: `Please correct the following issues before submitting:\n${errorList}`,
        variant: "destructive",
      })
      return
    }

    try {
      if (watchedClientName) {
        await getOrCreateClientId(watchedClientName)
      }

      const onWrappedSubmit = (data: FormValues) => {
        const finalData = {
          ...data,
          comments: data.comments?.trim() ? data.comments : data.itemName,
        }
        onSubmit(finalData)
      }

      formContext.handleSubmit(onWrappedSubmit)()

      toast({
        title: `Timesheet Entry ${isEditing ? "Updated" : "Added"} Successfully!`,
        description: `${watchedHours} hours for ${watchedClientName} on ${format(formContext.getValues("date"), "MMM d, yyyy")} has been ${isEditing ? "updated" : "recorded"} and saved.`,
      })
    } catch (error) {
      console.error("Error validating client:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown validation error"
      toast({
        title: "Timesheet Entry Failed",
        description: `Unable to save timesheet entry: ${errorMessage}. Please verify client information and try again.`,
        variant: "destructive",
      })
    }
  }

  if (!formContext) {
    return (
      <TableRow className="bg-red-50 hover:bg-red-100">
        <TableCell colSpan={13} className="text-center py-4 text-red-600">
          Error: Form context not found. This component must be used within a FormProvider.
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow
      className={
        isEditing
          ? "bg-yellow-50 hover:bg-yellow-100 transition-colors"
          : "bg-accent/20 hover:bg-accent/30 transition-colors"
      }
    >
      <TableCell className="w-[160px]">
        <FormField
          control={formContext.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-1">
              <div className="relative">
                <Popover open={openDatePicker} onOpenChange={setOpenDatePicker}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal h-8 min-w-[150px]",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={handleDateSelect}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[130px]">
        <FormField
          control={formContext.control}
          name="activity"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <div className="relative">
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-8 w-full min-w-[120px]">
                      <SelectValue placeholder="Activity" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="External">External</SelectItem>
                    <SelectItem value="Internal">Internal</SelectItem>
                    <SelectItem value="Sub-Contractor">Sub-Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[220px]">
        <FormField
          control={formContext.control}
          name="clientName"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-1">
              <div className="relative">
                <Popover open={openClientSelect} onOpenChange={setOpenClientSelect}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openClientSelect}
                        className={cn(
                          "w-full justify-between h-8 min-w-[200px]",
                          !field.value && "text-muted-foreground border-red-300",
                          !field.value &&
                          validationErrors.includes("Client must be selected") &&
                          "border-red-500 bg-red-50",
                        )}
                        disabled={watchedActivity === "Internal" || loadingClients}
                      >
                        {loadingClients
                          ? "Loading..."
                          : field.value
                            ? clients.find((client) => client.name === field.value)?.name
                            : "Select client *"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="start" side="bottom" sideOffset={4}>
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              value={client.name}
                              key={client.name}
                              onSelect={() => handleClientSelect(client.name)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  client.name === field.value ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {client.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[280px]">
        <FormField
          control={formContext.control}
          name="itemName"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-1">
              <div className="relative">
                <Popover open={openServiceSelect} onOpenChange={setOpenServiceSelect}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openServiceSelect}
                        className={cn(
                          "w-full justify-between h-8 min-w-[260px]",
                          !field.value && "text-muted-foreground",
                          !field.value &&
                          validationErrors.includes("Service item must be selected") &&
                          "border-red-500 bg-red-50",
                        )}
                        disabled={loadingServiceItems}
                      >
                        {loadingServiceItems
                          ? "Loading..."
                          : field.value
                            ? serviceItems.find((item) => item.name === field.value)?.name
                            : "Service item *"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start" side="bottom" sideOffset={4}>
                    <Command>
                      <CommandInput placeholder="Search services..." />
                      <CommandList>
                        <CommandEmpty>No service found.</CommandEmpty>
                        <CommandGroup>
                          {serviceItems.map((item) => (
                            <CommandItem
                              value={item.name}
                              key={item.code}
                              onSelect={() => handleServiceSelect(item.name)}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", item.name === field.value ? "opacity-100" : "opacity-0")}
                              />
                              <div className="flex flex-col">
                                <span>{item.name}</span>
                                <span className="text-xs text-muted-foreground">R{item.rate}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[180px]">
        <FormField
          control={formContext.control}
          name="billToClient"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-1">
              <div className="relative">
                <Popover open={openBillToClientSelect} onOpenChange={setOpenBillToClientSelect}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openBillToClientSelect}
                        className={cn(
                          "w-full justify-between h-8 min-w-[180px]",
                          !field.value && "text-muted-foreground",
                          !field.value &&
                          validationErrors.includes("Bill To Client must be selected") &&
                          "border-red-500 bg-red-50",
                        )}
                        disabled={loadingClients}
                      >
                        {loadingClients ? "Loading..." : field.value ? field.value : "Bill to client *"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start" side="bottom" sideOffset={4}>
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              value={client.name}
                              key={client.name}
                              onSelect={() => {
                                formContext.setValue("billToClient", client.name)
                                setOpenBillToClientSelect(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  client.name === field.value ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {client.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[160px]">
        <FormField
          control={formContext.control}
          name="billable"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <div className="relative">
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={watchedActivity === "Internal" || watchedActivity === "Sub-Contractor"}
                >
                  <FormControl>
                    <SelectTrigger className="h-8 w-full min-w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Billable">Billable</SelectItem>
                    <SelectItem value="Work in Progress">Work in Progress</SelectItem>
                    <SelectItem value="Not Billable">Non-Billable</SelectItem>
                    <SelectItem value="Recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[140px]">
        <FormField
          control={formContext.control}
          name="standardItemFee"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <div className="relative">
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={
                      field.value === 0 || field.value === null || field.value === undefined ? "" : field.value
                    }
                    onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
                    onBlur={field.onBlur}
                    name={field.name}
                    readOnly
                    className="h-9 w-full min-w-[140px] pl-3 text-left tabular-nums bg-white border border-slate-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[120px]">
        <FormField
          control={formContext.control}
          name="ratePerHour"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <div className="relative">
                <FormControl>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder=""
                    value={field.value || ""}
                    onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
                    onBlur={field.onBlur}
                    name={field.name}
                    disabled={watchedActivity === "Sub-Contractor" || !isAdmin}
                    className="h-9 w-full min-w-[120px] pl-3 text-left tabular-nums border border-slate-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:cursor-not-allowed"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[120px]">
        <FormField
          control={formContext.control}
          name="hours"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <div className="relative">
                <FormControl>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder=""
                    value={field.value || ""}
                    onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
                    onBlur={field.onBlur}
                    name={field.name}
                    className="h-9 w-full min-w-[120px] pl-3 text-left tabular-nums border border-slate-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[160px]">
        <FormField
          control={formContext.control}
          name="total"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <div className="relative">
                <FormControl>
                  <Input
                    type="number"
                    value={
                      field.value === 0 || field.value === null || field.value === undefined ? "" : field.value
                    }
                    readOnly
                    className="font-semibold h-9 w-full min-w-[160px] pl-3 text-left tabular-nums bg-white border border-slate-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[200px]">
        <FormField
          control={formContext.control}
          name="comments"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <div className="relative">
                <FormControl>
                  <Textarea
                    placeholder="Comments"
                    className="resize-none h-8 w-full min-h-[32px] min-w-[200px]"
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="w-[140px]">
        {isEditing ? (
          <div className="flex space-x-1">
            <Button onClick={handleSubmit} size="sm" className="h-8 bg-green-600 hover:bg-green-700">
              Save
            </Button>
            <Button onClick={onCancel} variant="outline" size="sm" className="h-8 bg-transparent">
              Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={handleSubmit} size="sm" className="h-8 w-full">
            Add
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}



