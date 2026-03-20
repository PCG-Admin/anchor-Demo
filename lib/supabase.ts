import { createClient } from "@supabase/supabase-js"

// Environment Variable Check
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase Environment Variables! Check your .env.local file (for local dev) or Vercel Settings (for deployment).",
  )
}

console.log("✅ Supabase configured with URL:", supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Raw database interface
export interface ServiceItemRaw {
  xero_item_code: string
  xero_sales_description: string
  sales_unit_price: string
  sales_account: number
  sales_tax_rate: string
}

export interface ServiceItem {
  code: string
  name: string
  rate: number
  account: number
  taxRate: string
}

export async function getServiceItems(): Promise<ServiceItem[]> {
  console.log("🔍 Fetching service items from anchor_task_items table...")

  try {
    const { data: testData, error: testError } = await supabase
      .from("anchor_task_items")
      .select("count", { count: "exact", head: true })

    console.log("🔗 Connection test - Row count:", testData, "Error:", testError)
  } catch (e) {
    console.error("🚫 Connection test failed:", e)
  }

  const { data, error } = await supabase.from("anchor_task_items").select("*").order("xero_sales_description")

  if (error) {
    console.error("❌ Error fetching service items:", error)
    console.error("❌ Error details:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw error
  }

  console.log("✅ Raw service items data:", data)
  console.log("📊 Number of items fetched:", data?.length || 0)

  // Transform the data to match expected format
  const transformedData = (data || []).map((item: ServiceItemRaw) => ({
    code: item.xero_item_code,
    name: item.xero_sales_description,
    rate: Number.parseFloat(item.sales_unit_price) || 0,
    account: item.sales_account,
    taxRate: item.sales_tax_rate,
  }))

  console.log("🔄 Transformed service items:", transformedData)
  return transformedData
}

export async function createServiceItem(item: Omit<ServiceItemRaw, "xero_item_code">): Promise<ServiceItemRaw> {
  const { data, error } = await supabase.from("anchor_task_items").insert([item]).select().single()

  if (error) {
    console.error("Error creating service item:", error)
    throw error
  }

  return data
}

export async function updateServiceItem(code: string, updates: Partial<ServiceItemRaw>): Promise<ServiceItemRaw> {
  const { data, error } = await supabase
    .from("anchor_task_items")
    .update(updates)
    .eq("xero_item_code", code)
    .select()
    .single()

  if (error) {
    console.error("Error updating service item:", error)
    throw error
  }

  return data
}

export async function deleteServiceItem(code: string): Promise<void> {
  const { error } = await supabase.from("anchor_task_items").delete().eq("xero_item_code", code)

  if (error) {
    console.error("Error deleting service item:", error)
    throw error
  }
}

export async function getServiceItemsRaw(): Promise<ServiceItemRaw[]> {
  const { data, error } = await supabase.from("anchor_task_items").select("*").order("xero_sales_description")

  if (error) {
    console.error("Error fetching raw service items:", error)
    throw error
  }

  return data || []
}

// Timesheet entry database functions
export interface TimesheetEntryRaw {
  id?: number
  entry_date: string
  activity: string
  client: string // UUID foreign key
  service: string
  status: string
  retainer: boolean
  bill_to_client: string
  standard_fee: number
  rate: number
  hours: number
  total: number
  markup?: number | null
  comments: string
  user: string // UUID foreign key
  exported?: boolean
}

export async function saveTimesheetEntry(entry: Omit<TimesheetEntryRaw, "id">): Promise<TimesheetEntryRaw> {
  console.log("💾 Saving timesheet entry to database:", entry)

  const { data, error } = await supabase.from("anchor_timesheet_entries").insert([entry]).select().single()

  if (error) {
    console.error("❌ Error saving timesheet entry:", error)
    throw error
  }

  console.log("✅ Timesheet entry saved successfully:", data)
  return data
}

export async function getTimesheetEntries(userId: string): Promise<TimesheetEntryRaw[]> {
  console.log("📋 Fetching timesheet entries for user:", userId)

  const { data, error } = await supabase
    .from("anchor_timesheet_entries")
    .select("*")
    .eq("user", userId)
    .order("entry_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching timesheet entries:", error)
  }

  console.log("✅ Fetched timesheet entries:", data?.length || 0)
  return data || []
}

export async function deleteTimesheetEntry(id: number): Promise<void> {
  console.log("🗑️ Deleting timesheet entry:", id)

  const { error } = await supabase.from("anchor_timesheet_entries").delete().eq("id", id)

  if (error) {
    console.error("❌ Error deleting timesheet entry:", error)
    throw error
  }

  console.log("✅ Timesheet entry deleted successfully")
}

export async function updateTimesheetEntry(
  id: number,
  updates: Partial<TimesheetEntryRaw>,
): Promise<TimesheetEntryRaw> {
  console.log("📝 Updating timesheet entry:", id, updates)

  const { data, error } = await supabase.from("anchor_timesheet_entries").update(updates).eq("id", id).select().single()

  if (error) {
    console.error("❌ Error updating timesheet entry:", error)
    throw error
  }

  console.log("✅ Timesheet entry updated successfully:", data)
  return data
}


export async function markTimesheetEntriesAsBillableExported(entryIds: string[]): Promise<void> {
  const numericIds = entryIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)

  if (numericIds.length === 0) {
    console.warn("No valid timesheet entry IDs provided for export status update.")
    return
  }

  const { error } = await supabase
    .from("anchor_timesheet_entries")
    .update({ status: "Billable-Exported" })
    .in("id", numericIds)

  if (error) {
    console.error("Error marking timesheet entries as Billable-Exported:", error)
    throw error
  }

  console.log("Marked timesheet entries as Billable-Exported:", numericIds.length)
}

