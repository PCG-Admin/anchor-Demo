"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { BillingEntry } from "../types/billing"
import { TimesheetEntryRowForm } from "./timesheet-entry-row-form"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { FileText, Trash2, Edit } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useState, useMemo, useEffect, useRef } from "react"
import { PaginationControls } from "@/components/pagination-controls"

const ITEMS_PER_PAGE = 12

interface TimeSheetEntriesProps {
  entries: BillingEntry[]
  onAddEntry: (entry: Omit<BillingEntry, "id">) => void
  onRemoveEntry: (id: string) => void
  onUpdateEntry?: (id: string, entry: Omit<BillingEntry, "id">) => void
  hideAddForm?: boolean // Added hideAddForm prop for admin view
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  activity: z.enum(["External", "Internal", "Sub-Contractor"], {
    required_error: "Please select an activity type",
  }),
  clientName: z
    .string({
      required_error: "Please select a client",
    })
    .min(1, "Client must be selected"),
  itemName: z
    .string({
      required_error: "Please select a service item",
    })
    .min(1, "Service item must be selected"),
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

export function TimeSheetEntries({
  entries,
  onAddEntry,
  onRemoveEntry,
  onUpdateEntry,
  hideAddForm = false,
}: TimeSheetEntriesProps) {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<BillingEntry | null>(null)
  const [page, setPage] = useState(1)

  // Reset page when entries change (e.g. filter change)
  useEffect(() => {
    setPage(1)
  }, [entries])

  // Calculate pagination
  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE)
  const paginatedEntries = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    return entries.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [entries, page])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      activity: "External",
      clientName: "",
      itemName: "",
      hours: 0,
      billable: "Billable",
      standardItemFee: 0,
      ratePerHour: 0,
      total: 0,
      comments: "",
      billToClient: "",
    },
  })

  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

  const handleFormSubmit = (values: FormValues) => {
    if (!values.clientName || values.clientName.trim() === "") {
      toast({
        title: "Client Selection Required",
        description: "Please select a client from the dropdown list before submitting the timesheet entry.",
        variant: "destructive",
      })
      return
    }

    if (!values.itemName || values.itemName.trim() === "") {
      toast({
        title: "Service Item Required",
        description: "Please select a service item from the dropdown list before submitting the timesheet entry.",
        variant: "destructive",
      })
      return
    }

    if (!values.billToClient || values.billToClient.trim() === "") {
      toast({
        title: "Bill To Client Required",
        description: "Please select which client to bill for this timesheet entry.",
        variant: "destructive",
      })
      return
    }

    onAddEntry({
      date: format(values.date, "yyyy-MM-dd"),
      activity: values.activity,
      clientName: values.clientName,
      itemName: values.itemName,
      hours: values.hours,
      billable: values.billable,
      standardItemFee: values.standardItemFee,
      ratePerHour: values.ratePerHour,
      total: values.total,
      comments: values.comments || "",
      billToClient: values.billToClient,
      loginName: "",
      retainer: "No",
    })

    form.reset({
      date: new Date(),
      activity: "External",
      clientName: "",
      itemName: "",
      hours: 0,
      billable: "Billable",
      standardItemFee: 0,
      ratePerHour: 0,
      total: 0,
      comments: "",
      billToClient: "",
    })
  }

  const handleEditEntry = (entry: BillingEntry) => {
    setEditingEntryId(entry.id)
    setEditingEntry(entry)
    editForm.reset({
      date: new Date(entry.date),
      activity: (["External", "Internal", "Sub-Contractor"].includes(entry.activity)
        ? entry.activity
        : "External") as "External" | "Internal" | "Sub-Contractor",
      clientName: entry.clientName,
      itemName: entry.itemName,
      hours: entry.hours,
      billable: (["Billable", "Not Billable", "Work in Progress", "Recurring"].includes(entry.billable)
        ? entry.billable
        : "Billable") as "Billable" | "Not Billable" | "Work in Progress" | "Recurring",
      standardItemFee: entry.standardItemFee,
      ratePerHour: entry.ratePerHour,
      total: entry.total,
      comments: entry.comments,
      billToClient: entry.billToClient,
    })
  }

  const handleSaveEdit = (values: FormValues) => {
    if (!editingEntryId || !onUpdateEntry) return

    onUpdateEntry(editingEntryId, {
      date: format(values.date, "yyyy-MM-dd"),
      activity: values.activity,
      clientName: values.clientName,
      itemName: values.itemName,
      hours: values.hours,
      billable: values.billable,
      standardItemFee: values.standardItemFee,
      ratePerHour: values.ratePerHour,
      total: values.total,
      comments: values.comments || "",
      billToClient: values.billToClient,
      loginName: "",
      retainer: "No",
    })

    setEditingEntryId(null)
    setEditingEntry(null)
  }

  const handleCancelEdit = () => {
    setEditingEntryId(null)
    setEditingEntry(null)
  }

  // Scroll synchronization refs
  const topScrollRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState(0)

  // Sync scroll handlers
  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
    }
  }

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft
    }
  }

  // Measure table width for the top scrollbar dummy div
  useEffect(() => {
    const tableContainer = tableScrollRef.current
    const updateWidth = () => {
      if (tableContainer) {
        setScrollWidth(tableContainer.scrollWidth)
      }
    }

    // Initial measure
    updateWidth()
    // Small delay to ensure content painted
    setTimeout(updateWidth, 100)

    if (tableContainer) {
      const resizeObserver = new ResizeObserver(updateWidth)
      resizeObserver.observe(tableContainer)
      if (tableContainer.children[0]) {
        resizeObserver.observe(tableContainer.children[0])
      }
      return () => resizeObserver.disconnect()
    }
  }, [entries])

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <CardTitle className="text-slate-800 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-blue-600" />
          Time Entries
        </CardTitle>
        <CardDescription>
          {hideAddForm ? "View and edit timesheet entries" : "Add new entries or view your submitted time"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky left-0 right-0">
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            itemName="entries"
          />
        </div>

        {/* Top Scrollbar */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto custom-scrollbar bg-slate-200 border-b border-slate-300"
          style={{ height: '16px' }}
        >
          <div style={{ width: scrollWidth, height: '1px' }} />
        </div>

        {/* Main Table Container */}
        <div
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto relative custom-scrollbar border-b border-slate-200"
        >
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
              <TableRow className="bg-slate-50/50 border-slate-200 hover:bg-slate-50/50">
                <TableHead className="w-[60px]">Date</TableHead>
                <TableHead className="w-[160px] text-slate-700 font-semibold">Activity</TableHead>
                <TableHead className="w-[130px] text-slate-700 font-semibold">Client</TableHead>
                <TableHead className="w-[220px] text-slate-700 font-semibold">Service</TableHead>
                <TableHead className="w-[280px] text-slate-700 font-semibold">Bill to Client</TableHead>
                <TableHead className="w-[200px] text-slate-700 font-semibold">Status</TableHead>
                <TableHead className="w-[140px] text-slate-700 font-semibold">Standard Fee</TableHead>
                <TableHead className="w-[140px] text-slate-700 font-semibold pl-2 text-left">Rate </TableHead>
                <TableHead className="w-[120px] text-slate-700 font-semibold pl-2 text-left">Hours</TableHead>
                <TableHead className="w-[120px] text-slate-700 font-semibold pl-2 text-left">Total</TableHead>
                <TableHead className="w-[160px] text-slate-700 font-semibold pl-2 text-left">Comments</TableHead>
                <TableHead className="w-[200px] text-slate-700 font-semibold text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hideAddForm && (
                <FormProvider {...form}>
                  <TimesheetEntryRowForm onSubmit={handleFormSubmit} />
                </FormProvider>
              )}

              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3 text-slate-500">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <FileText className="h-8 w-8 text-slate-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">No time entries yet</p>
                        <p className="text-sm">
                          {hideAddForm
                            ? "This user has no timesheet entries"
                            : "Use the row above to add your first entry"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEntries.map((entry, index) =>
                  editingEntryId === entry.id ? (
                    <FormProvider key={`edit-${entry.id}`} {...editForm}>
                      <TimesheetEntryRowForm onSubmit={handleSaveEdit} isEditing={true} onCancel={handleCancelEdit} />
                    </FormProvider>
                  ) : (
                    <TableRow
                      key={entry.id}
                      className={`border-slate-100 hover:bg-slate-50/50 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                    >
                      <TableCell className={`text-slate-700 font-medium whitespace-nowrap ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        {entry.date}
                      </TableCell>
                      <TableCell className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <Badge
                          variant="outline"
                          className={
                            "whitespace-nowrap " +
                            (entry.activity === "External"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : entry.activity === "Sub-Contractor"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-50 text-slate-700 border-slate-200")
                          }
                        >
                          {entry.activity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-700 font-medium">{entry.clientName}</TableCell>
                      <TableCell className="text-slate-700">{entry.itemName}</TableCell>
                      <TableCell className="text-slate-700">{entry.billToClient}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            entry.billable === "Billable"
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm"
                              : entry.billable === "Work in Progress"
                                ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-white shadow-sm"
                                : entry.billable === "Recurring"
                                  ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-sm"
                                  : "bg-gradient-to-r from-orange-400 to-red-400 text-white shadow-sm"
                          }
                        >
                          {entry.billable === "Not Billable" ? "Non-Billable" : entry.billable}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left text-slate-700 tabular-nums pl-2">
                        R {entry.standardItemFee.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-left text-slate-700 tabular-nums pl-2">
                        R {entry.ratePerHour.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-left text-slate-700 font-medium tabular-nums pl-2">
                        {entry.hours}
                      </TableCell>
                      <TableCell className="font-semibold text-left text-slate-800 tabular-nums pl-2">
                        R {entry.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-left text-slate-600">
                        {entry.comments || "-"}
                      </TableCell>
                      <TableCell className="w-[140px]">
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEntry(entry)}
                            className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRemoveEntry(entry.id)}
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ),
                )
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
