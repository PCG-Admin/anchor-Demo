export interface BillingEntry {
  id: string
  loginName: string
  date: string
  activity: "External" | "Internal" | "Sub-Contractor" | "Recurring Service"
  clientName: string
  itemName: string
  hours: number
  billable: "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported"
  standardItemFee: number
  ratePerHour: number
  total: number
  markup?: number
  comments: string
  retainer: "Yes" | "No"
  billToClient: string
  invoiceId?: string | null
  clientId?: string
  xeroItemCode?: string | null
  source?: "timesheet" | "recurring"
}

export interface ServiceItem {
  name: string
  rate: number
}

export interface ClientSummary {
  clientName: string
  totalHours: number
  totalBilling: number
  billableHours: number
  nonBillableHours: number
}

export interface StaffSummary {
  staffName: string
  totalHours: number
  billableHours: number
  totalIncome: number
  clientsServed: number
}
