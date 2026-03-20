import { ManageEmployeesForm } from "../../components/manage-employees-form"
import { Users, Shield } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { AdminRoute } from "@/components/admin-route"

export default function ManageEmployeesPage() {
  return (
    <ProtectedRoute>
      <AdminRoute>
        <div className="container mx-auto p-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-red-800 to-pink-800 bg-clip-text text-transparent">
                  Manage Employees
                </h1>
                <p className="text-slate-600 text-lg">Add, edit, and manage team members in the system</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm text-slate-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
              <Shield className="h-4 w-4 text-red-600" />
              <span>Admin access required. You can add new employees or manage existing ones.</span>
            </div>
          </div>

          <ManageEmployeesForm />
        </div>
      </AdminRoute>
    </ProtectedRoute>
  )
}
