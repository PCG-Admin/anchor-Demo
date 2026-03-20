import { ManageClientsPage } from "@/components/manage-clients-page"
import { ProtectedRoute } from "@/components/protected-route"

export default function ManageClients() {
  return (
    <ProtectedRoute>
      <ManageClientsPage />
    </ProtectedRoute>
  )
}
