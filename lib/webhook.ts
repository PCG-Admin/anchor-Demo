export interface WebhookInvoiceData {
  invoiceDate: string
  totalAmount: number
  invoiceNumber: string
  billToClient: string
  userName: string
  documentType: "Invoice" // Added document_type field for consistency
  pdfDocument?: {
    name: string
    mime: string
    data: Buffer
  }
  xmlDocument?: {
    name: string
    mime: string
    data: Buffer
  }
}

export interface WebhookTimesheetData {
  timesheetDate: string
  totalHours: number
  timesheetNumber: string
  userName: string
  documentType: "Timesheet"
  pdfDocument?: {
    name: string
    mime: string
    data: Buffer
  }
}

export async function sendInvoiceToWebhook(invoiceData: WebhookInvoiceData): Promise<boolean> {
  const webhookUrl = "https://hook.eu2.make.com/nkee2ce7hgu8fxp4coxd1m5wqic4cq9f"

  try {
    const formData = new FormData()

    formData.append("document_type", invoiceData.documentType)

    formData.append("invoice_date", invoiceData.invoiceDate)
    formData.append("total_amount", invoiceData.totalAmount.toString())
    formData.append("invoice_number", invoiceData.invoiceNumber)
    formData.append("bill_to_client", invoiceData.billToClient)
    formData.append("invoice_user_name", invoiceData.userName)

    // Add PDF as binary file if present
    if (invoiceData.pdfDocument) {
      const pdfBlob = new Blob([invoiceData.pdfDocument.data], {
        type: "application/pdf",
      })
      formData.append("pdfDocument", pdfBlob, `${invoiceData.invoiceNumber}___${invoiceData.billToClient}.pdf`)
    }

    if (invoiceData.xmlDocument) {
      const xmlBlob = new Blob([invoiceData.xmlDocument.data], {
        type: "application/xml",
      })
      formData.append("xmlDocument", xmlBlob, `${invoiceData.invoiceNumber}___${invoiceData.billToClient}.xml`)
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData, // Send as FormData instead of JSON
    })

    if (!response.ok) {
      throw new Error(`Webhook request failed with status: ${response.status}`)
    }

    return true
  } catch (error) {
    console.error("Error sending invoice to webhook:", error)
    throw error
  }
}

export async function sendTimesheetToWebhook(timesheetData: WebhookTimesheetData): Promise<boolean> {
  const webhookUrl = "https://hook.eu2.make.com/nkee2ce7hgu8fxp4coxd1m5wqic4cq9f"

  try {
    const formData = new FormData()

    // Add timesheet data as form fields
    formData.append("document_type", timesheetData.documentType)
    formData.append("timesheet_date", timesheetData.timesheetDate)
    formData.append("total_hours", timesheetData.totalHours.toString())
    formData.append("timesheet_number", timesheetData.timesheetNumber)
    formData.append("timesheet_user_name", timesheetData.userName)

    // Add PDF as binary file if present
    if (timesheetData.pdfDocument) {
      const pdfBlob = new Blob([timesheetData.pdfDocument.data], {
        type: "application/pdf",
      })
      formData.append("pdfDocument", pdfBlob, `${timesheetData.timesheetNumber}___${timesheetData.userName}.pdf`)
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData, // Send as FormData instead of JSON
    })

    if (!response.ok) {
      throw new Error(`Webhook request failed with status: ${response.status}`)
    }

    return true
  } catch (error) {
    console.error("Error sending timesheet to webhook:", error)
    throw error
  }
}
