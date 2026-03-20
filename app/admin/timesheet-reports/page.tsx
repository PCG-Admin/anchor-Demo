"use client"

import { AdminRoute } from "@/components/admin-route"
import { TimesheetReportsPage } from "@/components/timesheet-reports-page"

export default function AdminTimesheetReportsPage() {
  return (
    <AdminRoute>
      <TimesheetReportsPage />
    </AdminRoute>
  )
}
