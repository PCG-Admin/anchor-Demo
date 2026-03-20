import { ProtectedRoute } from "@/components/protected-route"
import ManageInvoicesAndTimesheets from "@/components/manage-invoices"

export default function ManageInvoicesAndTimesheetsPage() {
  return (
    <ProtectedRoute>
      <ManageInvoicesAndTimesheets />
    </ProtectedRoute>
  )
}