export async function advanceRecurringServicesNextDate(serviceIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(serviceIds.filter((id) => typeof id === "string" && id.trim().length > 0)))

  if (uniqueIds.length === 0) {
    console.warn("No recurring service IDs provided to advance next date.")
    return
  }

  const { data, error } = await supabase
    .from("anchor_client_services")
    .select("id, next_date")
    .in("id", uniqueIds)

  if (error) {
    console.error("Error loading recurring services for next date update:", error)
    throw error
  }

  const services = data ?? []

  if (services.length === 0) {
    console.warn("No recurring services found for next date update.")
    return
  }

  await Promise.all(
    services.map(async (service: { id: string; next_date: string | null }) => {
      const baseDate = (() => {
        if (service.next_date) {
          const parsed = new Date(service.next_date)
          if (!Number.isNaN(parsed.getTime())) {
            return parsed
          }
        }
        return new Date()
      })()

      const previousDateString = service.next_date
        ? service.next_date
        : baseDate.toISOString().split("T")[0]

      const nextDate = new Date(baseDate)
      nextDate.setMonth(nextDate.getMonth() + 1)
      const nextDateString = nextDate.toISOString().split("T")[0]

      const { error: updateError } = await supabase
        .from("anchor_client_services")
        .update({
          next_date: nextDateString,
          previous_date: previousDateString,
        })
        .eq("id", service.id)

      if (updateError) {
        console.error("Error advancing recurring service next date:", service.id, updateError)
        throw updateError
      }
    }),
  )

  console.log("Advanced next_date for recurring services:", uniqueIds.length)
}

export async function duplicateTimesheetEntryWithNewDate(entryId: number, newDate: string): Promise<void> {
  console.log("[v0] Duplicating timesheet entry", entryId, "to new date", newDate)

  const { data: originalEntry, error: fetchError } = await supabase
    .from("anchor_timesheet_entries")
    .select("*")
    .eq("id", entryId)
    .single()

  if (fetchError) {
    console.error("[v0] Failed to load original timesheet entry for duplication:", fetchError)
    throw fetchError
  }

  const entryToInsert: Omit<TimesheetEntryRaw, "id"> = {
    entry_date: newDate,
    activity: originalEntry.activity,
    client: originalEntry.client,
    service: originalEntry.service,
    status: originalEntry.status,
    retainer: originalEntry.retainer,
    bill_to_client: originalEntry.bill_to_client,
    standard_fee: originalEntry.standard_fee,
    rate: originalEntry.rate,
    hours: originalEntry.hours,
    total: originalEntry.total,
    comments: originalEntry.comments,
    user: originalEntry.user,
    exported: false,
  }

  const { error: insertError } = await supabase
    .from("anchor_timesheet_entries")
    .insert([entryToInsert])

  if (insertError) {
    console.error("[v0] Failed to insert duplicated timesheet entry:", insertError)
    throw insertError
  }

  console.log("[v0] Successfully duplicated timesheet entry", entryId, "to date", newDate)
}

export async function getClientIdByName(clientName: string): Promise<string | null> {
  console.log("🔍 Looking up client ID for:", clientName)

  const { data, error } = await supabase.from("anchor_clients").select("id, client_name").eq("client_name", clientName)

  if (error) {
    console.error("❌ Error finding client ID:", error)
    return null
  }

  if (!data || data.length === 0) {
    console.warn("⚠️ No client found with name:", clientName)
    return null
  }

  if (data.length > 1) {
    console.warn("⚠️ Multiple clients found with name:", clientName, "- using first match")
    console.log(
      "📋 Found clients:",
      data.map((c) => ({ id: c.id, name: c.client_name })),
    )
  }

  const clientId = data[0].id
  console.log("✅ Found client ID:", clientId, "for client:", clientName)
  return clientId
}

