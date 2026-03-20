import TimeSheet from "../../timesheet"
import { ProtectedRoute } from "@/components/protected-route"

export default function TimeSheetPage() {
  return (
    <ProtectedRoute>
      <TimeSheet />
    </ProtectedRoute>
  )
}
