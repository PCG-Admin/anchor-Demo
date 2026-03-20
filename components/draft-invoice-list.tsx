"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Edit, CheckCircle, Trash2, Percent } from "lucide-react"
import { PaginationControls } from "@/components/pagination-controls"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { sendInvoiceToWebhook, type WebhookInvoiceData } from "@/lib/webhook"
import { generateInvoicePDF } from "@/lib/pdf-generator"
import { generateInvoiceXML } from "@/lib/xml-generator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getDraftInvoices,
  getTimesheetEntriesForInvoice,
  updateInvoice,
  deleteInvoice,
  removeTimesheetEntryFromInvoice,
  supabase,
} from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import type { InvoiceRaw, BillingEntry } from "@/lib/supabase"
import { clientsInfo } from "../data/clientData"

const ITEMS_PER_PAGE = 20

interface DraftInvoiceListProps {
  onEditInvoice: (invoiceId: string, clientName: string, entries: BillingEntry[], invoiceNumber?: string) => void
  onRefresh?: () => void
}

export function DraftInvoiceList({ onEditInvoice, onRefresh }: DraftInvoiceListProps) {
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceRaw[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRaw | null>(null)
  const [discount, setDiscount] = useState<number>(0)
  const [page, setPage] = useState(1)
  const { user } = useAuth()

  const isManager = user?.role === "admin"

  useEffect(() => {
    loadPendingInvoices()
  }, [user?.id])

  const loadPendingInvoices = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const pending = await getDraftInvoices(user.id, isManager)
      setPendingInvoices(pending)
    } catch (error) {
      console.error("Error loading pending invoices:", error)
      toast({
        title: "Error",
        description: "Failed to load pending approval invoices",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditInvoice = async (invoice: InvoiceRaw) => {
    try {
      const isSubContractorInvoice = invoice.invoice_number?.toLowerCase().startsWith("sc-inv")

      if (isSubContractorInvoice) {
        // First check if this invoice has line items in anchor_retainer_lines
        const { data: lineItems, error: lineItemsError } = await supabase
          .from("anchor_retainer_lines")
          .select("*")
          .eq("invoice_id", invoice.uid)

        if (lineItemsError) {
          console.error("Error checking for line items:", lineItemsError)
        }

        // If line items exist, this was created via "create new invoice" method
        if (lineItems && lineItems.length > 0) {
          // Convert line items to BillingEntry format for editing
          const billingEntries: BillingEntry[] = lineItems.map((item: any) => ({
            id: item.id.toString(),
            loginName: "Sub-Contractor",
            date: invoice.inv_date,
            activity: "Sub-Contractor" as const,
            clientName: invoice.bill_to,
            itemName: item.description,
            hours: item.quantity,
            billable: "Billable" as const,
            standardItemFee: 0,
            ratePerHour: item.unit_price,
            total: item.total,
            comments: "",
            retainer: "No" as const,
            billToClient: invoice.bill_to,
            invoiceId: invoice.uid,
          }))

          onEditInvoice(invoice.uid!, invoice.bill_to, billingEntries, invoice.invoice_number)
          return
        }
      }

      // Default behavior: load timesheet entries (for Method 1 sub-contractor invoices and regular invoices)
      const entries = await getTimesheetEntriesForInvoice(invoice.uid!)
      onEditInvoice(invoice.uid!, invoice.bill_to, entries, invoice.invoice_number)
    } catch (error) {
      console.error("Error loading invoice entries:", error)
      toast({
        title: "Error",
        description: "Failed to load invoice entries for editing",
        variant: "destructive",
      })
    }
  }

  const handleApproveInvoice = async (invoice: InvoiceRaw) => {
    try {
      const finalTotal = discount > 0 ? invoice.inv_total - discount : invoice.inv_total

      await updateInvoice(invoice.uid!, {
        status: "Sent",
        inv_total: finalTotal,
        discount: discount > 0 ? discount : undefined,
      })

      try {
        console.log("[v0] Starting webhook process for invoice:", invoice.invoice_number)

        const isRetainerInvoice = invoice.invoice_number?.toLowerCase().startsWith("r-inv")
        const isPlanInvoice = (invoice as any).plan_id !== null
        const hasLineItems = isRetainerInvoice || isPlanInvoice

        console.log("[v0] Invoice type:", { isRetainerInvoice, isPlanInvoice, hasLineItems })

        let lineItems: any[] = []
        let entries: any[] = []

        if (hasLineItems) {
          const { data: retainerItems, error: retainerError } = await supabase
            .from("anchor_retainer_lines")
            .select("*")
            .eq("invoice_id", invoice.uid)

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
          }
        } else {
          const timesheetEntries = await getTimesheetEntriesForInvoice(invoice.uid!)
          entries = timesheetEntries // Keep original timesheet entry structure for PDF
          console.log("[v0] Loaded timesheet entries:", entries.length)
        }

        const clientInfo = clientsInfo.find((client) => client.name === invoice.bill_to)

        const invoiceForPDF = {
          id: invoice.uid!,
          invoiceNumber: invoice.invoice_number,
          clientName: invoice.bill_to,
          clientAddress: clientInfo?.address,
          clientEmail: clientInfo?.email,
          issueDate: invoice.inv_date,
          dueDate: invoice.due_date,
          lineItems, // For retainer and plan invoices
          entries, // For normal timesheet invoices
          subtotal: finalTotal / 1.15,
          discountAmount: discount,
          discountType: "fixed" as const,
          taxRate: 15,
          taxAmount: finalTotal - finalTotal / 1.15,
          totalAmount: finalTotal,
          total: finalTotal,
          status: "Sent" as const,
          notes: "",
          createdBy: user?.username || "Unknown User",
          createdAt: invoice.created_at || new Date().toISOString(),
        }

        console.log("[v0] Generating PDF and XML documents")
        const pdfDocument = generateInvoicePDF(invoiceForPDF)
        const xmlDocument = generateInvoiceXML(invoiceForPDF)

        const webhookData: WebhookInvoiceData = {
          invoiceDate: invoice.inv_date,
          totalAmount: finalTotal,
          invoiceNumber: invoice.invoice_number,
          billToClient: invoice.bill_to,
          userName: user?.username || "Unknown User",
          documentType: "Invoice",
          pdfDocument,
          xmlDocument,
        }

        console.log("[v0] Sending webhook data")
        await sendInvoiceToWebhook(webhookData)
        console.log("[v0] Webhook sent successfully")

        toast({
          title: "Invoice Approved & Sent Successfully!",
          description: `${hasLineItems ? "Plan/Retainer invoice" : "Invoice"} ${invoice.invoice_number} has been approved and sent successfully${discount > 0 ? ` with R${discount.toLocaleString()} discount applied` : ""}.`,
        })
      } catch (webhookError) {
        console.error("[v0] Webhook error:", webhookError)
        toast({
          title: "Invoice Approved but Delivery Failed",
          description: `Invoice ${invoice.invoice_number} was approved but failed to send to webhook. Please check the logs.`,
          variant: "destructive",
        })
      }

      loadPendingInvoices()
      onRefresh?.()
      setDiscountDialogOpen(false)
      setDiscount(0)
      setSelectedInvoice(null)
    } catch (error) {
      console.error("Error approving invoice:", error)
      toast({
        title: "Error",
        description: "Failed to approve invoice",
        variant: "destructive",
      })
    }
  }

  const handleDeleteInvoice = async (invoice: InvoiceRaw) => {
    if (!invoice.uid) return

    try {
      setDeletingId(invoice.uid)

      const entries = await getTimesheetEntriesForInvoice(invoice.uid)
      for (const entry of entries) {
        await removeTimesheetEntryFromInvoice(entry.id)
      }

      await deleteInvoice(invoice.uid)

      toast({
        title: "Invoice deleted",
        description: `Pending invoice ${invoice.invoice_number} has been deleted successfully.`,
      })

      loadPendingInvoices()
      onRefresh?.()
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Loading pending approval invoices...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Approval Invoices</CardTitle>
        <CardDescription>
          {isManager
            ? "Review, edit, add discounts, and approve invoices for sending (showing all pending invoices)"
            : "View invoices awaiting manager approval (showing only your invoices)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingInvoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No invoices pending approval.</p>
            <p className="text-sm mt-2">Create an invoice to see it here awaiting approval.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <PaginationControls
                currentPage={page}
                totalPages={Math.ceil(pendingInvoices.length / ITEMS_PER_PAGE)}
                onPageChange={setPage}
                itemName="invoices"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Bill To</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvoices
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map((invoice) => (
                    <TableRow key={invoice.uid}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.bill_to}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(invoice as any).created_by_name || "Unknown User"}
                      </TableCell>
                      <TableCell>{format(new Date(invoice.inv_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{format(new Date(invoice.due_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          Pending Approval
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">R {invoice.inv_total.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {isManager && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditInvoice(invoice)}
                              className="h-8 w-8 p-0"
                              title="Edit invoice"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {isManager && (
                            <Dialog
                              open={discountDialogOpen && selectedInvoice?.uid === invoice.uid}
                              onOpenChange={(open) => {
                                setDiscountDialogOpen(open)
                                if (!open) {
                                  setSelectedInvoice(null)
                                  setDiscount(0)
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoice(invoice)
                                    setDiscountDialogOpen(true)
                                  }}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-800"
                                  title="Approve invoice"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Approve Invoice</DialogTitle>
                                  <DialogDescription>
                                    Review and approve invoice {invoice.invoice_number} for R
                                    {invoice.inv_total.toLocaleString()}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="discount">Apply Discount (Optional)</Label>
                                    <div className="flex items-center space-x-2">
                                      <Percent className="h-4 w-4 text-muted-foreground" />
                                      <Input
                                        id="discount"
                                        type="number"
                                        placeholder="0"
                                        value={discount || ""}
                                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                                        min="0"
                                        max={invoice.inv_total}
                                      />
                                    </div>
                                    {discount > 0 && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        Final amount: R{(invoice.inv_total - discount).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={() => handleApproveInvoice(invoice)}>Approve & Send</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}

                          {isManager && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title="Delete invoice"
                                  disabled={deletingId === invoice.uid}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Pending Invoice</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete invoice {invoice.invoice_number}? This action cannot be
                                    undone. All timesheet entries will be unlinked and made available for other invoices.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteInvoice(invoice)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card >
  )
}
