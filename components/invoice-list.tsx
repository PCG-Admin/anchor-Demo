"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Eye, Download, MoreHorizontal, Filter, X, Search } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { generateInvoicePDF } from "@/lib/pdf-generator"
import { getTimesheetEntriesForInvoice, supabase } from "@/lib/supabase"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Invoice } from "../types/invoice"

interface InvoiceListProps {
  invoices: Invoice[]
  onViewInvoice: (invoice: Invoice) => void
}

export function InvoiceList({ invoices, onViewInvoice }: InvoiceListProps) {
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: "",
  })
  const [searchQuery, setSearchQuery] = useState("")

  const getStatusColor = (status: Invoice["status"]) => {
    switch (status) {
      case "Draft":
        return "secondary"
      case "Sent":
        return "default"
      case "Paid":
        return "default"
      case "Overdue":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const filteredInvoices = invoices.filter((invoice) => {
    if (invoice.status === "Draft") return false

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesInvoiceNumber = invoice.invoiceNumber.toLowerCase().includes(query)
      const matchesClientName = invoice.clientName.toLowerCase().includes(query)
      const matchesAmount = invoice.total.toString().includes(query)

      if (!matchesInvoiceNumber && !matchesClientName && !matchesAmount) {
        return false
      }
    }

    if (dateFilter.startDate || dateFilter.endDate) {
      const invoiceDate = new Date(invoice.issueDate)

      if (dateFilter.startDate) {
        const startDate = new Date(dateFilter.startDate)
        if (invoiceDate < startDate) return false
      }

      if (dateFilter.endDate) {
        const endDate = new Date(dateFilter.endDate)
        if (invoiceDate > endDate) return false
      }
    }

    return true
  })

  const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0)

  const clearDateFilter = () => {
    setDateFilter({ startDate: "", endDate: "" })
  }

  const clearSearch = () => {
    setSearchQuery("")
  }

  const hasActiveFilter = dateFilter.startDate || dateFilter.endDate || searchQuery

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      console.log("[v0] Starting PDF generation for invoice:", invoice.invoiceNumber)

      const isRetainerInvoice = invoice.invoiceNumber?.toLowerCase().startsWith("r-inv")

      // Check if this is a plan invoice by querying the database
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("anchor_invoices")
        .select("plan_id, installment_number")
        .eq("uid", invoice.id)
        .single()

      const isPlanInvoice = invoiceData?.plan_id !== null
      const hasLineItems = isRetainerInvoice || isPlanInvoice

      console.log("[v0] Invoice type:", { isRetainerInvoice, isPlanInvoice, hasLineItems })

      let lineItems: any[] = []
      let entries: any[] = []
      let subtotal = 0
      let taxAmount = 0
      let total = invoice.total

      if (hasLineItems) {
        const { data: retainerItems, error: retainerError } = await supabase
          .from("anchor_retainer_lines")
          .select("*")
          .eq("invoice_id", invoice.id)

        if (retainerError) {
          console.error("[v0] Error fetching line items:", retainerError)
        } else {
          lineItems = (retainerItems || []).map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          }))
          console.log("[v0] Loaded line items:", lineItems.length)

          subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0)
          const taxRate = 15
          taxAmount = subtotal * (taxRate / 100)
          total = subtotal + taxAmount
        }
      } else {
        const timesheetEntries = await getTimesheetEntriesForInvoice(invoice.id)
        entries = timesheetEntries.map((entry) => ({
          id: entry.id,
          billingEntryId: entry.id,
          date: entry.date,
          itemName: entry.itemName,
          hours: entry.hours,
          ratePerHour: entry.ratePerHour,
          total: entry.total,
          comments: entry.comments,
        }))
        console.log("[v0] Loaded timesheet entries:", entries.length)

        subtotal = invoice.total / 1.15
        taxAmount = invoice.total - subtotal
      }

      const completeInvoice = {
        ...invoice,
        lineItems, // For retainer and plan invoices
        entries, // For normal timesheet invoices
        subtotal,
        taxRate: 15,
        taxAmount,
        totalAmount: total,
        total: total,
        plan_id: (invoice as any).plan_id, // Include plan_id for PDF generator logic
      }

      console.log("[v0] Generating PDF with complete data structure")
      const pdfDocument = generateInvoicePDF(completeInvoice)

      const blob = new Blob([pdfDocument.data], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = pdfDocument.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "PDF Downloaded",
        description: `Invoice ${invoice.invoiceNumber} has been downloaded successfully.`,
      })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error generating PDF",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R {totalAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Finalized Invoices</CardTitle>
              <CardDescription>Manage your sent and paid invoices</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64 h-8 bg-transparent"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {hasActiveFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearDateFilter()
                    clearSearch()
                  }}
                  className="h-8 bg-transparent"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-transparent">
                    <Filter className="h-4 w-4 mr-1" />
                    Filter by Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={dateFilter.startDate}
                        onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={dateFilter.endDate}
                        onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No finalized invoices found.</p>
              <p className="text-sm mt-2">
                {hasActiveFilter
                  ? "Try adjusting your search or date filter to see more invoices."
                  : "Send draft invoices to see them here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="bg-white">Invoice #</TableHead>
                    <TableHead className="bg-white">Client</TableHead>
                    <TableHead className="bg-white">Issue Date</TableHead>
                    <TableHead className="bg-white">Due Date</TableHead>
                    <TableHead className="bg-white">Status</TableHead>
                    <TableHead className="bg-white text-right">Amount</TableHead>
                    <TableHead className="bg-white w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{format(new Date(invoice.issueDate), "dd MMM yyyy")}</TableCell>
                    <TableCell>{format(new Date(invoice.dueDate), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">R {invoice.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewInvoice(invoice)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
