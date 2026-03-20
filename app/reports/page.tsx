"use client"

import { SupabaseReportsDashboard } from "../../components/supabase-reports-dashboard"
import { BarChart3, TrendingUp } from "lucide-react"
import { AdminRoute } from "@/components/admin-route"

export default function ReportsPage() {
  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-orange-800 to-red-800 bg-clip-text text-transparent">
                Financial Reports
              </h1>
              <p className="text-slate-600 text-lg">Live insights from your Supabase database views.</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm text-slate-600 bg-orange-50 px-4 py-3 rounded-lg border border-orange-200">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            <span>Real-time analytics from invoice summaries, client revenue, and timesheet data.</span>
          </div>
        </div>

        <SupabaseReportsDashboard />
      </div>
    </AdminRoute>
  )
}