export async function getOrCreateClientId(clientName: string): Promise<string> {
  console.log("🔍 Getting or creating client ID for:", clientName)

  // First try to find existing client
  const clientId = await getClientIdByName(clientName)

  if (clientId) {
    return clientId
  }

  // If client doesn't exist and it's "Internal", create it
  if (clientName === "Internal") {
    console.log("🆕 Creating Internal client")
    const { data, error } = await supabase
      .from("anchor_clients")
      .insert([{ client_name: "Internal" }])
      .select("id")
      .single()

    if (error) {
      console.error("❌ Error creating Internal client:", error)
      throw new Error(`Failed to create Internal client: ${error.message}`)
    }

    console.log("✅ Created Internal client with ID:", data.id)
    return data.id
  }

  // For other clients, throw an error if not found
  throw new Error(`Client "${clientName}" not found. Please ensure the client exists in the system.`)
}

export async function getAllSubContractorEntries(): Promise<BillingEntry[]> {
  console.log("📋 Fetching all sub-contractor timesheet entries from all users")

  const { data, error } = await supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients(client_name),
      anchor_users(username)
    `)
    .eq("activity", "Sub-Contractor")
    .neq("status", "Billable-Exported")
    .order("entry_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching sub-contractor entries:", error)
    throw error
  }

  console.log("✅ Fetched sub-contractor entries:", data?.length || 0)
  console.log("🔍 Raw sub-contractor data:", data) // Added debug logging to see what data is returned

  // Transform database entries to BillingEntry format
  const billingEntries: BillingEntry[] = (data || []).map((entry: any) => ({
    id: entry.id.toString(),
    loginName: entry.anchor_users?.username || "Unknown User",
    date: entry.entry_date,
    activity: entry.activity as "External" | "Internal" | "Sub-Contractor",
    clientName: entry.anchor_clients?.client_name || "Unknown Client",
    itemName: entry.service,
    hours: entry.hours,
    billable: entry.status as "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported",
    standardItemFee: entry.standard_fee,
    ratePerHour: entry.rate,
    total: entry.total,
    markup: typeof entry.markup === "number" ? Number(entry.markup) : undefined,
    comments: entry.comments || "",
    retainer: entry.retainer ? "Yes" : "No",
    billToClient: entry.bill_to_client || "",
    invoiceId: entry.inv_id || null,
    xeroItemCode: entry.xero_item_code ?? null,
    source: "timesheet",
  }))

  console.log("🔄 Transformed sub-contractor entries:", billingEntries.length) // Added debug logging for transformed data
  return billingEntries
}

export async function getTimesheetEntriesForInvoicing(userId: string, includeAllUsers = false): Promise<BillingEntry[]> {
  console.log(
    "📋 Fetching timesheet entries for invoicing",
    includeAllUsers ? "for all users (admin access)" : `for user: ${userId}`,
  )

  let query = supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients!client(client_name),
      anchor_users(username)
    `)
    .in("status", ["Billable", "Work in Progress", "Not Billable", "Recurring"])
    .neq("status", "Billable-Exported")
    .is("inv_id", null)
    .order("entry_date", { ascending: false })

  if (!includeAllUsers) {
    query = query.eq("user", userId)
  }

  const { data, error } = await query

  if (error) {
    console.error("❌ Error fetching timesheet entries for invoicing:", error)
    throw error
  }

  console.log("✅ Fetched unbilled timesheet entries for invoicing:", data?.length || 0)

  const billingEntries: BillingEntry[] = (data || []).map((entry: any) => ({
    id: entry.id.toString(),
    loginName: entry.anchor_users?.username || "Unknown User",
    date: entry.entry_date,
    activity: entry.activity as "External" | "Internal" | "Sub-Contractor",
    clientName: entry.anchor_clients?.client_name || "Unknown Client",
    clientId: entry.client,
    itemName: entry.service,
    hours: entry.hours,
    billable: entry.status as "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported",
    standardItemFee: entry.standard_fee,
    ratePerHour: entry.rate,
    total: entry.total,
    comments: entry.comments || "",
    retainer: entry.retainer ? "Yes" : "No",
    billToClient: entry.bill_to_client || "",
    invoiceId: entry.inv_id ? entry.inv_id.toString() : null,
    xeroItemCode: entry.xero_item_code ?? null,
    source: "timesheet",
  }))

  return billingEntries
}

