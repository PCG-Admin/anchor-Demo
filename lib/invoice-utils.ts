import { format } from "date-fns"
import { supabase } from "./supabase"

export type InvoiceType = "regular" | "retainer" | "subcontractor"

/**
 * Generates a unique invoice number with the specified format and checks for duplicates
 * @param type - The type of invoice (regular, retainer, subcontractor)
 * @returns Promise<string> - A unique invoice number
 */
export async function generateUniqueInvoiceNumber(type: InvoiceType): Promise<string> {
  const currentDate = format(new Date(), "yyyyMMdd")
  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    const randomNumber = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")

    let invoiceNumber: string
    switch (type) {
      case "retainer":
        invoiceNumber = `R-INV-${currentDate}-${randomNumber}`
        break
      case "subcontractor":
        invoiceNumber = `SC-INV-${currentDate}-${randomNumber}`
        break
      default:
        invoiceNumber = `INV-${currentDate}-${randomNumber}`
        break
    }

    // Check if this invoice number already exists
    const { data: existingInvoice, error } = await supabase
      .from("anchor_invoices")
      .select("invoice_number")
      .eq("invoice_number", invoiceNumber)
      .single()

    if (error && error.code === "PGRST116") {
      // No matching record found, this number is unique
      return invoiceNumber
    }

    if (error) {
      console.error("Error checking invoice number uniqueness:", error)
      // If there's an error checking, still return the number to avoid infinite loop
      return invoiceNumber
    }

    // If we get here, the number exists, try again
    attempts++
  }

  // Fallback if we can't find a unique number after max attempts
  const fallbackNumber = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")
  const fallbackInvoiceNumber =
    type === "retainer"
      ? `R-INV-${currentDate}-${fallbackNumber}`
      : type === "subcontractor"
        ? `SC-INV-${currentDate}-${fallbackNumber}`
        : `INV-${currentDate}-${fallbackNumber}`

  console.warn(
    `Could not generate unique invoice number after ${maxAttempts} attempts, using fallback: ${fallbackInvoiceNumber}`,
  )
  return fallbackInvoiceNumber
}
