"use client"

import { format } from "date-fns"
import { addDays } from "date-fns"
import { Printer, Download, Send, Save, Edit2, X, Plus } from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { sendInvoiceToWebhook, type WebhookInvoiceData } from "@/lib/webhook"
import { generateInvoicePDF } from "@/lib/pdf-generator"
import { generateInvoiceXML } from "@/lib/xml-generator"
import {
  saveInvoice,
  updateInvoice,
  updateTimesheetEntriesWithInvoiceId,
  removeTimesheetEntryFromInvoice,
  addTimesheetEntryToInvoice,
  getAvailableTimesheetEntriesForClient,
  deleteInvoice,
  getTimesheetEntriesForInvoice,
  type BillingEntry,
  supabase, // Import the existing supabase client instead of creating a new one
} from "@/lib/supabase"
import type { Invoice, InvoiceEntry } from "../types/invoice"
import { clientsInfo } from "../data/clientData"
import { generateUniqueInvoiceNumber } from "@/lib/invoice-utils"
import type { InvoiceType } from "@/lib/invoice-utils"

interface RetainerLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface InvoicePreviewProps {
  clientName: string
  entries: InvoiceEntry[]
  onSave: (invoice: Invoice) => void
  onCancel: () => void
  isEditing?: boolean
  invoiceId?: string
  onRefreshBillableEntries?: () => void
  invoiceStatus?: string
  invoiceType?: InvoiceType
}

