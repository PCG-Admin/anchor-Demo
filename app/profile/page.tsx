import { ProfileForm } from "../../components/profile-form"
import { User, Settings } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent">
                My Profile
              </h1>
              <p className="text-slate-600 text-lg">Manage your account details and preferences</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm text-slate-600 bg-indigo-50 px-4 py-3 rounded-lg border border-indigo-200">
            <Settings className="h-4 w-4 text-indigo-600" />
            <span>Update your personal information and change your password.</span>
          </div>
        </div>

        <ProfileForm />
      </div>
    </ProtectedRoute>
  )
}