export async function getBillableExportedEntries(
  userId: string,
  includeAllUsers = false,
): Promise<BillingEntry[]> {
  console.log(
    "📄 Fetching billable-exported timesheet entries",
    includeAllUsers ? "for all users (admin access)" : `for user: ${userId}`,
  )

  let query = supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients!client(client_name),
      anchor_users(username)
    `)
    .eq("status", "Billable-Exported")
    .order("entry_date", { ascending: false })

  if (!includeAllUsers) {
    query = query.eq("user", userId)
  }

  const { data, error } = await query

  if (error) {
    console.error("🚨 Error fetching billable-exported entries:", error)
    throw error
  }

  console.log("✅ Fetched billable-exported entries:", data?.length || 0)

  const billingEntries: BillingEntry[] = (data || []).map((entry: any) => ({
    id: entry.id.toString(),
    loginName: entry.anchor_users?.username || "Unknown User",
    date: entry.entry_date,
    activity: entry.activity as "External" | "Internal" | "Sub-Contractor",
    clientName: entry.anchor_clients?.client_name || "Unknown Client",
    clientId: entry.client,
    itemName: entry.service,
    hours: entry.hours,
    billable: entry.status as "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported",
    standardItemFee: entry.standard_fee,
    ratePerHour: entry.rate,
    total: entry.total,
    comments: entry.comments || "",
    retainer: entry.retainer ? "Yes" : "No",
    billToClient: entry.bill_to_client || "",
    invoiceId: entry.inv_id ? entry.inv_id.toString() : null,
    xeroItemCode: entry.xero_item_code ?? null,
    source: "timesheet",
  }))

  return billingEntries
}

export async function getTimesheetEntriesForUser(userId: string): Promise<BillingEntry[]> {
  console.log("📋 Fetching timesheet entries with client names for user:", userId)

  const { data, error } = await supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients(client_name),
      anchor_users(username)
    `)
    .eq("user", userId)
    .order("entry_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching timesheet entries:", error)
    throw error
  }

  console.log("✅ Fetched timesheet entries with client names:", data?.length || 0)

  // Transform database entries to BillingEntry format
  const billingEntries: BillingEntry[] = (data || []).map((entry: any) => ({
    id: entry.id.toString(),
    loginName: entry.anchor_users?.username || "Unknown User",
    date: entry.entry_date,
    activity: entry.activity as "External" | "Internal",
    clientName: entry.anchor_clients?.client_name || "Unknown Client",
    itemName: entry.service,
    hours: entry.hours,
    billable: entry.status as "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported",
    standardItemFee: entry.standard_fee,
    ratePerHour: entry.rate,
    total: entry.total,
    comments: entry.comments || "",
    retainer: entry.retainer ? "Yes" : "No",
    billToClient: entry.bill_to_client || "",
    xeroItemCode: entry.xero_item_code ?? null,
    source: "timesheet",
  }))

  return billingEntries
}

export async function getTimesheetEntriesForInvoice(invoiceId: string): Promise<BillingEntry[]> {
  console.log("📋 Fetching timesheet entries for invoice:", invoiceId)

  const { data, error } = await supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients(client_name),
      anchor_users(username)
    `)
    .eq("inv_id", invoiceId)
    .order("entry_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching timesheet entries for invoice:", error)
    throw error
  }

  console.log("✅ Fetched timesheet entries for invoice:", data?.length || 0)

  // Transform database entries to BillingEntry format
  const billingEntries: BillingEntry[] = (data || []).map((entry: any) => ({
    id: entry.id.toString(),
    loginName: entry.anchor_users?.username || "Unknown User",
    date: entry.entry_date,
    activity: entry.activity as "External" | "Internal",
    clientName: entry.anchor_clients?.client_name || "Unknown Client",
    itemName: entry.service,
    hours: entry.hours,
    billable: entry.status as "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported",
    standardItemFee: entry.standard_fee,
    ratePerHour: entry.rate,
    total: entry.total,
    comments: entry.comments || "",
    retainer: entry.retainer ? "Yes" : "No",
    billToClient: entry.bill_to_client || "",
    xeroItemCode: entry.xero_item_code ?? null,
    source: "timesheet",
  }))

  return billingEntries
}

export async function getAllUsers(): Promise<Array<{ id: string; username: string; email: string; role: string }>> {
  console.log("📋 Fetching all users from anchor_users table")

  const { data, error } = await supabase
    .from("anchor_users")
    .select("id, username, email, role")
    .order("username", { ascending: true })

  if (error) {
    console.error("❌ Error fetching users:", error)
    throw error
  }

  console.log("✅ Fetched users:", data?.length || 0)
  return data || []
}

export async function getTimesheetEntriesForAnyUser(userId: string): Promise<BillingEntry[]> {
  console.log("📋 Fetching timesheet entries with client names for user (admin access):", userId)

  const { data, error } = await supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients(client_name),
      anchor_users(username)
    `)
    .eq("user", userId)
    .order("entry_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching timesheet entries:", error)
    throw error
  }

  console.log("✅ Fetched timesheet entries with client names:", data?.length || 0)

  // Transform database entries to BillingEntry format
  const billingEntries: BillingEntry[] = (data || []).map((entry: any) => ({
    id: entry.id.toString(),
    loginName: entry.anchor_users?.username || "Unknown User",
    date: entry.entry_date,
    activity: entry.activity as "External" | "Internal" | "Sub-Contractor",
    clientName: entry.anchor_clients?.client_name || "Unknown Client",
    itemName: entry.service,
    hours: entry.hours,
    billable: entry.status as "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported",
    standardItemFee: entry.standard_fee,
    ratePerHour: entry.rate,
    total: entry.total,
    comments: entry.comments || "",
    retainer: entry.retainer ? "Yes" : "No",
    billToClient: entry.bill_to_client || "",
    xeroItemCode: entry.xero_item_code ?? null,
    source: "timesheet",
  }))

  return billingEntries
}

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
  invoiceId?: string | null // Added invoiceId field to track which entries are already invoiced
  xeroItemCode?: string | null
  source?: "timesheet" | "recurring"
}

