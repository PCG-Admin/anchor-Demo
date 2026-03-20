import jsPDF from "jspdf"
import type { Invoice } from "@/types/invoice"

export interface PDFDocument {
  name: string
  mime: string
  data: Buffer
}

export function generateInvoicePDF(invoice: Invoice): PDFDocument {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  const margin = 20
  let yPosition = 25

  // Company/Header section with background
  doc.setFillColor(45, 55, 72) // Dark blue-gray background
  doc.rect(0, 0, pageWidth, 35, "F")

  doc.setTextColor(255, 255, 255) // White text
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("INVOICE", pageWidth / 2, 22, { align: "center" })

  // Reset text color and add invoice info section
  doc.setTextColor(0, 0, 0)
  yPosition = 50

  // Invoice info box with subtle background
  doc.setFillColor(248, 250, 252) // Light gray background
  doc.rect(margin, yPosition - 5, pageWidth - margin * 2, 35, "F")
  doc.setDrawColor(226, 232, 240) // Light border
  doc.rect(margin, yPosition - 5, pageWidth - margin * 2, 35, "S")

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(51, 65, 85) // Dark gray

  // Left column - Invoice details
  doc.text("Invoice Number:", margin + 5, yPosition + 5)
  doc.setFont("helvetica", "normal")
  doc.text(invoice.invoiceNumber, margin + 50, yPosition + 5)

  doc.setFont("helvetica", "bold")
  doc.text("Issue Date:", margin + 5, yPosition + 12)
  doc.setFont("helvetica", "normal")
  doc.text(new Date(invoice.issueDate).toLocaleDateString(), margin + 35, yPosition + 12)

  doc.setFont("helvetica", "bold")
  doc.text("Due Date:", margin + 5, yPosition + 19)
  doc.setFont("helvetica", "normal")
  doc.text(new Date(invoice.dueDate).toLocaleDateString(), margin + 30, yPosition + 19)

  // Right column - Total amount
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("Total Amount:", pageWidth - margin - 70, yPosition + 8)
  doc.setFontSize(18)
  doc.setTextColor(99, 102, 241) // Indigo color for emphasis
  doc.text(`R${invoice.total.toFixed(2)}`, pageWidth - margin - 70, yPosition + 20)

  yPosition += 50

  // Bill To section
  doc.setFillColor(248, 250, 252) // Light gray background
  doc.rect(margin, yPosition - 5, pageWidth - margin * 2, 20, "F")
  doc.setDrawColor(226, 232, 240) // Light border
  doc.rect(margin, yPosition - 5, pageWidth - margin * 2, 20, "S")

  doc.setTextColor(51, 65, 85)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Bill To:", margin + 5, yPosition + 5)
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text(invoice.clientName, margin + 5, yPosition + 12)

  yPosition += 35

  const isRetainerInvoice = invoice.invoiceNumber.toLowerCase().startsWith("r-inv")
  const isPlanInvoice = invoice.plan_id !== null && invoice.plan_id !== undefined
  const isSubContractorInvoice = invoice.invoiceNumber.toLowerCase().startsWith("sc-inv")
  const hasLineItems = (invoice.lineItems && invoice.lineItems.length > 0) || isPlanInvoice

  // Table header with improved design
  doc.setFillColor(99, 102, 241) // Indigo background
  doc.rect(margin, yPosition - 3, pageWidth - margin * 2, 12, "F")

  doc.setTextColor(255, 255, 255) // White text
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")

  const headers =
    isRetainerInvoice || hasLineItems
      ? ["Description", "Quantity", "Unit Price", "Amount"]
      : ["Description", "Hours", "Rate", "Amount"]
  const colWidths = isRetainerInvoice || hasLineItems ? [100, 25, 30, 35] : [80, 25, 30, 35]
  let xPosition = margin + 2

  headers.forEach((header, index) => {
    doc.text(header, xPosition, yPosition + 5)
    xPosition += colWidths[index]
  })

  yPosition += 15

  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)

  const itemsToRender =
    hasLineItems && invoice.lineItems && invoice.lineItems.length > 0 ? invoice.lineItems : invoice.entries

  // Check if entries exist and render them
  if (itemsToRender && itemsToRender.length > 0) {
    itemsToRender.forEach((item, index) => {
      if (yPosition > 260) {
        // Start new page if needed
        doc.addPage()
        yPosition = 30

        // Repeat header on new page
        doc.setFillColor(99, 102, 241)
        doc.rect(margin, yPosition - 3, pageWidth - margin * 2, 12, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")

        xPosition = margin + 2
        headers.forEach((header, index) => {
          doc.text(header, xPosition, yPosition + 5)
          xPosition += colWidths[index]
        })

        yPosition += 15
        doc.setTextColor(0, 0, 0)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
      }

      // Alternating row colors
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251) // Very light gray
        doc.rect(margin, yPosition - 2, pageWidth - margin * 2, 10, "F")
      }

      xPosition = margin + 2

      let rowData: string[]

      if (isRetainerInvoice || (hasLineItems && invoice.lineItems && invoice.lineItems.length > 0)) {
        const lineItem = item as any // Type assertion for retainer line items
        const description = lineItem.description || ""
        const truncatedDescription = description.length > 50 ? description.substring(0, 47) + "..." : description

        rowData = [
          truncatedDescription,
          (lineItem.quantity || 1).toString(),
          `R${(lineItem.unit_price || 0).toFixed(2)}`,
          `R${(lineItem.total || 0).toFixed(2)}`,
        ]
      } else {
        const entry = item as any
        const description = entry.itemName + (entry.comments ? ` - ${entry.comments}` : "")
        const truncatedDescription = description.length > 40 ? description.substring(0, 37) + "..." : description

        rowData = [
          truncatedDescription,
          entry.hours.toString(),
          `R${entry.ratePerHour.toFixed(2)}`,
          `R${entry.total.toFixed(2)}`,
        ]
      }

      rowData.forEach((data, index) => {
        doc.text(data, xPosition, yPosition + 4)
        xPosition += colWidths[index]
      })

      yPosition += 10
    })
  }

  yPosition += 15

  doc.setFillColor(248, 250, 252)
  doc.rect(pageWidth - margin - 80, yPosition, 80, 35, "F")
  doc.setDrawColor(226, 232, 240)
  doc.rect(pageWidth - margin - 80, yPosition, 80, 35, "S")

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(51, 65, 85)

  const subtotal =
    invoice.subtotal ||
    (hasLineItems && invoice.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems.reduce((sum, item) => sum + (item.total || 0), 0)
      : invoice.entries
        ? invoice.entries.reduce((sum, entry) => sum + entry.total, 0)
        : 0)

  const taxRate = invoice.taxRate || 15
  const taxAmount = invoice.taxAmount || subtotal * (taxRate / 100)
  const total = invoice.total || subtotal + taxAmount

  doc.text("Subtotal:", pageWidth - margin - 75, yPosition + 8)
  doc.text(`R${subtotal.toFixed(2)}`, pageWidth - margin - 25, yPosition + 8, { align: "right" })

  doc.text(`VAT (${taxRate}%):`, pageWidth - margin - 75, yPosition + 16)
  doc.text(`R${taxAmount.toFixed(2)}`, pageWidth - margin - 25, yPosition + 16, { align: "right" })

  // Total with emphasis
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(99, 102, 241) // Indigo color
  doc.text("Total:", pageWidth - margin - 75, yPosition + 26)
  doc.text(`R${total.toFixed(2)}`, pageWidth - margin - 25, yPosition + 26, { align: "right" })

  yPosition += 50

  // Notes section if exists
  if (invoice.notes) {
    doc.setFillColor(248, 250, 252)
    doc.rect(margin, yPosition, pageWidth - margin * 2, 25, "F")
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, yPosition, pageWidth - margin * 2, 25, "S")

    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(51, 65, 85)
    doc.text("Notes:", margin + 5, yPosition + 8)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2 - 10)
    doc.text(splitNotes, margin + 5, yPosition + 15)
    yPosition += 35
  }

  // Footer
  yPosition += 20
  doc.setFontSize(8)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(107, 114, 128)
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    pageWidth / 2,
    yPosition,
    {
      align: "center",
    },
  )

  const pdfOutput = doc.output("arraybuffer")
  const pdfBuffer = Buffer.from(pdfOutput)

  return {
    name: `${invoice.invoiceNumber}___${invoice.clientName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    mime: "application/pdf",
    data: pdfBuffer,
  }
}

export function generateTimesheetPDF(timesheetData: {
  timesheetNumber: string
  loggedInUserName: string
  timesheetDate: string
  totalHours: number
  entries: Array<{
    clientName: string
    activity: string
    itemName: string
    hours: number
    billToClient: string
    billable: string
    comments?: string
  }>
}): PDFDocument {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  const margin = 20
  let yPosition = 25

  // Company/Header section with background
  doc.setFillColor(45, 55, 72) // Dark blue-gray background
  doc.rect(0, 0, pageWidth, 35, "F")

  doc.setTextColor(255, 255, 255) // White text
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("DAILY TIMESHEET", pageWidth / 2, 22, { align: "center" })

  // Reset text color and add timesheet info section
  doc.setTextColor(0, 0, 0)
  yPosition = 50

  // Timesheet info box with subtle background
  doc.setFillColor(248, 250, 252) // Light gray background
  doc.rect(margin, yPosition - 5, pageWidth - margin * 2, 35, "F")
  doc.setDrawColor(226, 232, 240) // Light border
  doc.rect(margin, yPosition - 5, pageWidth - margin * 2, 35, "S")

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(51, 65, 85) // Dark gray

  // Left column - Timesheet details
  doc.text("Timesheet Number:", margin + 5, yPosition + 5)
  doc.setFont("helvetica", "normal")
  doc.text(timesheetData.timesheetNumber, margin + 60, yPosition + 5)

  doc.setFont("helvetica", "bold")
  doc.text("Employee:", margin + 5, yPosition + 12)
  doc.setFont("helvetica", "normal")
  doc.text(timesheetData.loggedInUserName, margin + 35, yPosition + 12)

  doc.setFont("helvetica", "bold")
  doc.text("Date:", margin + 5, yPosition + 19)
  doc.setFont("helvetica", "normal")
  doc.text(new Date(timesheetData.timesheetDate).toLocaleDateString(), margin + 25, yPosition + 19)

  // Right column - Total hours
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("Total Hours:", pageWidth - margin - 70, yPosition + 8)
  doc.setFontSize(18)
  doc.setTextColor(99, 102, 241) // Indigo color for emphasis
  doc.text(`${timesheetData.totalHours.toFixed(2)}h`, pageWidth - margin - 70, yPosition + 20)

  yPosition += 50

  // Table header with improved design
  doc.setFillColor(99, 102, 241) // Indigo background
  doc.rect(margin, yPosition - 3, pageWidth - margin * 2, 12, "F")

  doc.setTextColor(255, 255, 255) // White text
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")

  const headers = ["Client", "Activity", "Service", "Hours", "Bill To", "Status"]
  const colWidths = [32, 28, 38, 15, 32, 25]
  let xPosition = margin + 2

  headers.forEach((header, index) => {
    doc.text(header, xPosition, yPosition + 5)
    xPosition += colWidths[index]
  })

  yPosition += 15

  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)

  // Check if entries exist and render them
  if (timesheetData.entries && timesheetData.entries.length > 0) {
    timesheetData.entries.forEach((entry, index) => {
      if (yPosition > 260) {
        // Start new page if needed
        doc.addPage()
        yPosition = 30

        // Repeat header on new page
        doc.setFillColor(99, 102, 241)
        doc.rect(margin, yPosition - 3, pageWidth - margin * 2, 12, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")

        xPosition = margin + 2
        headers.forEach((header, index) => {
          doc.text(header, xPosition, yPosition + 5)
          xPosition += colWidths[index]
        })

        yPosition += 15
        doc.setTextColor(0, 0, 0)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
      }

      // Alternating row colors
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251) // Very light gray
        doc.rect(margin, yPosition - 2, pageWidth - margin * 2, 10, "F")
      }

      xPosition = margin + 2
      const rowData = [
        entry.clientName.length > 15 ? entry.clientName.substring(0, 12) + "..." : entry.clientName,
        entry.activity.length > 12 ? entry.activity.substring(0, 9) + "..." : entry.activity,
        entry.itemName.length > 18 ? entry.itemName.substring(0, 15) + "..." : entry.itemName,
        entry.hours.toString(),
        entry.billToClient.length > 15 ? entry.billToClient.substring(0, 12) + "..." : entry.billToClient,
        entry.billable,
      ]

      rowData.forEach((data, index) => {
        doc.text(data, xPosition, yPosition + 4)
        xPosition += colWidths[index]
      })

      yPosition += 10
    })
  }

  yPosition += 15

  // Summary section
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, yPosition, pageWidth - margin * 2, 25, "F")
  doc.setDrawColor(226, 232, 240)
  doc.rect(margin, yPosition, pageWidth - margin * 2, 25, "S")

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(51, 65, 85)
  doc.text("Summary:", margin + 5, yPosition + 8)
  doc.text(`${timesheetData.entries.length} entries`, margin + 5, yPosition + 15)
  doc.text(`Total: ${timesheetData.totalHours.toFixed(2)} hours`, pageWidth - margin - 50, yPosition + 12)

  // Footer
  yPosition += 40
  doc.setFontSize(8)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(107, 114, 128)
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    pageWidth / 2,
    yPosition,
    {
      align: "center",
    },
  )

  const pdfOutput = doc.output("arraybuffer")
  const pdfBuffer = Buffer.from(pdfOutput)

  return {
    name: `${timesheetData.timesheetNumber}___${timesheetData.loggedInUserName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    mime: "application/pdf",
    data: pdfBuffer,
  }
}
