// Interface for invoice summary view
export interface InvoiceSummary {
  invoice_id: string
  invoice_number: string
  inv_date: string
  due_date: string
  bill_to_client: string
  created_by_user: string
  inv_total: number
  status: string
  payment_status: string
}

// Interface for revenue by client view
export interface RevenueByClient {
  client_id: string
  client_name: string
  total_invoices: number
  total_revenue: number
  first_invoice_date: string
  last_invoice_date: string
}

// Interface for timesheet summary view
export interface TimesheetSummary {
  timesheet_id: string
  timesheet_number: string
  created_date: string
  user_name: string
  user_email: string
  total_hours: number
  entry_count: number
  total_billable_amount: number
}

// Mock data that matches the Supabase view structures
const mockInvoiceSummaryData: InvoiceSummary[] = [
  {
    invoice_id: "b881b12f-c838-43f2-9fd2-211",
    invoice_number: "INV-202508-001",
    inv_date: "2025-08-15",
    due_date: "2025-09-14",
    bill_to_client: "Bridgeway Family Church",
    created_by_user: "alice",
    inv_total: 690.0,
    status: "Sent",
    payment_status: "Pending",
  },
  {
    invoice_id: "c992c23g-d949-54g3-0ge3-322",
    invoice_number: "INV-202508-002",
    inv_date: "2025-08-12",
    due_date: "2025-09-11",
    bill_to_client: "Towel Haven",
    created_by_user: "bob",
    inv_total: 1250.0,
    status: "Sent",
    payment_status: "Paid",
  },
  {
    invoice_id: "d003d34h-e050-65h4-1hf4-433",
    invoice_number: "INV-202508-003",
    inv_date: "2025-08-10",
    due_date: "2025-09-09",
    bill_to_client: "Tess Heenan",
    created_by_user: "charlie",
    inv_total: 875.5,
    status: "Draft",
    payment_status: "Pending",
  },
  {
    invoice_id: "e114e45i-f161-76i5-2ig5-544",
    invoice_number: "INV-202508-004",
    inv_date: "2025-08-08",
    due_date: "2025-09-07",
    bill_to_client: "Jason Du Plessis",
    created_by_user: "alice",
    inv_total: 2100.0,
    status: "Sent",
    payment_status: "Overdue",
  },
  {
    invoice_id: "f225f56j-g272-87j6-3jh6-655",
    invoice_number: "INV-202508-005",
    inv_date: "2025-08-05",
    due_date: "2025-09-04",
    bill_to_client: "Monfarm Investments CC",
    created_by_user: "bob",
    inv_total: 1450.75,
    status: "Sent",
    payment_status: "Paid",
  },
]

const mockRevenueByClientData: RevenueByClient[] = [
  {
    client_id: "00a1422a-7d25-4e58-a16a-992ad17f3ef8d",
    client_name: "Towel Haven",
    total_invoices: 8,
    total_revenue: 12500.0,
    first_invoice_date: "2025-01-15",
    last_invoice_date: "2025-08-12",
  },
  {
    client_id: "01a56398a-0c4c-42d5-b763-9841f88e97a6",
    client_name: "Tess Heenan",
    total_invoices: 5,
    total_revenue: 8750.5,
    first_invoice_date: "2025-02-20",
    last_invoice_date: "2025-08-10",
  },
  {
    client_id: "01cb50c4-8a7a-47b5-bfb4-48a056195e16",
    client_name: "Jason Du Plessis",
    total_invoices: 12,
    total_revenue: 15600.0,
    first_invoice_date: "2024-11-10",
    last_invoice_date: "2025-08-08",
  },
  {
    client_id: "027ef467-c5df-444a-8f4b-93d897e52d9f",
    client_name: "Julie Rapley",
    total_invoices: 3,
    total_revenue: 4200.0,
    first_invoice_date: "2025-06-01",
    last_invoice_date: "2025-07-30",
  },
  {
    client_id: "032b5c48-7b59-4931-af19-954bd899342c",
    client_name: "Monfarm Investments CC",
    total_invoices: 6,
    total_revenue: 9850.75,
    first_invoice_date: "2025-03-15",
    last_invoice_date: "2025-08-05",
  },
  {
    client_id: "0337e2f-6c83-4a2e-8d0f-ccbfbfc67dee",
    client_name: "Sub451 Sheffield Beach (Pty) Ltd",
    total_invoices: 4,
    total_revenue: 7300.0,
    first_invoice_date: "2025-04-12",
    last_invoice_date: "2025-07-28",
  },
]

