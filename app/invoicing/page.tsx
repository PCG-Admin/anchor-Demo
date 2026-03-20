import Invoicing from "../../invoicing"
import { ProtectedRoute } from "@/components/protected-route"

export default function InvoicingPage() {
  return (
    <ProtectedRoute>
      <Invoicing />
    </ProtectedRoute>
  )
}
