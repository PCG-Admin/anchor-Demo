"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { getServiceItems, type ServiceItem } from "@/lib/supabase"
import { getSupabaseClients } from "@/lib/supabase-client-storage"
import type { ClientInfo } from "../types/invoice"

// Form validation schema
const formSchema = z.object({
  loginName: z.string().min(1, "Login name is required"),
  date: z.date({
    required_error: "Date is required",
  }),
  activity: z.enum(["External", "Internal"], {
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
  standardItemFee: z.number().default(0),
  ratePerHour: z.number().default(0),
  total: z.number().default(0),
  comments: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface TimeSheetFormProps {
  onSubmit: (values: FormValues) => void
}

export function TimeSheetForm({ onSubmit }: TimeSheetFormProps) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([])
  const [loadingServiceItems, setLoadingServiceItems] = useState(true)

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loginName: "",
      activity: "External",
      clientName: "",
      itemName: "",
      hours: 0,
      billable: "Billable",
      standardItemFee: 0,
      ratePerHour: 0,
      total: 0,
      comments: "",
    },
  })

  // Watch values to calculate totals
  const watchedHours = form.watch("hours")
  const watchedRate = form.watch("ratePerHour")
  const watchedItemName = form.watch("itemName")
  const watchedActivity = form.watch("activity")
  const watchedClientName = form.watch("clientName")
  const watchedBillable = form.watch("billable")

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
          title: "Error loading clients",
          description: "Could not load client list. Please refresh the page.",
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
          title: "Error loading service items",
          description: "Could not load service items. Please refresh the page.",
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

  // Update standard fee when item changes
  useEffect(() => {
    if (watchedItemName) {
      const selectedItem = serviceItems.find((item) => item.name === watchedItemName)
      if (selectedItem) {
        form.setValue("standardItemFee", selectedItem.rate)
      }
    }
  }, [watchedItemName, form])

  // Auto-set client name to "Internal" when activity is "Internal"
  useEffect(() => {
    if (watchedActivity === "Internal") {
      form.setValue("clientName", "Internal")
      const currentBillable = form.getValues("billable")
      if (currentBillable === "Billable" || currentBillable === "Recurring") {
        form.setValue("billable", "Not Billable")
      }
    }
  }, [watchedActivity, form])

  // Calculate total when hours or rate changes
  useEffect(() => {
    if ((watchedBillable === "Billable" || watchedBillable === "Recurring") && watchedHours && watchedRate) {
      form.setValue("total", watchedHours * watchedRate)
    } else {
      form.setValue("total", 0)
    }
  }, [watchedBillable, watchedHours, watchedRate, form])
  function handleSubmit(values: FormValues) {
    // Default comments to item name if empty
    const finalValues = {
      ...values,
      comments: values.comments?.trim() ? values.comments : values.itemName,
    }

    onSubmit(finalValues)
    form.reset()
    toast({
      title: "Time entry submitted",
      description: `${values.hours} hours for ${values.clientName} added successfully.`,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {/* Login Name */}
          <FormField
            control={form.control}
            name="loginName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Login Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your name"
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

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Activity Type */}
          <FormField
            control={form.control}
            name="activity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Activity</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="External">External</SelectItem>
                    <SelectItem value="Internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Client Name (dropdown) */}
          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Client Name</FormLabel>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        disabled={watchedActivity === "Internal" || loadingClients}
                      >
                        {loadingClients
                          ? "Loading clients..."
                          : field.value
                            ? clients.find((client) => client.name === field.value)?.name
                            : "Select client"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
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
                                form.setValue("clientName", client.name)
                                setOpen(false)
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
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Item Name */}
          <FormField
            control={form.control}
            name="itemName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item Name</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingServiceItems ? "Loading..." : "Select service item"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {serviceItems.map((item) => (
                      <SelectItem key={item.code} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Hours */}
          <FormField
            control={form.control}
            name="hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hours</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={field.value === 0 || field.value === null || field.value === undefined ? "" : field.value}
                    onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Billable Status */}
          <FormField
            control={form.control}
            name="billable"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billable Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={watchedActivity === "Internal"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select billable status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Billable">Billable</SelectItem>
                    <SelectItem value="Work in Progress">Work in Progress</SelectItem>
                    <SelectItem value="Not Billable">Non-Billable</SelectItem>
                    <SelectItem value="Recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Standard Item Fee */}
          <FormField
            control={form.control}
            name="standardItemFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Standard Item Fee (R)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={
                      field.value === 0 || field.value === null || field.value === undefined ? "" : field.value
                    }
                    onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
                    onBlur={field.onBlur}
                    name={field.name}
                    readOnly
                  />
                </FormControl>
                <FormDescription>Auto-filled based on selected item</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Rate per Hour */}
          <FormField
            control={form.control}
            name="ratePerHour"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate per Hour (R)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={
                      field.value === 0 || field.value === null || field.value === undefined ? "" : field.value
                    }
                    onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
                    onBlur={field.onBlur}
                    name={field.name}
                    disabled={watchedBillable !== "Billable" && watchedBillable !== "Recurring"}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Total */}
          <FormField
            control={form.control}
            name="total"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total (R)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={
                      field.value === 0 || field.value === null || field.value === undefined ? "" : field.value
                    }
                    readOnly
                    className="font-semibold"
                  />
                </FormControl>
                <FormDescription>Calculated automatically (Hours × Rate)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div >

        {/* Comments */}
        < FormField
          control={form.control}
          name="comments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comments</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any additional notes or comments here..."
                  className="resize-none"
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

        < Button type="submit" className="w-full" >
          Submit Time Entry
        </Button >
      </form >
    </Form >
  )
}