export async function removeTimesheetEntryFromInvoice(entryId: string): Promise<void> {
  console.log("🔗 Removing timesheet entry from invoice:", entryId)

  const { error } = await supabase
    .from("anchor_timesheet_entries")
    .update({ inv_id: null })
    .eq("id", Number.parseInt(entryId))

  if (error) {
    console.error("❌ Error removing timesheet entry from invoice:", error)
    throw error
  }

  console.log("✅ Timesheet entry removed from invoice successfully")
}

export async function addTimesheetEntryToInvoice(entryId: string, invoiceId: string): Promise<void> {
  console.log("🔗 Adding timesheet entry to invoice:", { entryId, invoiceId })

  const { error } = await supabase
    .from("anchor_timesheet_entries")
    .update({ inv_id: invoiceId })
    .eq("id", Number.parseInt(entryId))

  if (error) {
    console.error("❌ Error adding timesheet entry to invoice:", error)
    throw error
  }

  console.log("✅ Timesheet entry added to invoice successfully")
}

export async function getAvailableTimesheetEntriesForClient(
  userId: string,
  billToClient: string,
): Promise<BillingEntry[]> {
  console.log("📋 Fetching available timesheet entries for client:", { userId, billToClient })

  const { data, error } = await supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients(client_name),
      anchor_users(username)
    `)
    .eq("user", userId)
    .eq("status", "Billable")
    .eq("bill_to_client", billToClient)
    .is("inv_id", null)
    .order("entry_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching available timesheet entries:", error)
    throw error
  }

  console.log("✅ Fetched available timesheet entries:", data?.length || 0)

  // Transform database entries to BillingEntry format
  const billingEntries: BillingEntry[] = (data || []).map((entry: any) => ({
    id: entry.id.toString(),
    loginName: entry.anchor_users?.username || "Unknown User",
    date: entry.entry_date,
    activity: entry.activity as "External" | "Internal",
    clientName: entry.anchor_clients?.client_name || "Unknown Client",
    itemName: entry.service,
    hours: entry.hours,
    billable: entry.status as "Billable" | "Not Billable" | "Work in Progress" | "Recurring" | "Billable-Exported",
    standardItemFee: entry.standard_fee,
    ratePerHour: entry.rate,
    total: entry.total,
    comments: entry.comments || "",
    retainer: entry.retainer ? "Yes" : "No",
    billToClient: entry.bill_to_client || "",
  }))

  return billingEntries
}

export async function unlinkTimesheetEntriesFromInvoice(invoiceId: string): Promise<void> {
  console.log("🔗 Unlinking timesheet entries from invoice:", invoiceId)

  const { error } = await supabase.from("anchor_timesheet_entries").update({ inv_id: null }).eq("inv_id", invoiceId)

  if (error) {
    console.error("❌ Error unlinking timesheet entries from invoice:", error)
    throw error
  }

  console.log("✅ Timesheet entries unlinked from invoice successfully")
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  console.log("🗑️ Deleting invoice:", invoiceId)

  // Unlink timesheet entries from invoice before deletion
  await unlinkTimesheetEntriesFromInvoice(invoiceId)

  const { error } = await supabase.from("anchor_invoices").delete().eq("uid", invoiceId)

  if (error) {
    console.error("❌ Error deleting invoice:", error)
    throw error
  }

  console.log("✅ Invoice deleted successfully")
}

export async function saveInvoice(invoice: Omit<InvoiceRaw, "uid" | "created_at">): Promise<InvoiceRaw> {
  console.log("💾 Saving invoice to database:", invoice)

  const { data, error } = await supabase.from("anchor_invoices").insert([invoice]).select().single()

  if (error) {
    console.error("❌ Error saving invoice:", error)
    throw error
  }

  console.log("✅ Invoice saved successfully:", data)
  return data
}

export async function updateInvoice(invoiceId: string, updates: Partial<InvoiceRaw>): Promise<InvoiceRaw> {
  console.log("📝 Updating invoice:", invoiceId, updates)

  const { data, error } = await supabase.from("anchor_invoices").update(updates).eq("uid", invoiceId).select().single()

  if (error) {
    console.error("❌ Error updating invoice:", error)
    throw error
  }

  console.log("✅ Invoice updated successfully:", data)
  return data
}

export async function updateTimesheetEntriesWithInvoiceId(entryIds: string[], invoiceId: string): Promise<void> {
  console.log("🔗 Linking timesheet entries to invoice:", { entryIds, invoiceId })

  const { error } = await supabase
    .from("anchor_timesheet_entries")
    .update({ inv_id: invoiceId })
    .in(
      "id",
      entryIds.map((id) => Number.parseInt(id)),
    )

  if (error) {
    console.error("❌ Error updating timesheet entries with invoice ID:", error)
    throw error
  }

  console.log("✅ Timesheet entries linked to invoice successfully")
}

// Function to mark timesheet entries as exported
export async function markTimesheetEntriesAsExported(entryIds: number[]): Promise<void> {
  console.log("📤 Marking timesheet entries as exported:", entryIds)

  const { error } = await supabase.from("anchor_timesheet_entries").update({ exported: "True" }).in("id", entryIds)

  if (error) {
    console.error("❌ Error marking timesheet entries as exported:", error)
    throw error
  }

  console.log("✅ Timesheet entries marked as exported successfully")
}

// Daily timesheet storage functionality
// Daily timesheet database interface
export interface DailyTimesheetRaw {
  uuid?: string
  created_date: string
  user_id: string
  total_hours: number
  timesheet_number: string
  created_at?: string
}

export async function saveDailyTimesheet(
  dailyTimesheet: Omit<DailyTimesheetRaw, "uuid" | "created_at">,
): Promise<DailyTimesheetRaw> {
  console.log("💾 Saving daily timesheet to database:", {
    created_date: dailyTimesheet.created_date,
    user_id: dailyTimesheet.user_id,
    total_hours: dailyTimesheet.total_hours,
    timesheet_number: dailyTimesheet.timesheet_number,
  })

  const { data, error } = await supabase.from("anchor_daily_timesheets").insert([dailyTimesheet]).select().single()

  if (error) {
    console.error("❌ Error saving daily timesheet:", error)
    throw error
  }

  console.log("✅ Daily timesheet saved successfully:", data.uuid)
  return data
}

export async function getDailyTimesheets(userId: string): Promise<DailyTimesheetRaw[]> {
  console.log("📋 Fetching daily timesheets for user:", userId)

  const { data, error } = await supabase
    .from("anchor_daily_timesheets")
    .select("uuid, created_date, user_id, total_hours, timesheet_number, created_at")
    .eq("user_id", userId)
    .order("created_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching daily timesheets:", error)
  }

  console.log("✅ Fetched daily timesheets:", data?.length || 0)
  return data || []
}

export async function getDailyTimesheetById(id: string): Promise<DailyTimesheetRaw | null> {
  console.log("📋 Fetching daily timesheet by ID:", id)

  const { data, error } = await supabase.from("anchor_daily_timesheets").select("*").eq("uuid", id).single()

  if (error) {
    console.error("❌ Error fetching daily timesheet:", error)
    return null
  }

  console.log("✅ Fetched daily timesheet successfully")
  return data
}

export async function deleteDailyTimesheet(id: string): Promise<void> {
  console.log("🗑️ Deleting daily timesheet:", id)

  const { error } = await supabase.from("anchor_daily_timesheets").delete().eq("uuid", id)

  if (error) {
    console.error("❌ Error deleting daily timesheet:", error)
    throw error
  }

  console.log("✅ Daily timesheet deleted successfully")
}

export async function getDraftInvoices(userId?: string, isAdmin = false): Promise<InvoiceRaw[]> {
  console.log("📋 Fetching pending approval invoices", isAdmin ? "for admin (all invoices)" : `for user: ${userId}`)

  let query = supabase
    .from("anchor_invoices")
    .select(`
      *,
      anchor_users(username)
    `)
    .eq("status", "Pending Approval")
    .order("created_at", { ascending: false })

  if (!isAdmin) {
    query = query.eq("created_by", userId)
  }

  const { data, error } = await query

  if (error) {
    console.error("❌ Error fetching pending approval invoices:", error)
    throw error
  }

  console.log("✅ Fetched pending approval invoices:", data?.length || 0)

  const transformedData = (data || []).map((invoice: any) => ({
    ...invoice,
    created_by_name: invoice.anchor_users?.username || "Unknown User",
  }))

  return transformedData || []
}

export async function getInvoices(userId?: string): Promise<InvoiceRaw[]> {
  console.log("📋 Fetching invoices", userId ? `for user: ${userId}` : "")

  let query = supabase.from("anchor_invoices").select("*").order("created_at", { ascending: false })

  if (userId) {
    query = query.eq("created_by", userId)
  }

  const { data, error } = await query

  if (error) {
    console.error("❌ Error fetching invoices:", error)
    throw error
  }

  console.log("✅ Fetched invoices:", data?.length || 0)
  return data || []
}

export interface InvoiceRaw {
  uid?: string
  invoice_number: string
  bill_to: string
  inv_date: string
  due_date: string
  inv_total: number
  status: string
  created_by: string
  created_at?: string
  created_by_name?: string
}

export interface ClientRecurringServiceRaw {
  id: string
  client_id: string
  xero_item_code: string
  previous_date: string
  frequency: string | null
  quantity: number
  notes: string | null
  active: boolean
  amount: number | null
  next_date: string | null
}

export interface ClientRecurringService extends ClientRecurringServiceRaw {
  service_name?: string | null
  service_rate?: number | null
  client_name?: string
}

const DEFAULT_RECURRING_FREQUENCY = "Recurring" as const

const normalizeRecurringService = (entry: any): ClientRecurringService => ({
  id: entry.id,
  client_id: entry.client_id,
  xero_item_code: entry.xero_item_code,
  previous_date: entry.previous_date,
  frequency: entry.frequency ?? DEFAULT_RECURRING_FREQUENCY,
  quantity: Number.isFinite(Number(entry.quantity)) ? Number(entry.quantity) : 1,
  notes: entry.notes ?? null,
  active: Boolean(entry.active),
  amount:
    entry.amount === null || entry.amount === undefined || Number.isNaN(Number(entry.amount))
      ? null
      : Number(entry.amount),
  next_date: entry.next_date ?? null,
  service_name: entry.anchor_task_items?.xero_sales_description ?? entry.service_name ?? null,
  service_rate:
    entry.anchor_task_items && entry.anchor_task_items.sales_unit_price !== undefined
      ? Number(entry.anchor_task_items.sales_unit_price)
      : entry.service_rate !== undefined
        ? Number(entry.service_rate)
        : null,
  client_name: entry.anchor_clients?.client_name ?? entry.client_name ?? undefined,
})

export async function getClientRecurringServices(clientId: string): Promise<ClientRecurringService[]> {
  console.log("�Y\" Fetching recurring services for client:", clientId)

  const { data, error } = await supabase
    .from("anchor_client_services")
    .select(
      `
        id,
        client_id,
        xero_item_code,
        previous_date,
        frequency,
        quantity,
        notes,
        active,
        amount,
        next_date,
        anchor_task_items ( xero_sales_description, sales_unit_price )
      `,
    )
    .eq("client_id", clientId)
    .order("previous_date", { ascending: true })

  if (error) {
    console.error("�?O Error fetching client recurring services:", error)
    throw error
  }

  return (data || []).map(normalizeRecurringService)
}

export async function createClientRecurringService(
  service: Omit<ClientRecurringServiceRaw, "id">,
): Promise<ClientRecurringService> {
  console.log("�Y\" Creating recurring service assignment:", service)

  const payload = {
    client_id: service.client_id,
    xero_item_code: service.xero_item_code,
    previous_date: service.previous_date,
    frequency: service.frequency ?? DEFAULT_RECURRING_FREQUENCY,
    quantity: service.quantity,
    notes: service.notes,
    active: service.active,
    amount: service.amount,
    next_date: service.next_date,
  }

  const { data, error } = await supabase
    .from("anchor_client_services")
    .insert([payload])
    .select(
      `
        *,
        anchor_clients ( client_name ),
        anchor_task_items ( xero_sales_description, sales_unit_price )
      `,
    )
    .single()

  if (error) {
    console.error("�?O Error creating client recurring service:", error)
    throw error
  }

  return normalizeRecurringService(data)
}

export async function updateClientRecurringService(
  id: string,
  updates: Partial<Omit<ClientRecurringServiceRaw, "id" | "client_id">>,
): Promise<ClientRecurringService> {
  console.log("�Y\" Updating recurring service assignment:", id, updates)

  const payload = {
    ...updates,
    frequency: updates.frequency ?? DEFAULT_RECURRING_FREQUENCY,
  }

  const { data, error } = await supabase
    .from("anchor_client_services")
    .update(payload)
    .eq("id", id)
    .select(
      `
        *,
        anchor_clients ( client_name ),
        anchor_task_items ( xero_sales_description, sales_unit_price )
      `,
    )
    .single()

  if (error) {
    console.error("�?O Error updating client recurring service:", error)
    throw error
  }

  return normalizeRecurringService(data)
}

export async function deleteClientRecurringService(id: string): Promise<void> {
  console.log("�Y\" Deleting recurring service assignment:", id)

  const { error } = await supabase.from("anchor_client_services").delete().eq("id", id)

  if (error) {
    console.error("�?O Error deleting client recurring service:", error)
    throw error
  }
}

export async function getAllClientRecurringServices(): Promise<ClientRecurringService[]> {
  console.log("�Y\" Fetching recurring services for all clients")

  const { data, error } = await supabase
    .from("anchor_client_services")
    .select(
      `
        id,
        client_id,
        xero_item_code,
        previous_date,
        frequency,
        quantity,
        notes,
        active,
        amount,
        next_date,
        anchor_clients ( client_name ),
        anchor_task_items ( xero_sales_description, sales_unit_price )
      `,
    )
    .order("client_id", { ascending: true })
    .order("previous_date", { ascending: true })

  if (error) {
    console.error("�?O Error fetching recurring services:", error)
    throw error
  }

  return (data || []).map(normalizeRecurringService)
}

export async function getClients(): Promise<Array<{ id: string; client_name: string }>> {
  console.log("📋 Fetching all clients from anchor_clients table")

  const { data, error } = await supabase
    .from("anchor_clients")
    .select("id, client_name")
    .order("client_name", { ascending: true })

  if (error) {
    console.error("❌ Error fetching clients:", error)
    throw error
  }

  console.log("✅ Fetched clients:", data?.length || 0)
  return data || []
}

// Invoice plans database functions
export interface InvoicePlanRaw {
  plan_id: string
  total_amount: number
  total_installments: number
  created_by: string
  created_at: string
}

export async function getInvoicePlans(userId: string): Promise<InvoicePlanRaw[]> {
  console.log("📋 Fetching invoice plans for user:", userId)

  const { data, error } = await supabase
    .from("anchor_invoice_plans")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("❌ Error fetching invoice plans:", error)
    throw error
  }

  console.log("✅ Fetched invoice plans:", data?.length || 0)
  return data || []
}

export async function createInvoicePlan(plan: Omit<InvoicePlanRaw, "plan_id" | "created_at">): Promise<InvoicePlanRaw> {
  console.log("💾 Creating invoice plan:", plan)

  const { data, error } = await supabase.from("anchor_invoice_plans").insert([plan]).select().single()

  if (error) {
    console.error("❌ Error creating invoice plan:", error)
    throw error
  }

  console.log("✅ Invoice plan created successfully:", data.plan_id)
  return data
}

export async function getInvoicesForPlan(planId: string): Promise<InvoiceRaw[]> {
  console.log("📋 Fetching invoices for plan:", planId)

  const { data, error } = await supabase
    .from("anchor_invoices")
    .select("*")
    .eq("plan_id", planId)
    .order("installment_number", { ascending: true })

  if (error) {
    console.error("❌ Error fetching invoices for plan:", error)
    throw error
  }

  console.log("✅ Fetched invoices for plan:", data?.length || 0)
  return data || []
}

export async function createPlanInvoices(
  invoices: Array<Omit<InvoiceRaw, "uid" | "created_at">>,
): Promise<InvoiceRaw[]> {
  console.log("💾 Creating plan invoices:", invoices.length)

  const { data, error } = await supabase.from("anchor_invoices").insert(invoices).select()

  if (error) {
    console.error("❌ Error creating plan invoices:", error)
    throw error
  }

  console.log("✅ Plan invoices created successfully:", data?.length || 0)
  return data || []
}

export interface LineItemRaw {
  id?: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  total: number
  created_at?: string
}

export async function createInvoiceLineItems(
  lineItems: Array<Omit<LineItemRaw, "id" | "created_at">>,
): Promise<LineItemRaw[]> {
  console.log("💾 Creating invoice line items:", lineItems.length)

  const { data, error } = await supabase.from("anchor_retainer_lines").insert(lineItems).select()

  if (error) {
    console.error("❌ Error creating invoice line items:", error)
    throw error
  }

  console.log("✅ Invoice line items created successfully:", data?.length || 0)
  return data || []
}

export async function getTimesheetDetailedDataWithExported(): Promise<any[]> {
  console.log("📊 Fetching timesheet detailed data with exported field from table...")

  const { data, error } = await supabase
    .from("anchor_timesheet_entries")
    .select(`
      *,
      anchor_clients(client_name),
      anchor_users(username)
    `)
    .order("entry_date", { ascending: false })

  if (error) {
    console.error("❌ Error fetching timesheet detailed data with exported field:", error)
    throw error
  }

  console.log("✅ Fetched timesheet entries with exported field:", data?.length || 0)

  // Transform to match the expected format from the view
  const transformedData = (data || []).map((entry: any) => ({
    id: entry.id,
    entry_date: entry.entry_date,
    activity: entry.activity,
    client: entry.client,
    client_name: entry.anchor_clients?.client_name || "Unknown Client",
    service: entry.service,
    status: entry.status,
    retainer: entry.retainer,
    bill_to_client: entry.bill_to_client,
    standard_fee: entry.standard_fee,
    rate: entry.rate,
    hours: entry.hours,
    total: entry.total,
    comments: entry.comments,
    user: entry.user,
    username: entry.anchor_users?.username || "Unknown User",
    inv_id: entry.inv_id,
    exported: entry.exported, // Include the exported field
  }))

  return transformedData
}
