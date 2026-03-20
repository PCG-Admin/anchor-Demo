"use client"

import { CommandEmpty } from "@/components/ui/command"
import { generateUniqueInvoiceNumber } from "@/lib/invoice-utils"
import type { InvoiceType } from "@/lib/invoice-utils"

import { useState, useEffect } from "react"
import { format, addDays } from "date-fns"
import { Plus, Trash2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Command, CommandList, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"

interface RetainerLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface Client {
  id: string
  client_name: string
  address?: string
  email?: string
  phone?: string
}

interface RetainerInvoiceCreatorProps {
  onSave: () => void
  onCancel: () => void
  invoiceType?: InvoiceType // Added invoiceType prop to determine invoice number format
}

export function RetainerInvoiceCreator({ onSave, onCancel, invoiceType = "retainer" }: RetainerInvoiceCreatorProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [open, setOpen] = useState(false)

  const [invoiceData, setInvoiceData] = useState({
    clientName: "",
    issueDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    taxRate: 15,
    notes: "",
  })

  const [lineItems, setLineItems] = useState<RetainerLineItem[]>([
    {
      id: "1",
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    },
  ])

  useEffect(() => {
    const fetchClients = async () => {
      try {
        console.log("[v0] Fetching clients from anchor_clients table...")
        const { data, error } = await supabase
          .from("anchor_clients")
          .select("id, client_name, address, email, phone")
          .order("client_name")

        if (error) {
          console.error("[v0] Error fetching clients:", error)
          toast({
            title: "Error Loading Clients",
            description: "Unable to load client list. Please try again.",
            variant: "destructive",
          })
          return
        }

        console.log("[v0] Fetched clients:", data?.length || 0)
        setClients(data || [])
      } catch (error) {
        console.error("[v0] Error fetching clients:", error)
        toast({
          title: "Error Loading Clients",
          description: "Unable to load client list. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingClients(false)
      }
    }

    fetchClients()
  }, [])

  const addLineItem = () => {
    const newItem: RetainerLineItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    }
    setLineItems([...lineItems, newItem])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof RetainerLineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          if (field === "quantity" || field === "unitPrice") {
            updatedItem.total = updatedItem.quantity * updatedItem.unitPrice
          }
          return updatedItem
        }
        return item
      }),
    )
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const taxAmount = subtotal * (invoiceData.taxRate / 100)
  const total = subtotal + taxAmount

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to create retainer invoices.",
        variant: "destructive",
      })
      return
    }

    if (!invoiceData.clientName) {
      toast({
        title: "Client Required",
        description: "Please select a client for the retainer invoice.",
        variant: "destructive",
      })
      return
    }

    if (lineItems.some((item) => !item.description.trim())) {
      toast({
        title: "Description Required",
        description: "Please provide descriptions for all line items.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      const invoiceNumber = await generateUniqueInvoiceNumber(invoiceType)

      const { data: invoiceDataResult, error: invoiceError } = await supabase
        .from("anchor_invoices")
        .insert({
          invoice_number: invoiceNumber,
          bill_to: invoiceData.clientName,
          inv_date: invoiceData.issueDate,
          due_date: invoiceData.dueDate,
          created_by: user.id,
          inv_total: total,
          status: "Pending Approval",
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      const retainerLines = lineItems.map((item) => ({
        invoice_id: invoiceDataResult.uid,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
      }))

      const { error: linesError } = await supabase.from("anchor_retainer_lines").insert(retainerLines)

      if (linesError) throw linesError

      const invoiceTypeLabel = invoiceType === "subcontractor" ? "Sub-Contractor" : "Retainer"
      toast({
        title: `${invoiceTypeLabel} Invoice Created!`,
        description: `${invoiceTypeLabel} invoice ${invoiceNumber} for R${total.toLocaleString()} has been created and is awaiting approval.`,
      })

      onSave()
    } catch (error: any) {
      console.error("Error creating retainer invoice:", error?.code, error?.message, error?.details, error?.hint)
      toast({
        title: "Failed to Create Invoice",
        description: "Unable to create the retainer invoice. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedClient = clients.find((client) => client.client_name === invoiceData.clientName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Back to Invoicing
        </Button>
        <Button onClick={handleSave} disabled={saving || !invoiceData.clientName}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Creating..." : `Create ${invoiceType === "subcontractor" ? "Sub-Contractor" : "Retainer"} Invoice`}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create {invoiceType === "subcontractor" ? "Sub-Contractor" : "Retainer"} Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="client">Client *</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between bg-transparent"
                      disabled={loadingClients}
                    >
                      {invoiceData.clientName
                        ? clients.find((client) => client.client_name === invoiceData.clientName)?.client_name
                        : loadingClients
                          ? "Loading clients..."
                          : "Select a client..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.client_name}
                              onSelect={(currentValue) => {
                                setInvoiceData((prev) => ({
                                  ...prev,
                                  clientName: currentValue === invoiceData.clientName ? "" : currentValue,
                                }))
                                setOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  invoiceData.clientName === client.client_name ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {client.client_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={invoiceData.issueDate}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, issueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={invoiceData.dueDate}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  value={invoiceData.taxRate}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, taxRate: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {selectedClient && (
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Bill To:</h3>
                <div className="text-sm text-gray-700">
                  <p className="font-medium">{selectedClient.client_name}</p>
                  {selectedClient.address && <p className="whitespace-pre-line">{selectedClient.address}</p>}
                  {selectedClient.email && <p>{selectedClient.email}</p>}
                  {selectedClient.phone && <p>{selectedClient.phone}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description *</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        placeholder="Enter description..."
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, "unitPrice", Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">R {item.total.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      {lineItems.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <div className="w-80">
              <div className="space-y-3 text-right">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-medium text-gray-900">R {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-700">VAT ({invoiceData.taxRate}%):</span>
                  <span className="font-medium text-gray-900">R {taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3 border-b-2 border-gray-300">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-lg font-bold text-gray-900">R {total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes or terms..."
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
