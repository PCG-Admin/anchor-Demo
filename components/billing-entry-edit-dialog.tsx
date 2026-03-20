"use client"

import { useEffect, useMemo, useState, useId } from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { BillingEntry } from "@/types/billing"

const editEntrySchema = z.object({
  date: z.date(),
  clientName: z
    .string()
    .trim()
    .min(1, "Client is required"),
  billToClient: z
    .string()
    .trim()
    .min(1, "Bill to client is required"),
  itemName: z
    .string()
    .trim()
    .min(1, "Service item is required"),
  activity: z.enum(["External", "Internal", "Sub-Contractor"]),
  billable: z.enum(["Billable", "Not Billable", "Work in Progress", "Recurring"]),
  retainer: z.enum(["Yes", "No"]),
  hours: z
    .number({
      required_error: "Hours are required",
      invalid_type_error: "Hours must be a number",
    })
    .min(0, "Hours cannot be negative"),
  ratePerHour: z
    .number({
      required_error: "Rate is required",
      invalid_type_error: "Rate must be a number",
    })
    .min(0, "Rate cannot be negative"),
  standardItemFee: z
    .number({
      invalid_type_error: "Standard fee must be a number",
    })
    .min(0, "Standard fee cannot be negative"),
  markup: z
    .number({
      invalid_type_error: "Markup must be a number",
    })
    .nullable()
    .optional(),
  total: z
    .number({
      invalid_type_error: "Total must be a number",
    })
    .min(0, "Total cannot be negative"),
  comments: z.string().optional(),
})

type FormValues = z.infer<typeof editEntrySchema>

const toDate = (value: string | undefined) => {
  if (!value) {
    return new Date()
  }

  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }

  return parsed
}

const numberOrZero = (value: number | null | undefined) => (Number.isFinite(value) ? Number(value) : 0)

export interface BillingEntryEditDialogProps {
  entry: BillingEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (entry: BillingEntry) => Promise<void>
  clientOptions: string[]
  serviceOptions: string[]
  billToOptions: string[]
  isSubmitting?: boolean
  title?: string
  description?: string
  lockActivity?: boolean
  showMarkupField?: boolean
}

