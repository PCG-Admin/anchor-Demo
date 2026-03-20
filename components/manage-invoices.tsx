"use client"

import { useState, useEffect } from "react"
import { FileText, Clock, Trash2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { getInvoices, deleteInvoice, getTimesheetEntriesForUser, deleteTimesheetEntry } from "@/lib/supabase"
import type { InvoiceRaw, BillingEntry } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { PaginationControls } from "@/components/pagination-controls"

const ITEMS_PER_PAGE = 20

// Transform InvoiceRaw to match expected Invoice interface
interface Invoice {
  id: string
  invoiceNumber: string
  clientName: string
  issueDate: string
  dueDate: string
  status: string
  total: number
  createdAt: string
}

export default function ManageInvoicesAndTimesheets() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [timesheetEntries, setTimesheetEntries] = useState<BillingEntry[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [filteredTimesheets, setFilteredTimesheets] = useState<BillingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [timesheetLoading, setTimesheetLoading] = useState(true)

  // Invoice filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [dateFromFilter, setDateFromFilter] = useState("")
  const [dateToFilter, setDateToFilter] = useState("")

  // Timesheet filters
  const [timesheetSearchTerm, setTimesheetSearchTerm] = useState("")
  const [timesheetClientFilter, setTimesheetClientFilter] = useState<string>("all")
  const [timesheetStatusFilter, setTimesheetStatusFilter] = useState<string>("all")
  const [timesheetDateFromFilter, setTimesheetDateFromFilter] = useState("")
  const [timesheetDateToFilter, setTimesheetDateToFilter] = useState("")

  // Pagination state
  const [invoicePage, setInvoicePage] = useState(1)
  const [timesheetPage, setTimesheetPage] = useState(1)

  const [deleting, setDeleting] = useState<string | null>(null)

  const filterInvoices = () => {
    let filtered = invoices

    if (searchTerm) {
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter)
    }

    if (clientFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.clientName === clientFilter)
    }

    if (dateFromFilter) {
      filtered = filtered.filter((invoice) => new Date(invoice.issueDate) >= new Date(dateFromFilter))
    }

    if (dateToFilter) {
      filtered = filtered.filter((invoice) => new Date(invoice.issueDate) <= new Date(dateToFilter))
    }

    setFilteredInvoices(filtered)
    setInvoicePage(1) // Reset to first page on filter change
  }

  const filterTimesheets = () => {
    let filtered = timesheetEntries

    if (timesheetSearchTerm) {
      filtered = filtered.filter((entry) => entry.clientName.toLowerCase().includes(timesheetSearchTerm.toLowerCase()))
    }

    if (timesheetClientFilter !== "all") {
      filtered = filtered.filter((entry) => entry.clientName === timesheetClientFilter)
    }

    if (timesheetStatusFilter !== "all") {
      filtered = filtered.filter((entry) => entry.billable === timesheetStatusFilter)
    }

    if (timesheetDateFromFilter) {
      filtered = filtered.filter((entry) => new Date(entry.date) >= new Date(timesheetDateFromFilter))
    }

    if (timesheetDateToFilter) {
      filtered = filtered.filter((entry) => new Date(entry.date) <= new Date(timesheetDateToFilter))
    }

    setFilteredTimesheets(filtered)
    setTimesheetPage(1) // Reset to first page on filter change
  }

  useEffect(() => {
    loadInvoices()
    if (user?.id) {
      loadTimesheetEntries()
    }
  }, [user?.id])

  useEffect(() => {
    filterInvoices()
  }, [invoices, searchTerm, statusFilter, clientFilter, dateFromFilter, dateToFilter])

  useEffect(() => {
    filterTimesheets()
  }, [
    timesheetEntries,
    timesheetSearchTerm,
    timesheetClientFilter,
    timesheetStatusFilter,
    timesheetDateFromFilter,
    timesheetDateToFilter,
  ])

  const loadInvoices = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getInvoices(user.id) // Pass user ID to filter invoices

      // Transform InvoiceRaw to Invoice format
      const transformedInvoices: Invoice[] = data.map((invoice: InvoiceRaw) => ({
        id: invoice.uid || "",
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.bill_to,
        issueDate: invoice.inv_date,
        dueDate: invoice.due_date,
        status: invoice.status || "Pending Approval", // Default to "Pending Approval" instead of "Draft"
        total: invoice.inv_total,
        createdAt: invoice.created_at || new Date().toISOString(),
      }))

      setInvoices(transformedInvoices)
    } catch (error) {
      console.error("Error loading invoices:", error)
      toast({
        title: "Failed to Load Invoices",
        description: "Unable to retrieve invoices from the database. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTimesheetEntries = async () => {
    if (!user?.id) return

    try {
      setTimesheetLoading(true)
      const data = await getTimesheetEntriesForUser(user.id)
      setTimesheetEntries(data)
    } catch (error) {
      console.error("Error loading timesheet entries:", error)
      toast({
        title: "Failed to Load Timesheet Entries",
        description:
          "Unable to retrieve your timesheet entries from the database. Please refresh the page and try again.",
        variant: "destructive",
      })
    } finally {
      setTimesheetLoading(false)
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      setDeleting(invoiceId)

      const invoiceToDelete = invoices.find((inv) => inv.id === invoiceId)
      await deleteInvoice(invoiceId)

      // Update local state
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== invoiceId))

      toast({
        title: "Invoice Deleted Successfully!",
        description: `Invoice ${invoiceToDelete?.invoiceNumber || invoiceId} has been permanently removed from the system.`,
      })
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast({
        title: "Failed to Delete Invoice",
        description:
          "Unable to delete the invoice. It may be linked to timesheet entries or there was a database error.",
        variant: "destructive",
      })
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteTimesheetEntry = async (entryId: string) => {
    try {
      setDeleting(entryId)

      const entryToDelete = timesheetEntries.find((entry) => entry.id === entryId)
      // Delete the timesheet entry from database
      await deleteTimesheetEntry(Number.parseInt(entryId))

      // Update local state
      setTimesheetEntries((prev) => prev.filter((entry) => entry.id !== entryId))

      toast({
        title: "Timesheet Entry Deleted Successfully!",
        description: `Entry for ${entryToDelete?.clientName || "client"} on ${entryToDelete ? new Date(entryToDelete.date).toLocaleDateString() : "selected date"} has been permanently removed.`,
      })
    } catch (error) {
      console.error("Error deleting timesheet entry:", error)
      toast({
        title: "Failed to Delete Timesheet Entry",
        description:
          "Unable to delete the timesheet entry. It may be linked to an invoice or there was a database error.",
        variant: "destructive",
      })
    } finally {
      setDeleting(null)
    }
  }

  if (loading && timesheetLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading data...</div>
        </div>
      </div>
    )
  }

  // Calculate pagination slices
  const invoiceTotalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE)
  const paginatedInvoices = filteredInvoices.slice(
    (invoicePage - 1) * ITEMS_PER_PAGE,
    invoicePage * ITEMS_PER_PAGE
  )

  const timesheetTotalPages = Math.ceil(filteredTimesheets.length / ITEMS_PER_PAGE)
  const paginatedTimesheets = filteredTimesheets.slice(
    (timesheetPage - 1) * ITEMS_PER_PAGE,
    timesheetPage * ITEMS_PER_PAGE
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Invoices and Timesheets</h1>
          <p className="text-muted-foreground">View and manage all invoices and timesheet entries in the system</p>
        </div>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="bg-white/70 backdrop-blur-sm border shadow-sm">
          <TabsTrigger
            value="invoices"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>Invoices ({filteredInvoices.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="timesheets"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white flex items-center space-x-2"
          >
            <Clock className="h-4 w-4" />
            <span>Timesheet Entries ({filteredTimesheets.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timesheet Entries</CardTitle>
              <CardDescription>View and manage your timesheet entries</CardDescription>
            </CardHeader>
            <CardContent>
              {timesheetLoading ? (
                <div className="text-center py-8">
                  <p>Loading timesheet entries...</p>
                </div>
              ) : filteredTimesheets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No timesheet entries found.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <PaginationControls
                      currentPage={timesheetPage}
                      totalPages={timesheetTotalPages}
                      onPageChange={setTimesheetPage}
                      itemName="entries"
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTimesheets.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{format(new Date(entry.date), "dd MMM yyyy")}</TableCell>
                          <TableCell>{entry.clientName}</TableCell>
                          <TableCell>{entry.itemName}</TableCell>
                          <TableCell>{entry.hours}h</TableCell>
                          <TableCell>
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
                          <TableCell className="text-right font-semibold">R {entry.total.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTimesheetEntry(entry.id)}
                              disabled={deleting === entry.id}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Management</CardTitle>
              <CardDescription>View and manage your invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p>Loading invoices...</p>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No invoices found.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <PaginationControls
                      currentPage={invoicePage}
                      totalPages={invoiceTotalPages}
                      onPageChange={setInvoicePage}
                      itemName="invoices"
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.clientName}</TableCell>
                          <TableCell>{format(new Date(invoice.issueDate), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant={invoice.status === "Sent" ? "default" : "secondary"}>{invoice.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">R {invoice.total.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              disabled={deleting === invoice.id}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>


                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs >
    </div >
  )
}
