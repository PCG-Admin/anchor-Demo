export interface InvoiceEntry {
  id: string
  billingEntryId: string
  date: string
  itemName: string
  hours: number
  ratePerHour: number
  total: number
  comments: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  clientName: string
  clientAddress?: string
  clientEmail?: string
  issueDate: string
  dueDate: string
  entries: InvoiceEntry[]
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  status: "Pending Approval" | "Sent" | "Paid" | "Overdue"
  notes?: string
  createdBy: string
  createdAt: string
  discount?: number
}

export interface ClientInfo {
  name: string
  address: string
  email: string
  phone?: string
  bill_to?: string
  bill_to_client_name?: string
}
