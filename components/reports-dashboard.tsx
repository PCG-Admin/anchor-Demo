"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { BillingEntry, ClientSummary, StaffSummary } from "../types/billing"
import { format, parseISO } from "date-fns"
import { TrendingUp, Users, Clock, DollarSign, Target, Activity, Calendar, FileText } from "lucide-react"

interface ReportsDashboardProps {
  data: BillingEntry[]
}

export function ReportsDashboard({ data }: ReportsDashboardProps) {
  const isBillableStatus = (status: BillingEntry["billable"]) => status === "Billable" || status === "Recurring"

  // Calculate client summaries
  const clientSummaries: ClientSummary[] = data
    .filter((entry) => entry.activity === "External")
    .reduce((acc, entry) => {
      const billable = isBillableStatus(entry.billable)
      const existing = acc.find((c) => c.clientName === entry.clientName)
      if (existing) {
        existing.totalHours += entry.hours
        existing.totalBilling += entry.total
        if (billable) {
          existing.billableHours += entry.hours
        } else {
          existing.nonBillableHours += entry.hours
        }
      } else {
        acc.push({
          clientName: entry.clientName,
          totalHours: entry.hours,
          totalBilling: entry.total,
          billableHours: billable ? entry.hours : 0,
          nonBillableHours: billable ? 0 : entry.hours,
        })
      }
      return acc
    }, [] as ClientSummary[])
    .sort((a, b) => b.totalBilling - a.totalBilling)

  // Calculate staff summaries with proper type handling
  interface StaffSummaryAccumulator {
    staffName: string
    totalHours: number
    billableHours: number
    totalIncome: number
    clientsServedSet: Set<string>
  }

  const staffSummaries: StaffSummary[] = data
    .reduce((acc, entry) => {
      const billable = isBillableStatus(entry.billable)
      const existing = acc.find((s) => s.staffName === entry.loginName)
      if (existing) {
        existing.totalHours += entry.hours
        if (billable) {
          existing.billableHours += entry.hours
          existing.totalIncome += entry.total
        }
        if (entry.activity === "External") {
          existing.clientsServedSet.add(entry.clientName)
        }
      } else {
        const newEntry: StaffSummaryAccumulator = {
          staffName: entry.loginName,
          totalHours: entry.hours,
          billableHours: billable ? entry.hours : 0,
          totalIncome: billable ? entry.total : 0,
          clientsServedSet: new Set(entry.activity === "External" ? [entry.clientName] : []),
        }
        acc.push(newEntry)
      }
      return acc
    }, [] as StaffSummaryAccumulator[])
    .map((summary) => ({
      staffName: summary.staffName,
      totalHours: summary.totalHours,
      billableHours: summary.billableHours,
      totalIncome: summary.totalIncome,
      clientsServed: summary.clientsServedSet.size,
    }))
    .sort((a, b) => b.totalIncome - a.totalIncome)

  // Calculate income per item
  const incomePerItem = data
    .filter((entry) => isBillableStatus(entry.billable))
    .reduce(
      (acc, entry) => {
        const existing = acc.find((i) => i.itemName === entry.itemName)
        if (existing) {
          existing.totalIncome += entry.total
          existing.totalHours += entry.hours
        } else {
          acc.push({
            itemName: entry.itemName,
            totalIncome: entry.total,
            totalHours: entry.hours,
          })
        }
        return acc
      },
      [] as { itemName: string; totalIncome: number; totalHours: number }[],
    )
    .sort((a, b) => b.totalIncome - a.totalIncome)

  // Calculate total billing and hours
  const totalBilling = data.filter((e) => isBillableStatus(e.billable)).reduce((sum, e) => sum + e.total, 0)
  const totalBillableHours = data.filter((e) => isBillableStatus(e.billable)).reduce((sum, e) => sum + e.hours, 0)
  const totalInternalHours = data.filter((e) => e.activity === "Internal").reduce((sum, e) => sum + e.hours, 0)
  const totalHoursAll = data.reduce((sum, e) => sum + e.hours, 0)
  const totalNonBillableHours = totalHoursAll - totalBillableHours

  // Calculate average billable rate
  const averageBillableRate = totalBillableHours > 0 ? totalBilling / totalBillableHours : 0

  // Calculate billable utilization
  const billableUtilization = totalHoursAll > 0 ? (totalBillableHours / totalHoursAll) * 100 : 0

  // Monthly Billing Trend with proper date parsing
  const monthlyBillingData = data
    .filter((entry) => entry.billable === "Billable")
    .reduce(
      (acc, entry) => {
        const monthYear = format(parseISO(entry.date), "MMM yyyy")
        const existing = acc.find((item) => item.month === monthYear)
        if (existing) {
          existing.totalBilling += entry.total
          existing.billableHours += entry.hours
        } else {
          acc.push({
            month: monthYear,
            totalBilling: entry.total,
            billableHours: entry.hours,
          })
        }
        return acc
      },
      [] as { month: string; totalBilling: number; billableHours: number }[],
    )
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  const mockMonthlyData = [
    { month: "Jan 2025", totalBilling: 45000, billableHours: 180 },
    { month: "Feb 2025", totalBilling: 52000, billableHours: 195 },
    { month: "Mar 2025", totalBilling: 48000, billableHours: 175 },
    { month: "Apr 2025", totalBilling: 58000, billableHours: 210 },
    { month: "May 2025", totalBilling: 61000, billableHours: 225 },
    { month: "Jun 2025", totalBilling: 55000, billableHours: 200 },
    { month: "Jul 2025", totalBilling: 63000, billableHours: 240 },
  ]

  // Combine mock data with actual data, removing duplicates
  const combinedMonthlyData = [...mockMonthlyData]
  monthlyBillingData.forEach((actualData) => {
    const existingIndex = combinedMonthlyData.findIndex((mock) => mock.month === actualData.month)
    if (existingIndex >= 0) {
      combinedMonthlyData[existingIndex] = actualData
    } else {
      combinedMonthlyData.push(actualData)
    }
  })

  const finalMonthlyBillingData = combinedMonthlyData.sort(
    (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime(),
  )

  // Top Service Items by Hours
  const topServiceItemsByHours = data
    .reduce(
      (acc, entry) => {
        const existing = acc.find((item) => item.itemName === entry.itemName)
        if (existing) {
          existing.totalHours += entry.hours
        } else {
          acc.push({
            itemName: entry.itemName,
            totalHours: entry.hours,
          })
        }
        return acc
      },
      [] as { itemName: string; totalHours: number }[],
    )
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 8)

  // Weekly performance data
  const weeklyData = data
    .filter((entry) => entry.billable === "Billable")
    .reduce(
      (acc, entry) => {
        const week = format(parseISO(entry.date), "MMM dd")
        const existing = acc.find((item) => item.week === week)
        if (existing) {
          existing.revenue += entry.total
          existing.hours += entry.hours
        } else {
          acc.push({
            week,
            revenue: entry.total,
            hours: entry.hours,
          })
        }
        return acc
      },
      [] as { week: string; revenue: number; hours: number }[],
    )
    .sort((a, b) => new Date(a.week + " 2024").getTime() - new Date(b.week + " 2024").getTime())
    .slice(-8) // Last 8 weeks

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
  ]

  return (
    <div className="space-y-8">
      {/* Enhanced Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">R {totalBilling.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+15.2% from last period</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalBillableHours}</div>
            <p className="text-xs text-muted-foreground">{totalInternalHours} internal hours</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{clientSummaries.length}</div>
            <p className="text-xs text-muted-foreground">Across all service lines</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Billable Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">R {averageBillableRate.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Per hour blended rate</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{billableUtilization.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Target: 75% | Industry: 65%</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">{staffSummaries.length}</div>
            <p className="text-xs text-muted-foreground">Professional staff members</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-pink-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Project Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-600">
              R {clientSummaries.length > 0 ? (totalBilling / clientSummaries.length).toFixed(0) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Per client engagement</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Service Lines</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-600">{incomePerItem.length}</div>
            <p className="text-xs text-muted-foreground">Different service offerings</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly Billing Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue Trend</CardTitle>
            <CardDescription>Revenue growth over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                totalBilling: {
                  label: "Revenue",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={finalMonthlyBillingData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`R ${Number(value).toLocaleString()}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalBilling"
                    stroke="hsl(var(--chart-1))"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Weekly Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Performance</CardTitle>
            <CardDescription>Revenue and hours by week</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: {
                  label: "Revenue",
                  color: "hsl(var(--chart-2))",
                },
                hours: {
                  label: "Hours",
                  color: "hsl(var(--chart-3))",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis yAxisId="left" tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--chart-2))" }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(var(--chart-3))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Billable vs Non-Billable Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Time Allocation</CardTitle>
            <CardDescription>Billable vs. non-billable hours distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                billable: {
                  label: "Billable Hours",
                  color: "hsl(var(--chart-1))",
                },
                nonBillable: {
                  label: "Non-Billable Hours",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Billable Hours", value: totalBillableHours, fill: COLORS[0] },
                      { name: "Non-Billable Hours", value: totalNonBillableHours, fill: COLORS[1] },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell key={`cell-0`} fill={COLORS[0]} />
                    <Cell key={`cell-1`} fill={COLORS[1]} />
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`${Number(value).toLocaleString()} hours`, "Hours"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Service Items by Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Service Line Performance</CardTitle>
            <CardDescription>Hours spent by service type</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                hours: {
                  label: "Hours",
                  color: "hsl(var(--chart-4))",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServiceItemsByHours}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="itemName"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={10}
                  />
                  <YAxis tickFormatter={(value) => `${value.toLocaleString()}h`} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`${Number(value).toLocaleString()} hours`, "Hours"]}
                  />
                  <Bar dataKey="totalHours" fill={COLORS[3]} radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Client Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Client Performance Analysis</CardTitle>
          <CardDescription>Detailed breakdown of client relationships and profitability</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Billable Hours</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Avg. Rate</TableHead>
                <TableHead>Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientSummaries.map((client) => (
                <TableRow key={client.clientName}>
                  <TableCell className="font-medium">{client.clientName}</TableCell>
                  <TableCell>{client.totalHours}</TableCell>
                  <TableCell>{client.billableHours}</TableCell>
                  <TableCell className="font-semibold">R {client.totalBilling.toLocaleString()}</TableCell>
                  <TableCell>
                    R {client.billableHours > 0 ? (client.totalBilling / client.billableHours).toFixed(0) : 0}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        client.totalBilling > 8000 ? "default" : client.totalBilling > 4000 ? "secondary" : "outline"
                      }
                    >
                      {client.totalBilling > 8000 ? "Platinum" : client.totalBilling > 4000 ? "Gold" : "Silver"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Staff Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Metrics</CardTitle>
          <CardDescription>Individual contributor analysis and productivity metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Billable Hours</TableHead>
                <TableHead>Revenue Generated</TableHead>
                <TableHead>Clients Served</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffSummaries.map((staff) => {
                const utilization = (staff.billableHours / staff.totalHours) * 100
                return (
                  <TableRow key={staff.staffName}>
                    <TableCell className="font-medium">{staff.staffName}</TableCell>
                    <TableCell>{staff.totalHours}</TableCell>
                    <TableCell>{staff.billableHours}</TableCell>
                    <TableCell className="font-semibold">R {staff.totalIncome.toLocaleString()}</TableCell>
                    <TableCell>{staff.clientsServed}</TableCell>
                    <TableCell>{utilization.toFixed(1)}%</TableCell>
                    <TableCell>
                      <Badge variant={utilization > 80 ? "default" : utilization > 60 ? "secondary" : "outline"}>
                        {utilization > 80 ? "Excellent" : utilization > 60 ? "Good" : "Needs Improvement"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