export function BillingEntryEditDialog({
  entry,
  open,
  onOpenChange,
  onSubmit,
  clientOptions,
  serviceOptions,
  billToOptions,
  isSubmitting = false,
  title = "Edit entry",
  description = "Update the details for this timesheet entry.",
  lockActivity = false,
  showMarkupField = false,
}: BillingEntryEditDialogProps) {
  const clientListId = useId()
  const billToListId = useId()
  const serviceListId = useId()
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [hasCalculatedFieldEdited, setHasCalculatedFieldEdited] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(editEntrySchema),
    defaultValues: {
      date: new Date(),
      clientName: "",
      billToClient: "",
      itemName: "",
      activity: "External",
      billable: "Billable",
      retainer: "No",
      hours: 0,
      ratePerHour: 0,
      standardItemFee: 0,
      markup: null,
      total: 0,
      comments: "",
    },
  })

  const watchedHours = numberOrZero(form.watch("hours"))
  const watchedRate = numberOrZero(form.watch("ratePerHour"))
  const watchedStandardFee = numberOrZero(form.watch("standardItemFee"))
  const watchedMarkupRaw = form.watch("markup")
  const watchedMarkup = numberOrZero(
    watchedMarkupRaw === null || watchedMarkupRaw === undefined ? 0 : (watchedMarkupRaw as number),
  )

  const suggestedTotal = useMemo(() => {
    const base = watchedStandardFee > 0 ? watchedStandardFee : watchedHours * watchedRate
    return Number.isFinite(base + watchedMarkup) ? Number(base + watchedMarkup) : 0
  }, [watchedHours, watchedRate, watchedStandardFee, watchedMarkup])

  const resetForm = () => {
    if (!entry) {
      form.reset()
      setHasCalculatedFieldEdited(false)
      return
    }

    form.reset({
      date: toDate(entry.date),
      clientName: entry.clientName || "",
      billToClient: entry.billToClient || "",
      itemName: entry.itemName || "",
      activity: entry.activity,
      billable: entry.billable,
      retainer: entry.retainer,
      hours: numberOrZero(entry.hours),
      ratePerHour: numberOrZero(entry.ratePerHour),
      standardItemFee: numberOrZero(entry.standardItemFee),
      markup: entry.markup ?? null,
      total: numberOrZero(entry.total),
      comments: entry.comments || "",
    })
    setHasCalculatedFieldEdited(false)
  }

  useEffect(() => {
    if (open) {
      resetForm()
    }
  }, [entry, open])

  useEffect(() => {
    if (!open) {
      setDatePickerOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !hasCalculatedFieldEdited) {
      return
    }

    const suggested = Number.isFinite(suggestedTotal) ? Number(suggestedTotal.toFixed(2)) : 0
    const currentTotal = numberOrZero(form.getValues("total"))

    if (Math.abs(currentTotal - suggested) > 0.005) {
      form.setValue("total", suggested, { shouldDirty: true })
    }
  }, [open, hasCalculatedFieldEdited, suggestedTotal, form])

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const handleSubmit = async (values: FormValues) => {
    if (!entry) return

    const updatedEntry: BillingEntry = {
      ...entry,
      date: format(values.date, "yyyy-MM-dd"),
      clientName: values.clientName.trim(),
      billToClient: values.billToClient.trim(),
      itemName: values.itemName.trim(),
      activity: values.activity,
      billable: values.billable,
      retainer: values.retainer,
      hours: numberOrZero(values.hours),
      ratePerHour: numberOrZero(values.ratePerHour),
      standardItemFee: numberOrZero(values.standardItemFee),
      markup:
        values.markup === null || values.markup === undefined || Number.isNaN(values.markup)
          ? undefined
          : Number(values.markup),
      total: numberOrZero(values.total),
      comments: values.comments?.trim() ?? "",
    }

    await onSubmit(updatedEntry)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!entry ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Select an entry to start editing.</div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "justify-start font-normal",
                                !field.value && "text-muted-foreground",
                                "w-full",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd MMM yyyy") : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              if (date) {
                                field.onChange(date)
                                setDatePickerOpen(false)
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Client name"
                          list={clientListId}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <datalist id={clientListId}>
                        {clientOptions.map((option) => (
                          <option value={option} key={option} />
                        ))}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billToClient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill To</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Client to bill"
                          list={billToListId}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <datalist id={billToListId}>
                        {billToOptions.map((option) => (
                          <option value={option} key={option} />
                        ))}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Item</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Service item"
                          list={serviceListId}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <datalist id={serviceListId}>
                        {serviceOptions.map((option) => (
                          <option value={option} key={option} />
                        ))}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="activity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Activity</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={lockActivity}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select activity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="External">External</SelectItem>
                          <SelectItem value="Internal">Internal</SelectItem>
                          <SelectItem value="Sub-Contractor">Sub-Contractor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Billable">Billable</SelectItem>
                          <SelectItem value="Not Billable">Non-Billable</SelectItem>
                          <SelectItem value="Work in Progress">Work in Progress</SelectItem>
                          <SelectItem value="Recurring">Recurring</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retainer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retainer</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select retainer status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.25"
                          value={field.value === 0 ? "" : field.value}
                          onChange={(event) => {
                            const parsed = Number.parseFloat(event.target.value)
                            field.onChange(Number.isFinite(parsed) ? parsed : 0)
                            setHasCalculatedFieldEdited(true)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ratePerHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate per Hour (R)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={field.value === 0 ? "" : field.value}
                          onChange={(event) => {
                            const parsed = Number.parseFloat(event.target.value)
                            field.onChange(Number.isFinite(parsed) ? parsed : 0)
                            setHasCalculatedFieldEdited(true)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="standardItemFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Item Fee (R)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={field.value === 0 ? "" : field.value}
                          onChange={(event) => {
                            const parsed = Number.parseFloat(event.target.value)
                            field.onChange(Number.isFinite(parsed) ? parsed : 0)
                            setHasCalculatedFieldEdited(true)
                          }}
                        />
                      </FormControl>
                      <FormDescription>Leave as 0 if this entry is purely hourly based.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showMarkupField ? (
                  <FormField
                    control={form.control}
                    name="markup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Markup (R)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.value ?? ""}
                            onChange={(event) => {
                              const raw = event.target.value
                              if (raw === "") {
                                field.onChange(null)
                              } else {
                                const parsed = Number.parseFloat(raw)
                                field.onChange(Number.isFinite(parsed) ? parsed : null)
                              }
                              setHasCalculatedFieldEdited(true)
                            }}
                          />
                        </FormControl>
                        <FormDescription>Optional fixed amount to add to the calculated total.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                <FormField
                  control={form.control}
                  name="total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total (R)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={field.value === 0 ? "" : field.value}
                          onChange={(event) => {
                            const parsed = Number.parseFloat(event.target.value)
                            field.onChange(Number.isFinite(parsed) ? parsed : 0)
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Suggested total based on current inputs: R {suggestedTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add context or clarifications for this entry"
                        className="min-h-[100px]"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
