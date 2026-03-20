import type { Invoice } from "@/types/invoice"

export interface XMLDocument {
  name: string
  mime: string
  data: Buffer
}

export function generateInvoiceXML(invoice: Invoice): XMLDocument {
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <Header>
    <InvoiceNumber>${escapeXml(invoice.invoiceNumber)}</InvoiceNumber>
    <IssueDate>${invoice.issueDate}</IssueDate>
    <DueDate>${invoice.dueDate}</DueDate>
    <Status>${escapeXml(invoice.status)}</Status>
    <CreatedBy>${escapeXml(invoice.createdBy)}</CreatedBy>
    <CreatedAt>${invoice.createdAt}</CreatedAt>
  </Header>
  
  <Supplier>
    <Name>Anchor Accounting</Name>
    <Description>Professional Accounting Services</Description>
    <Email>accounting@anchor.co.za</Email>
    <Phone>+27 11 123 4567</Phone>
    <Address>Cape Town, South Africa</Address>
  </Supplier>
  
  <Customer>
    <Name>${escapeXml(invoice.clientName)}</Name>
    ${invoice.clientAddress ? `<Address>${escapeXml(invoice.clientAddress)}</Address>` : ""}
    ${invoice.clientEmail ? `<Email>${escapeXml(invoice.clientEmail)}</Email>` : ""}
  </Customer>
  
  <LineItems>
    ${invoice.entries
      .map(
        (entry) => `
    <LineItem>
      <ID>${escapeXml(entry.id)}</ID>
      <Date>${entry.date}</Date>
      <Description>${escapeXml(entry.itemName)}${entry.comments ? ` - ${escapeXml(entry.comments)}` : ""}</Description>
      <Hours>${entry.hours}</Hours>
      <RatePerHour>${entry.ratePerHour}</RatePerHour>
      <Total>${entry.total}</Total>
    </LineItem>`,
      )
      .join("")}
  </LineItems>
  
  <Totals>
    <Subtotal>${invoice.subtotal}</Subtotal>
    <TaxRate>${invoice.taxRate}</TaxRate>
    <TaxAmount>${invoice.taxAmount}</TaxAmount>
    <TotalAmount>${invoice.total}</TotalAmount>
  </Totals>
  
  ${invoice.notes ? `<Notes>${escapeXml(invoice.notes)}</Notes>` : ""}
</Invoice>`

  const xmlBuffer = Buffer.from(xmlContent, "utf-8")

  return {
    name: `${invoice.invoiceNumber}___${invoice.clientName.replace(/[^a-zA-Z0-9]/g, "_")}.xml`,
    mime: "application/xml",
    data: xmlBuffer,
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "&":
        return "&amp;"
      case "'":
        return "&apos;"
      case '"':
        return "&quot;"
      default:
        return c
    }
  })
}