const mockTimesheetSummaryData: TimesheetSummary[] = [
  {
    timesheet_id: "ts001",
    timesheet_number: "TS-2025-001",
    created_date: "2025-08-15",
    user_name: "Alice Johnson",
    user_email: "alice@anchoraccounting.com",
    total_hours: 42.5,
    entry_count: 8,
    total_billable_amount: 2125.0,
  },
  {
    timesheet_id: "ts002",
    timesheet_number: "TS-2025-002",
    created_date: "2025-08-14",
    user_name: "Bob Smith",
    user_email: "bob@anchoraccounting.com",
    total_hours: 38.0,
    entry_count: 6,
    total_billable_amount: 1900.0,
  },
  {
    timesheet_id: "ts003",
    timesheet_number: "TS-2025-003",
    created_date: "2025-08-13",
    user_name: "Charlie Brown",
    user_email: "charlie@anchoraccounting.com",
    total_hours: 45.5,
    entry_count: 9,
    total_billable_amount: 2275.0,
  },
  {
    timesheet_id: "ts004",
    timesheet_number: "TS-2025-004",
    created_date: "2025-08-12",
    user_name: "Diana Prince",
    user_email: "diana@anchoraccounting.com",
    total_hours: 40.0,
    entry_count: 7,
    total_billable_amount: 2000.0,
  },
  {
    timesheet_id: "ts005",
    timesheet_number: "TS-2025-005",
    created_date: "2025-08-11",
    user_name: "Edward Wilson",
    user_email: "edward@anchoraccounting.com",
    total_hours: 35.5,
    entry_count: 5,
    total_billable_amount: 1775.0,
  },
]

import { supabase } from "./supabase"

// Fetch invoice summary data
export async function getInvoiceSummaryData(): Promise<InvoiceSummary[]> {
  console.log("📊 Fetching invoice summary data from Supabase...")

  try {
    const { data, error } = await supabase
      .from("anchor_view_invoice_summary")
      .select("*")
      .order("inv_date", { ascending: false })

    if (error) {
      console.error("❌ Error fetching invoice summary:", error)
      return []
    }

    console.log("✅ Fetched invoice summary records:", data?.length || 0)
    return data || []
  } catch (error) {
    console.error("❌ Unexpected error fetching invoice summary:", error)
    return []
  }
}

// Fetch revenue by client data
export async function getRevenueByClientData(): Promise<RevenueByClient[]> {
  console.log("📊 Fetching revenue by client data from Supabase...")

  try {
    const { data, error } = await supabase
      .from("anchor_view_revenue_by_client")
      .select("*")
      .order("total_revenue", { ascending: false })

    if (error) {
      console.error("❌ Error fetching revenue by client:", error)
      return []
    }

    console.log("✅ Fetched revenue by client records:", data?.length || 0)
    return data || []
  } catch (error) {
    console.error("❌ Unexpected error fetching revenue by client:", error)
    return []
  }
}

// Fetch timesheet summary data
export async function getTimesheetSummaryData(): Promise<TimesheetSummary[]> {
  console.log("📊 Fetching timesheet summary data from Supabase...")

  try {
    const { data, error } = await supabase
      .from("anchor_view_timesheet_summary")
      .select("*")
      .order("created_date", { ascending: false })

    if (error) {
      console.error("❌ Error fetching timesheet summary:", error)
      return []
    }

    console.log("✅ Fetched timesheet summary records:", data?.length || 0)
    return data || []
  } catch (error) {
    console.error("❌ Unexpected error fetching timesheet summary:", error)
    return []
  }
}

// Combined analytics function
export async function getAllReportsData() {
  console.log("📊 Fetching all reports data...")

  const [invoices, revenue, timesheets] = await Promise.all([
    getInvoiceSummaryData(),
    getRevenueByClientData(),
    getTimesheetSummaryData(),
  ])

  return {
    invoices,
    revenue,
    timesheets,
  }
}
