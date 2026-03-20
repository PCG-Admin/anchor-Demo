import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { BillingEntry } from "../types/billing"

interface BillingTableProps {
  data: BillingEntry[]
}

export function BillingTable({ data }: BillingTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Login Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Client Name</TableHead>
            <TableHead>Item Name</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Billable</TableHead>
            <TableHead>Standard Fee</TableHead>
            <TableHead>Rate/Hour</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Comments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.loginName}</TableCell>
              <TableCell>{entry.date}</TableCell>
              <TableCell>
                <Badge variant={entry.activity === "External" ? "default" : "secondary"}>{entry.activity}</Badge>
              </TableCell>
              <TableCell>{entry.clientName}</TableCell>
              <TableCell>{entry.itemName}</TableCell>
              <TableCell>{entry.hours}</TableCell>
              <TableCell>
                <Badge
                  className={
                    entry.billable === "Billable"
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                      : entry.billable === "Work in Progress"
                        ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-white"
                        : entry.billable === "Recurring"
                          ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white"
                          : "bg-gradient-to-r from-orange-400 to-red-400 text-white"
                  }
                >
                  {entry.billable === "Not Billable" ? "Non-Billable" : entry.billable}
                </Badge>
              </TableCell>
              <TableCell>R {entry.standardItemFee.toLocaleString()}</TableCell>
              <TableCell>R {entry.ratePerHour.toLocaleString()}</TableCell>
              <TableCell className="font-semibold">R {entry.total.toLocaleString()}</TableCell>
              <TableCell className="max-w-xs truncate">{entry.comments}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
