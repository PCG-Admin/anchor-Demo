"use client"

import { useState, useEffect } from "react"
import { format, addMonths } from "date-fns"
import { CalendarIcon, Plus, CreditCard, CheckCircle, Clock, AlertCircle, Edit, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useAuth } from "../contexts/auth-context"
import { generateUniqueInvoiceNumber } from "../lib/invoice-utils"
import {
  getInvoicePlans,
  createInvoicePlan,
  getInvoicesForPlan,
  createPlanInvoices,
  getClients,
  updateInvoice,
  createInvoiceLineItems,
} from "@/lib/supabase"

interface Client {
  id: string
  client_name: string
}

interface InvoicePlan {
  plan_id: string
  total_amount: number
  total_installments: number
  created_by: string
  created_at: string
  client_name?: string
  bill_to_client?: string
  invoice_type?: string
}

interface PlanInvoice {
  uid: string
  invoice_number: string
  bill_to: string
  inv_date: string
  due_date: string
  inv_total: number
  status: string
  plan_id: string
  installment_number: number
}

interface InvoicePlansProps {
  onRefresh?: () => void
}

export function InvoicePlans({ onRefresh }: InvoicePlansProps) {
  const [plans, setPlans] = useState<InvoicePlan[]>([])
  const [planInvoices, setPlanInvoices] = useState<PlanInvoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null)
  const [editInvoiceData, setEditInvoiceData] = useState<Partial<PlanInvoice>>({})
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    clientId: "",
    clientName: "",
    billToClient: "",
    invoiceType: "regular" as "regular" | "retainer" | "subcontractor",
    totalAmount: "",
    installments: "",
    startDate: undefined as Date | undefined,
    description: "",
  })

  useEffect(() => {
    loadPlansAndInvoices()
    loadClients()
  }, [user?.id])

  const loadClients = async () => {
    try {
      const clientsData = await getClients()
      setClients(clientsData)
    } catch (error) {
      console.error("Error loading clients:", error)
    }
  }

  const loadPlansAndInvoices = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const plansData = await getInvoicePlans(user.id)

      const allInvoices: PlanInvoice[] = []
      for (const plan of plansData) {
        const invoices = await getInvoicesForPlan(plan.plan_id)
        allInvoices.push(
          ...invoices.map((inv) => ({
            ...inv,
            plan_id: inv.plan_id || plan.plan_id,
            installment_number: inv.installment_number || 1,
          })),
        )
      }

      setPlans(plansData)
      setPlanInvoices(allInvoices)
    } catch (error) {
      console.error("Error loading plans and invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlan = async () => {
    if (
      !user?.id ||
      !formData.clientId ||
      !formData.totalAmount ||
      !formData.installments ||
      !formData.startDate ||
      !formData.description
    ) {
      return
    }

    try {
      const totalAmount = Number.parseFloat(formData.totalAmount)
      const installments = Number.parseInt(formData.installments)
      const installmentAmount = totalAmount / installments

      const planData = await createInvoicePlan({
        total_amount: totalAmount,
        total_installments: installments,
        created_by: user.id,
      })

      const invoices = []
      for (let i = 1; i <= installments; i++) {
        const dueDate = addMonths(formData.startDate, i - 1)
        const invoiceNumber = await generateUniqueInvoiceNumber(formData.invoiceType)

        invoices.push({
          invoice_number: invoiceNumber,
          bill_to: formData.billToClient || formData.clientName,
          inv_date: format(formData.startDate, "yyyy-MM-dd"),
          due_date: format(dueDate, "yyyy-MM-dd"),
          inv_total: installmentAmount,
          status: "Draft",
          plan_id: planData.plan_id,
          installment_number: i,
          created_by: user.id,
        })
      }

      const createdInvoices = await createPlanInvoices(invoices)

      const lineItems = createdInvoices.map((invoice, index) => ({
        invoice_id: invoice.uid!,
        description: `${formData.description} - Installment ${index + 1} of ${installments}`,
        quantity: 1,
        unit_price: installmentAmount,
        total: installmentAmount,
      }))

      await createInvoiceLineItems(lineItems)

      setFormData({
        clientId: "",
        clientName: "",
        billToClient: "",
        invoiceType: "regular",
        totalAmount: "",
        installments: "",
        startDate: undefined,
        description: "",
      })
      setShowCreateDialog(false)
      loadPlansAndInvoices()
      onRefresh?.()
    } catch (error) {
      console.error("Error creating payment plan:", error)
    }
  }

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find((c) => c.id === clientId)
    if (selectedClient) {
      setFormData((prev) => ({
        ...prev,
        clientId,
        clientName: selectedClient.client_name,
        billToClient: selectedClient.client_name,
      }))
    }
  }

  const handleEditInvoice = (invoice: PlanInvoice) => {
    setEditingInvoice(invoice.uid)
    setEditInvoiceData({
      inv_total: invoice.inv_total,
      due_date: invoice.due_date,
      bill_to: invoice.bill_to,
    })
  }

  const handleSaveInvoiceEdit = async (invoiceId: string) => {
    try {
      await updateInvoice(invoiceId, editInvoiceData)
      setEditingInvoice(null)
      setEditInvoiceData({})
      loadPlansAndInvoices()
    } catch (error) {
      console.error("Error updating invoice:", error)
    }
  }

  const handleSendForApproval = async (invoiceId: string) => {
    try {
      const invoice = planInvoices.find((inv) => inv.uid === invoiceId)
      if (invoice) {
        const subtotal = invoice.inv_total
        const vatRate = 0.15 // 15% VAT
        const vatAmount = subtotal * vatRate
        const totalWithVat = subtotal + vatAmount

        await updateInvoice(invoiceId, {
          status: "Pending Approval",
          inv_total: totalWithVat,
        })
      } else {
        await updateInvoice(invoiceId, { status: "Pending Approval" })
      }
      loadPlansAndInvoices()
    } catch (error) {
      console.error("Error sending invoice for approval:", error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "Sent":
      case "Pending Approval":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "Overdue":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      Paid: "bg-green-100 text-green-800",
      Sent: "bg-blue-100 text-blue-800",
      "Pending Approval": "bg-yellow-100 text-yellow-800",
      Overdue: "bg-red-100 text-red-800",
      Draft: "bg-gray-100 text-gray-800",
    }
    return variants[status as keyof typeof variants] || variants.Draft
  }

  const getPlanProgress = (planId: string) => {
    const invoices = planInvoices.filter((inv) => inv.plan_id === planId)
    const paidInvoices = invoices.filter((inv) => inv.status === "Paid")
    return {
      total: invoices.length,
      paid: paidInvoices.length,
      percentage: invoices.length > 0 ? (paidInvoices.length / invoices.length) * 100 : 0,
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p>Loading invoice plans...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invoice Plans</h2>
          <p className="text-gray-600">Create and manage payment plans with automatic invoice generation</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600">
              <Plus className="h-4 w-4 mr-2" />
              Create Payment Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Payment Plan</DialogTitle>
              <DialogDescription>Set up a new payment plan with automatic invoice generation</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Select Client</Label>
                <Select value={formData.clientId} onValueChange={handleClientSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billToClient">Bill To Client</Label>
                <Input
                  id="billToClient"
                  value={formData.billToClient}
                  onChange={(e) => setFormData((prev) => ({ ...prev, billToClient: e.target.value }))}
                  placeholder="Enter billing client name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceType">Invoice Type</Label>
                <Select
                  value={formData.invoiceType}
                  onValueChange={(value: "regular" | "retainer" | "subcontractor") =>
                    setFormData((prev) => ({ ...prev, invoiceType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Invoice</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                    <SelectItem value="subcontractor">Sub-Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description for line items (e.g., Monthly Service Fee)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Amount (R)</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, totalAmount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installments">Number of Installments</Label>
                <Input
                  id="installments"
                  type="number"
                  value={formData.installments}
                  onChange={(e) => setFormData((prev) => ({ ...prev, installments: e.target.value }))}
                  placeholder="12"
                />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? format(formData.startDate, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => setFormData((prev) => ({ ...prev, startDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePlan}>Create Plan</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CreditCard className="h-16 w-16 text-teal-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Payment Plans</h3>
              <p className="text-gray-600 mb-6">
                Create your first payment plan to automatically generate invoices for installment payments.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const progress = getPlanProgress(plan.plan_id)
            const invoices = planInvoices.filter((inv) => inv.plan_id === plan.plan_id)

            return (
              <Card key={plan.plan_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Payment Plan - R {plan.total_amount.toLocaleString()}</CardTitle>
                      <CardDescription>
                        {plan.total_installments} installments • Created {format(new Date(plan.created_at), "PPP")}
                        {invoices.length > 0 && (
                          <span className="block text-sm text-gray-600 mt-1">Bill To: {invoices[0].bill_to}</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600 mb-2">
                        {progress.paid} of {progress.total} paid
                      </div>
                      <Progress value={progress.percentage} className="w-32" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice Number</TableHead>
                        <TableHead>Installment</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.uid}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            {invoice.installment_number} of {plan.total_installments}
                          </TableCell>
                          <TableCell>
                            {editingInvoice === invoice.uid ? (
                              <Input
                                type="number"
                                value={editInvoiceData.inv_total || invoice.inv_total}
                                onChange={(e) =>
                                  setEditInvoiceData((prev) => ({ ...prev, inv_total: Number(e.target.value) }))
                                }
                                className="w-24"
                              />
                            ) : (
                              `R ${invoice.inv_total.toLocaleString()}`
                            )}
                          </TableCell>
                          <TableCell>
                            {editingInvoice === invoice.uid ? (
                              <Input
                                type="date"
                                value={editInvoiceData.due_date || invoice.due_date}
                                onChange={(e) => setEditInvoiceData((prev) => ({ ...prev, due_date: e.target.value }))}
                                className="w-36"
                              />
                            ) : (
                              format(new Date(invoice.due_date), "PPP")
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(invoice.status)}
                              <Badge className={getStatusBadge(invoice.status)}>{invoice.status}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {editingInvoice === invoice.uid ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveInvoiceEdit(invoice.uid)}
                                    className="h-8 px-2"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingInvoice(null)}
                                    className="h-8 px-2"
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditInvoice(invoice)}
                                    className="h-8 px-2"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  {invoice.status === "Draft" && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleSendForApproval(invoice.uid)}
                                      className="h-8 px-2 bg-green-600 hover:bg-green-700"
                                    >
                                      <Send className="h-3 w-3" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