export function InvoicePreview({
  clientName,
  entries,
  onSave,
  onCancel,
  isEditing = false,
  invoiceId,
  onRefreshBillableEntries,
  invoiceStatus: propInvoiceStatus,
  invoiceType: propInvoiceType = "regular",
}: InvoicePreviewProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [editMode, setEditMode] = useState(isEditing)
  const [currentEntries, setCurrentEntries] = useState<InvoiceEntry[]>(entries)
  const [availableEntries, setAvailableEntries] = useState<BillingEntry[]>([])
  const [showAddEntries, setShowAddEntries] = useState(false)
  const [invoiceStatus, setInvoiceStatus] = useState<string>(propInvoiceStatus || "Pending Approval")
  const [loading, setLoading] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage")
  const [retainerLineItems, setRetainerLineItems] = useState<RetainerLineItem[]>([])
  const [invoiceData, setInvoiceData] = useState<any>(null)

  const getPlaceholderInvoiceNumber = (type: InvoiceType) => {
    const dateStamp = format(new Date(), "yyyyMMdd")
    const prefix = type === "retainer" ? "R-INV" : type === "subcontractor" ? "SC-INV" : "INV"
    return `${prefix}-${dateStamp}-XXXX`
  }

  const [editableInvoice, setEditableInvoice] = useState({
    invoiceNumber: getPlaceholderInvoiceNumber(propInvoiceType),
    issueDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    taxRate: 15,
    notes: "",
  })

  const isRetainerInvoice =
    propInvoiceType === "retainer" ||
    invoiceData?.invoice_number?.toLowerCase().startsWith("r-inv") ||
    editableInvoice.invoiceNumber.toLowerCase().startsWith("r-inv")

  const isPlanInvoice = invoiceData?.plan_id !== null && invoiceData?.plan_id !== undefined

  const isSubContractorInvoice =
    propInvoiceType === "subcontractor" ||
    invoiceData?.invoice_number?.toLowerCase().startsWith("sc-inv") ||
    editableInvoice.invoiceNumber.toLowerCase().startsWith("sc-inv")

  const hasLineItems = retainerLineItems.length > 0 || isPlanInvoice

  const invoiceLabel = isRetainerInvoice
    ? "Retainer invoice"
    : isPlanInvoice
      ? "Plan invoice"
      : isSubContractorInvoice
        ? "Sub-Contractor invoice"
        : "Invoice"

  useEffect(() => {
    const loadInvoiceData = async () => {
      if (invoiceId) {
        setLoading(true)
        try {
          console.log("🔍 Loading invoice data for:", invoiceId)
          const { data: invoice, error: invoiceError } = await supabase
            .from("anchor_invoices")
            .select("*")
            .eq("uid", invoiceId)
            .single()

          if (invoiceError) {
            throw invoiceError
          }

          setInvoiceData(invoice)

          if (invoice) {
            const invoiceNumber = invoice.invoice_number || editableInvoice.invoiceNumber
            setEditableInvoice((prev) => ({
              ...prev,
              invoiceNumber: invoiceNumber,
              issueDate: invoice.inv_date || prev.issueDate,
              dueDate: invoice.due_date || prev.dueDate,
              notes: invoice.notes || "",
            }))

            setInvoiceStatus(invoice.status || "Pending Approval")
          }

          const isRetainer = invoice.invoice_number?.toLowerCase().startsWith("r-inv")
          const isPlan = invoice.plan_id !== null
          const isSubContractor = invoice.invoice_number?.toLowerCase().startsWith("sc-inv")

          if (isSubContractor) {
            console.log("📋 Loading data for sub-contractor invoice:", invoiceId)

            const { data: lineItems, error: lineItemsError } = await supabase
              .from("anchor_retainer_lines")
              .select("*")
              .eq("invoice_id", invoiceId)

            if (lineItemsError) {
              throw lineItemsError
            }

            if (lineItems && lineItems.length > 0) {
              setRetainerLineItems(lineItems)
              console.log("✅ Loaded sub-contractor line items:", lineItems)
            } else {
              const invoiceEntries = await getTimesheetEntriesForInvoice(invoiceId)
              const transformedEntries: InvoiceEntry[] = invoiceEntries.map((entry) => ({
                id: `entry-${entry.id}`,
                billingEntryId: entry.id,
                date: entry.date,
                itemName: entry.itemName,
                hours: entry.hours,
                ratePerHour: entry.ratePerHour,
                total: entry.total,
                comments: entry.comments,
              }))
              setCurrentEntries(transformedEntries)
              console.log("✅ Loaded sub-contractor timesheet entries:", transformedEntries)
            }
          } else if (isRetainer || isPlan) {
            console.log("📋 Loading line items for invoice:", invoiceId, "Type:", isRetainer ? "Retainer" : "Plan")
            const { data: lineItems, error: lineItemsError } = await supabase
              .from("anchor_retainer_lines")
              .select("*")
              .eq("invoice_id", invoiceId)

            if (lineItemsError) {
              throw lineItemsError
            }

            setRetainerLineItems(lineItems || [])
            console.log("✅ Loaded line items:", lineItems)
          } else {
            const invoiceEntries = await getTimesheetEntriesForInvoice(invoiceId)
            const transformedEntries: InvoiceEntry[] = invoiceEntries.map((entry) => ({
              id: `entry-${entry.id}`,
              billingEntryId: entry.id,
              date: entry.date,
              itemName: entry.itemName,
              hours: entry.hours,
              ratePerHour: entry.ratePerHour,
              total: entry.total,
              comments: entry.comments,
            }))
            setCurrentEntries(transformedEntries)
            console.log("✅ Loaded timesheet entries:", transformedEntries)
          }
        } catch (error) {
          console.error("❌ Error loading invoice data:", error)
          toast({
            title: "Error loading invoice data",
            description: "Failed to load invoice information.",
            variant: "destructive",
          })
        } finally {
          setLoading(false)
        }
      }
    }

    loadInvoiceData()
  }, [invoiceId])

  useEffect(() => {
    if (editMode && user?.id) {
      loadAvailableEntries()
    }
  }, [editMode, user?.id, clientName])

  useEffect(() => {
    if (propInvoiceStatus) {
      setInvoiceStatus(propInvoiceStatus)
    }
  }, [propInvoiceStatus])

  const loadAvailableEntries = async () => {
    if (!user?.id) return

    try {
      const available = await getAvailableTimesheetEntriesForClient(user.id, clientName)
      setAvailableEntries(available)
    } catch (error) {
      console.error("Error loading available entries:", error)
    }
  }

  const clientInfo = clientsInfo.find((client) => client.name === clientName)

  const subtotal = hasLineItems
    ? retainerLineItems.reduce((sum, item) => sum + item.total, 0)
    : currentEntries.reduce((sum, entry) => sum + entry.total, 0)
  const discountAmount = discountType === "percentage" ? (subtotal * discount) / 100 : discount
  const discountedSubtotal = subtotal - discountAmount
  const taxAmount = discountedSubtotal * (editableInvoice.taxRate / 100)
  const total = discountedSubtotal + taxAmount

  useEffect(() => {
    if (isEditing && invoiceId && currentEntries.length > 0) {
      const updateInvoiceTotal = async () => {
        try {
          await updateInvoice(invoiceId, { inv_total: total })
        } catch (error) {
          console.error("Error updating invoice total:", error)
        }
      }
      updateInvoiceTotal()
    }
  }, [total, isEditing, invoiceId, currentEntries.length])

  const handleRemoveEntry = async (entryId: string) => {
    if (!invoiceId) {
      setCurrentEntries((prev) => prev.filter((entry) => entry.billingEntryId !== entryId))
      return
    }

    try {
      await removeTimesheetEntryFromInvoice(entryId)
      const newEntries = currentEntries.filter((entry) => entry.billingEntryId !== entryId)
      setCurrentEntries(newEntries)

      if (newEntries.length === 0) {
        await deleteInvoice(invoiceId)
        toast({
          title: "Invoice deleted",
          description: "Invoice was deleted because it had no timesheet entries.",
        })
        onCancel()
        return
      }

      await loadAvailableEntries()
      if (onRefreshBillableEntries) {
        onRefreshBillableEntries()
      }
      toast({
        title: "Entry removed",
        description: "Timesheet entry has been removed from the invoice.",
      })
    } catch (error) {
      console.error("Error removing entry:", error)
      toast({
        title: "Error",
        description: "Failed to remove entry from invoice.",
        variant: "destructive",
      })
    }
  }

  const handleAddEntry = async (billingEntry: BillingEntry) => {
    const newInvoiceEntry: InvoiceEntry = {
      id: `entry-${Date.now()}`,
      billingEntryId: billingEntry.id,
      date: billingEntry.date,
      itemName: billingEntry.itemName,
      hours: billingEntry.hours,
      ratePerHour: billingEntry.ratePerHour,
      total: billingEntry.total,
      comments: billingEntry.comments,
    }

    if (invoiceId) {
      try {
        await addTimesheetEntryToInvoice(billingEntry.id, invoiceId)
        setCurrentEntries((prev) => [...prev, newInvoiceEntry])
        await loadAvailableEntries()
        if (onRefreshBillableEntries) {
          onRefreshBillableEntries()
        }
        toast({
          title: "Entry added",
          description: "Timesheet entry has been added to the invoice.",
        })
      } catch (error) {
        console.error("Error adding entry:", error)
        toast({
          title: "Error",
          description: "Failed to add entry to invoice.",
          variant: "destructive",
        })
      }
    } else {
      setCurrentEntries((prev) => [...prev, newInvoiceEntry])
    }
  }

  const handleSave = async (status: "Pending Approval" | "Sent") => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to save invoices. Please log in and try again.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    if (status === "Sent") {
      setSending(true)
    }

    try {
      const invoiceNumberType: InvoiceType =
        propInvoiceType === "subcontractor" || isSubContractorInvoice
          ? "subcontractor"
          : propInvoiceType === "retainer" || isRetainerInvoice
            ? "retainer"
            : "regular"

      let invoiceNumber = editableInvoice.invoiceNumber
      if (!isEditing || invoiceNumber.includes("XXXX")) {
        invoiceNumber = await generateUniqueInvoiceNumber(invoiceNumberType)
        setEditableInvoice((prev) => ({ ...prev, invoiceNumber }))
      }

      const invoiceData = {
        invoice_number: invoiceNumber,
        bill_to: clientName,
        inv_date: editableInvoice.issueDate,
        due_date: editableInvoice.dueDate,
        created_by: user.id,
        inv_total: total,
        status,
      }

      let savedInvoice

      if (isEditing && invoiceId) {
        savedInvoice = await updateInvoice(invoiceId, invoiceData)
      } else {
        savedInvoice = await saveInvoice(invoiceData)
        const entryIds = currentEntries.map((entry) => entry.billingEntryId)
        await updateTimesheetEntriesWithInvoiceId(entryIds, savedInvoice.uid!)
      }

      const invoice: Invoice = {
        id: savedInvoice.uid!,
        invoiceNumber: invoiceNumber,
        clientName,
        clientAddress: clientInfo?.address,
        clientEmail: clientInfo?.email,
        issueDate: editableInvoice.issueDate,
        dueDate: editableInvoice.dueDate,
        lineItems: hasLineItems
          ? retainerLineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.total,
            }))
          : currentEntries.map((entry) => ({
              description: entry.itemName + (entry.comments ? ` - ${entry.comments}` : ""),
              quantity: entry.hours,
              unit_price: entry.ratePerHour,
              total: entry.total,
            })),
        entries: currentEntries,
        subtotal,
        discountAmount,
        discountType,
        taxRate: editableInvoice.taxRate,
        taxAmount,
        totalAmount: total,
        total,
        status,
        notes: editableInvoice.notes,
        createdBy: user?.username || "Unknown User",
        createdAt: savedInvoice.created_at || new Date().toISOString(),
      }

      if (status === "Sent") {
        try {
          const pdfDocument = generateInvoicePDF(invoice)
          const xmlDocument = generateInvoiceXML(invoice)

          const webhookData: WebhookInvoiceData = {
            invoiceDate: editableInvoice.issueDate,
            totalAmount: total,
            invoiceNumber: invoiceNumber,
            billToClient: clientName,
            userName: user?.username || "Unknown User",
            documentType: "Invoice",
            pdfDocument,
            xmlDocument,
          }

          await sendInvoiceToWebhook(webhookData)

          toast({
            title: "Invoice Approved and Sent Successfully!",
            description: `${invoiceLabel} ${invoiceNumber} for R${total.toLocaleString()} has been approved and sent to ${clientName}.`,
          })
        } catch (webhookError) {
          console.error("Webhook error:", webhookError)
          toast({
            title: "Invoice Approved but Delivery Failed",
            description: `Invoice ${invoiceNumber} was approved but failed to send. Please try sending again.`,
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: isEditing ? "Invoice Updated Successfully!" : "Invoice Saved for Approval!",
          description: `${invoiceLabel} ${invoiceNumber} for R${total.toLocaleString()} has been ${isEditing ? "updated" : "saved"} and is awaiting manager approval.`,
        })
      }

      onSave(invoice)
    } catch (error) {
      console.error("❌ Error saving invoice:", error)
      toast({
        title: "Failed to Save Invoice",
        description: "Unable to save the invoice due to a database error. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
      setSending(false)
    }
  }

  const handlePrint = () => {
    window.print()
    toast({
      title: "Printing invoice",
      description: "Invoice is being prepared for printing.",
    })
  }

  const handleDownload = () => {
    const invoice: Invoice = {
      id: invoiceId || `temp-${Date.now()}`,
      invoiceNumber: editableInvoice.invoiceNumber,
      clientName,
      clientAddress: clientInfo?.address,
      clientEmail: clientInfo?.email,
      issueDate: editableInvoice.issueDate,
      dueDate: editableInvoice.dueDate,
      lineItems: hasLineItems
        ? retainerLineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          }))
        : currentEntries.map((entry) => ({
            description: entry.itemName + (entry.comments ? ` - ${entry.comments}` : ""),
            quantity: entry.hours,
            unit_price: entry.ratePerHour,
            total: entry.total,
          })),
      entries: currentEntries,
      subtotal,
      discountAmount,
      discountType,
      taxRate: editableInvoice.taxRate,
      taxAmount,
      total,
      status: invoiceStatus as "Draft" | "Sent" | "Paid" | "Overdue",
      notes: editableInvoice.notes,
      createdBy: user?.username || "Unknown User",
      createdAt: new Date().toISOString(),
    }

    try {
      const pdfDocument = generateInvoicePDF(invoice)
      const xmlDocument = generateInvoiceXML(invoice)

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
        title: "PDF Downloaded Successfully!",
        description: `Invoice ${editableInvoice.invoiceNumber} has been downloaded to your device.`,
      })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "PDF Generation Failed",
        description: "Unable to generate the PDF file. Please try again or contact support if the problem persists.",
        variant: "destructive",
      })
    }
  }

  const canEdit = invoiceStatus === "Pending Approval"
  const isManager = user?.role === "admin"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onCancel} disabled={saving || sending}>
          Back to {isEditing ? "Pending Approval" : "Selection"}
        </Button>
        <div className="flex items-center space-x-2">
          {!editMode && canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)} disabled={saving || sending}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={saving || sending}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={saving || sending}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          {canEdit && (
            <Button variant="outline" onClick={() => handleSave("Pending Approval")} disabled={saving || sending}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : isEditing ? "Update for Approval" : "Save for Approval"}
            </Button>
          )}
          {canEdit && isManager && (
            <Button
              onClick={() => handleSave("Sent")}
              disabled={saving || sending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Approving..." : "Approve & Send"}
            </Button>
          )}
          {!canEdit && (
            <Button onClick={() => handleSave("Sent")} disabled={saving || sending}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : saving ? "Saving..." : "Send Invoice"}
            </Button>
          )}
        </div>
      </div>

      {editMode && canEdit && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-blue-900">Edit Invoice Details</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={editableInvoice.invoiceNumber}
                    onChange={(e) => setEditableInvoice((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={editableInvoice.issueDate}
                    onChange={(e) => setEditableInvoice((prev) => ({ ...prev, issueDate: e.target.value }))}
                  />
                </div>
                {isManager && (
                  <div>
                    <Label htmlFor="discount">Discount</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="discount"
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        placeholder="0"
                      />
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">R</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={editableInvoice.dueDate}
                    onChange={(e) => setEditableInvoice((prev) => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    value={editableInvoice.taxRate}
                    onChange={(e) =>
                      setEditableInvoice((prev) => ({
                        ...prev,
                        taxRate: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes or terms..."
                  value={editableInvoice.notes}
                  onChange={(e) => setEditableInvoice((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddEntries(!showAddEntries)}>
                <Plus className="h-4 w-4 mr-2" />
                {showAddEntries ? "Hide" : "Add"} Timesheet Entries
              </Button>
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Done Editing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editMode && showAddEntries && availableEntries.length > 0 && canEdit && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-900">Available Timesheet Entries</h3>
            <div className="space-y-2">
              {availableEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium">{format(new Date(entry.date), "dd MMM yyyy")}</span>
                      <span className="text-sm">{entry.itemName}</span>
                      <span className="text-sm text-muted-foreground">
                        {entry.hours}h @ R{entry.ratePerHour}
                      </span>
                      <span className="text-sm font-medium">R{entry.total.toLocaleString()}</span>
                    </div>
                    {entry.comments && <p className="text-xs text-muted-foreground mt-1">{entry.comments}</p>}
                  </div>
                  <Button size="sm" onClick={() => handleAddEntry(entry)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!canEdit && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <p className="text-yellow-800 text-sm">
              This invoice has been sent and cannot be edited. Only pending approval invoices can be modified.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
              <p className="text-lg font-semibold text-gray-700">#{editableInvoice.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invoices</h2>
              <p className="text-gray-600">Professional Accounting Services</p>
              <p className="text-gray-600">accounting@invoices.co.za</p>
              <p className="text-gray-600">+27 11 123 4567</p>
              <p className="text-gray-600">Cape Town, South Africa</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Bill To:</h3>
              <div className="text-gray-700">
                <p className="font-medium text-lg">{clientName}</p>
                {clientInfo?.address && <p className="whitespace-pre-line">{clientInfo.address}</p>}
                {clientInfo?.email && <p>{clientInfo.email}</p>}
                {clientInfo?.phone && <p>{clientInfo.phone}</p>}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Invoice Details:</h3>
              <div className="space-y-2 text-gray-700">
                <div className="flex justify-between">
                  <span>Issue Date:</span>
                  <span className="font-medium">{format(new Date(editableInvoice.issueDate), "dd MMM yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Due Date:</span>
                  <span className="font-medium">{format(new Date(editableInvoice.dueDate), "dd MMM yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span
                    className={`font-medium px-2 py-1 rounded text-xs ${
                      invoiceStatus === "Pending Approval"
                        ? "bg-yellow-100 text-yellow-800"
                        : invoiceStatus === "Sent"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                    }`}
                  >
                    {invoiceStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isRetainerInvoice
                ? "Retainer Services:"
                : isPlanInvoice
                  ? "Payment Plan Services:"
                  : isSubContractorInvoice
                    ? "Sub-Contractor Services:"
                    : "Services Provided:"}
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading invoice data...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-gray-300">
                    {hasLineItems ? (
                      <>
                        <TableHead className="font-semibold text-gray-900">Description</TableHead>
                        <TableHead className="text-right font-semibold text-gray-900">Quantity</TableHead>
                        <TableHead className="text-right font-semibold text-gray-900">Unit Price</TableHead>
                        <TableHead className="text-right font-semibold text-gray-900">Total</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="font-semibold text-gray-900">Date</TableHead>
                        <TableHead className="font-semibold text-gray-900">Description</TableHead>
                        <TableHead className="text-right font-semibold text-gray-900">Hours</TableHead>
                        <TableHead className="text-right font-semibold text-gray-900">Rate</TableHead>
                        <TableHead className="text-right font-semibold text-gray-900">Amount</TableHead>
                      </>
                    )}
                    {editMode && canEdit && (
                      <TableHead className="text-right font-semibold text-gray-900">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hasLineItems ? (
                    retainerLineItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={editMode && canEdit ? 5 : 4} className="text-center py-8 text-gray-500">
                          No line items found for this invoice.
                        </TableCell>
                      </TableRow>
                    ) : (
                      retainerLineItems.map((item) => (
                        <TableRow key={item.id} className="border-b border-gray-200">
                          <TableCell className="py-3">
                            <p className="font-medium text-gray-900">{item.description}</p>
                          </TableCell>
                          <TableCell className="text-right py-3">{item.quantity}</TableCell>
                          <TableCell className="text-right py-3">R {item.unit_price.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium py-3">R {item.total.toLocaleString()}</TableCell>
                          {editMode && canEdit && (
                            <TableCell className="text-right py-3">
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )
                  ) : currentEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={editMode && canEdit ? 6 : 5} className="text-center py-8 text-gray-500">
                        No timesheet entries selected for this invoice.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentEntries.map((entry) => (
                      <TableRow key={entry.id} className="border-b border-gray-200">
                        <TableCell className="py-3">{format(new Date(entry.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="py-3">
                          <div>
                            <p className="font-medium text-gray-900">{entry.itemName}</p>
                            {entry.comments && <p className="text-sm text-gray-600 mt-1">{entry.comments}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3">{entry.hours}</TableCell>
                        <TableCell className="text-right py-3">R {entry.ratePerHour.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium py-3">R {entry.total.toLocaleString()}</TableCell>
                        {editMode && canEdit && (
                          <TableCell className="text-right py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEntry(entry.billingEntryId)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {((hasLineItems && retainerLineItems.length > 0) || (!hasLineItems && currentEntries.length > 0)) && (
            <div className="flex justify-end mb-8">
              <div className="w-80">
                <div className="space-y-3 text-right">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-medium text-gray-900">R {subtotal.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-700">
                        Discount ({discountType === "percentage" ? `${discount}%` : `R${discount.toLocaleString()}`}):
                      </span>
                      <span className="font-medium text-red-600">-R {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-700">VAT ({editableInvoice.taxRate}%):</span>
                    <span className="font-medium text-gray-900">R {taxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b-2 border-gray-300">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-gray-900">R {total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {editableInvoice.notes && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes:</h3>
              <p className="text-gray-700 whitespace-pre-line">{editableInvoice.notes}</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6 text-center text-gray-600">
            <p className="text-sm">Thank you for your business!</p>
            <p className="text-xs mt-2">
              Payment terms: Net{" "}
              {Math.ceil(
                (new Date(editableInvoice.dueDate).getTime() - new Date(editableInvoice.issueDate).getTime()) /
                  (1000 * 60 * 60 * 24),
              )}{" "}
              days
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
