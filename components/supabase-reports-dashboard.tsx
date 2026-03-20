"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Line,
  LineChart,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { TrendingUp, Users, Clock, DollarSign, AlertCircle, CheckCircle, XCircle, Filter, Search } from "lucide-react"
import {
  getAllReportsData,
  type InvoiceSummary,
  type RevenueByClient,
  type TimesheetSummary,
} from "../lib/supabase-reports"

export function SupabaseReportsDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    invoices: InvoiceSummary[]
    revenue: RevenueByClient[]
    timesheets: TimesheetSummary[]
  }>({
    invoices: [],
    revenue: [],
    timesheets: [],
  })

  const [filters, setFilters] = useState({
    clientSearch: "",
    invoiceStatus: "all",
    paymentStatus: "all",
    dateRange: "all", // all, last30, last90, thisYear
  })

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const reportsData = await getAllReportsData()
        setData(reportsData)
        setError(null)
      } catch (err) {
        console.error("Error fetching reports data:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch reports data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading reports data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">Error loading reports</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    )
  }

  const { invoices, revenue, timesheets } = data

  const filteredInvoices = invoices.filter((invoice) => {
    // Client search filter
    if (filters.clientSearch && !invoice.bill_to_client?.toLowerCase().includes(filters.clientSearch.toLowerCase())) {
      return false
    }

    // Invoice status filter
    if (filters.invoiceStatus !== "all" && invoice.status !== filters.invoiceStatus) {
      return false
    }

    // Payment status filter
    if (filters.paymentStatus !== "all" && invoice.payment_status !== filters.paymentStatus) {
      return false
    }

    // Date range filter
    if (filters.dateRange !== "all" && invoice.inv_date) {
      const invoiceDate = parseISO(invoice.inv_date)
      const now = new Date()

      switch (filters.dateRange) {
        case "last30":
          const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (invoiceDate < last30Days) return false
          break
        case "last90":
          const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          if (invoiceDate < last90Days) return false
          break
        case "thisYear":
          if (invoiceDate.getFullYear() !== now.getFullYear()) return false
          break
      }
    }

    return true
  })

  // Calculate key metrics from filtered data
  const totalRevenue = revenue.reduce((sum, client) => sum + (client.total_revenue || 0), 0)
  const totalInvoices = filteredInvoices.length
  const totalClients = revenue.length
  const totalBillableHours = timesheets.reduce((sum, ts) => sum + (ts.total_hours || 0), 0)
  const totalBillableAmount = timesheets.reduce((sum, ts) => sum + (ts.total_billable_amount || 0), 0)
  const averageHourlyRate = totalBillableHours > 0 ? totalBillableAmount / totalBillableHours : 0

  // Invoice status breakdown from filtered data
  const invoiceStatusData = filteredInvoices.reduce(
    (acc, invoice) => {
      const status = invoice.status || "Unknown"
      acc[status] = (acc[status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const COLORS = [
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
  ]

  const invoiceStatusChartData = Object.entries(invoiceStatusData).map(([status, count], index) => ({
    status,
    count,
    fill: COLORS[index % COLORS.length],
  }))

  const monthlyRevenueData = (() => {
    // Get all months from the earliest invoice to current month
    const allInvoices = invoices.filter((inv) => inv.inv_date && inv.inv_total)

    // If no real invoices, return empty array
    if (allInvoices.length === 0) return []

    const dates = allInvoices.map((inv) => parseISO(inv.inv_date))
    const earliestDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const latestDate = new Date()

    // Generate all months between earliest and latest
    const months: { month: string; revenue: number; invoiceCount: number }[] = []
    let currentDate = startOfMonth(earliestDate)

    while (currentDate <= latestDate) {
      const monthYear = format(currentDate, "MMM yyyy")
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)

      const monthInvoices = allInvoices.filter((invoice) => {
        const invDate = parseISO(invoice.inv_date)
        return isWithinInterval(invDate, { start: monthStart, end: monthEnd })
      })

      const realRevenue = monthInvoices.reduce((sum, inv) => sum + inv.inv_total, 0)
      const realInvoiceCount = monthInvoices.length

      if (realRevenue > 0 || realInvoiceCount > 0) {
        months.push({
          month: monthYear,
          revenue: realRevenue,
          invoiceCount: realInvoiceCount,
        })
      }

      // Move to next month
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    }

    return months.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
  })()

  const topClients = revenue
    .filter((client) => client.total_revenue > 0)
    .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
    .slice(0, 8)
    .map((client, index) => ({
      ...client,
      fill: COLORS[index % COLORS.length],
    }))

  const userPerformance = timesheets.reduce(
    (acc, ts) => {
      const existing = acc.find((user) => user.user_name === ts.user_name)
      if (existing) {
        existing.total_hours += ts.total_hours || 0
        existing.total_amount += ts.total_billable_amount || 0
        existing.timesheet_count += 1
      } else {
        acc.push({
          user_name: ts.user_name,
          user_email: ts.user_email,
          total_hours: ts.total_hours || 0,
          total_amount: ts.total_billable_amount || 0,
          timesheet_count: 1,
        })
      }
      return acc
    },
    [] as Array<{
      user_name: string
      user_email: string
      total_hours: number
      total_amount: number
      timesheet_count: number
    }>,
  )

  const recentInvoices = [...filteredInvoices]
    .sort((a, b) => {
      if (!a.inv_date && !b.inv_date) return 0
      if (!a.inv_date) return 1
      if (!b.inv_date) return -1
      return new Date(b.inv_date).getTime() - new Date(a.inv_date).getTime()
    })
    .slice(0, 10)

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>Filter and search through your reports data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Clients</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by client name..."
                  value={filters.clientSearch}
                  onChange={(e) => setFilters((prev) => ({ ...prev, clientSearch: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Invoice Status</label>
              <Select
                value={filters.invoiceStatus}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, invoiceStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Status</label>
              <Select
                value={filters.paymentStatus}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, paymentStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="last30">Last 30 Days</SelectItem>
                  <SelectItem value="last90">Last 90 Days</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFilters({ clientSearch: "", invoiceStatus: "all", paymentStatus: "all", dateRange: "all" })
              }
            >
              Clear Filters
            </Button>
            <div className="text-sm text-muted-foreground flex items-center">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-green-100">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-green-200" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold">R {totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-green-100 flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              From {totalInvoices} invoices
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-blue-100">Billable Hours</CardTitle>
            <Clock className="h-5 w-5 text-blue-200" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold">{totalBillableHours.toLocaleString()}</div>
            <p className="text-xs text-blue-100">Across {timesheets.length} timesheets</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-purple-100">Active Clients</CardTitle>
            <Users className="h-5 w-5 text-purple-200" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold">{totalClients}</div>
            <p className="text-xs text-purple-100">Revenue generating clients</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-500 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-orange-100">Avg. Hourly Rate</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-200" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold">R {averageHourlyRate.toFixed(0)}</div>
            <p className="text-xs text-orange-100">Blended billing rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800 flex items-center">
              <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-3"></div>
              Monthly Revenue Trend
            </CardTitle>
            <CardDescription>Complete timeline of invoice revenue by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: {
                  label: "Revenue",
                  color: "#3b82f6",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    fontSize={10}
                    stroke="#64748b"
                  />
                  <YAxis tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`} stroke="#64748b" />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`R ${Number(value).toLocaleString()}`, "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Invoice Status Distribution */}
        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800 flex items-center">
              <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full mr-3"></div>
              Invoice Status Distribution
            </CardTitle>
            <CardDescription>Current status of filtered invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                count: {
                  label: "Count",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={invoiceStatusChartData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {invoiceStatusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`${Number(value)} invoices`, "Count"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800 flex items-center">
              <div className="w-2 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full mr-3"></div>
              Top Clients by Revenue
            </CardTitle>
            <CardDescription>Highest revenue generating clients with color coding</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: {
                  label: "Revenue",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="client_name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={10}
                    stroke="#64748b"
                  />
                  <YAxis tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`} stroke="#64748b" />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`R ${Number(value).toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="total_revenue" radius={4}>
                    {topClients.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* User Performance */}
        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800 flex items-center">
              <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full mr-3"></div>
              Team Performance
            </CardTitle>
            <CardDescription>Hours and revenue by team member</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                hours: {
                  label: "Hours",
                  color: "#f59e0b",
                },
                amount: {
                  label: "Amount",
                  color: "#ef4444",
                },
              }}
              className="h-[350px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="user_name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={10}
                    stroke="#64748b"
                  />
                  <YAxis yAxisId="left" stroke="#64748b" />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="total_hours" fill="#f59e0b" name="Hours" />
                  <Bar yAxisId="right" dataKey="total_amount" fill="#ef4444" name="Amount (R)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Client Revenue Table */}
      <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <div className="w-2 h-6 bg-gradient-to-b from-yellow-500 to-orange-500 rounded-full mr-3"></div>
            Client Revenue Analysis
          </CardTitle>
          <CardDescription>Detailed client performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-slate-600">Client Name</TableHead>
                <TableHead className="text-slate-600">Total Invoices</TableHead>
                <TableHead className="text-slate-600">Total Revenue</TableHead>
                <TableHead className="text-slate-600">First Invoice</TableHead>
                <TableHead className="text-slate-600">Last Invoice</TableHead>
                <TableHead className="text-slate-600">Avg. Invoice Value</TableHead>
                <TableHead className="text-slate-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topClients.map((client) => (
                <TableRow key={client.client_id} className="border-slate-100 hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">{client.client_name}</TableCell>
                  <TableCell className="text-slate-600">{client.total_invoices}</TableCell>
                  <TableCell className="font-semibold text-slate-800">
                    R {(client.total_revenue || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {client.first_invoice_date ? format(parseISO(client.first_invoice_date), "MMM dd, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {client.last_invoice_date ? format(parseISO(client.last_invoice_date), "MMM dd, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    R {client.total_invoices > 0 ? ((client.total_revenue || 0) / client.total_invoices).toFixed(0) : 0}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        (client.total_revenue || 0) > 10000
                          ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg"
                          : (client.total_revenue || 0) > 5000
                            ? "bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-md"
                            : "bg-gradient-to-r from-slate-400 to-slate-500 text-white"
                      }
                    >
                      {(client.total_revenue || 0) > 10000
                        ? "Premium"
                        : (client.total_revenue || 0) > 5000
                          ? "Standard"
                          : "Basic"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <div className="w-2 h-6 bg-gradient-to-b from-pink-500 to-red-500 rounded-full mr-3"></div>
            Recent Invoices
          </CardTitle>
          <CardDescription>Latest invoice activity sorted by date (newest first)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-slate-600">Invoice #</TableHead>
                <TableHead className="text-slate-600">Client</TableHead>
                <TableHead className="text-slate-600">Date</TableHead>
                <TableHead className="text-slate-600">Due Date</TableHead>
                <TableHead className="text-slate-600">Amount</TableHead>
                <TableHead className="text-slate-600">Status</TableHead>
                <TableHead className="text-slate-600">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentInvoices.map((invoice) => (
                <TableRow key={invoice.invoice_id} className="border-slate-100 hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">{invoice.invoice_number}</TableCell>
                  <TableCell className="text-slate-600">{invoice.bill_to_client}</TableCell>
                  <TableCell className="text-slate-600">
                    {invoice.inv_date ? format(parseISO(invoice.inv_date), "MMM dd, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {invoice.due_date ? format(parseISO(invoice.due_date), "MMM dd, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">
                    R {(invoice.inv_total || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        invoice.status === "Sent"
                          ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md"
                          : "bg-gradient-to-r from-slate-400 to-slate-500 text-white"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {invoice.payment_status === "Paid" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : invoice.payment_status === "Pending" ? (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm text-slate-600">{invoice.payment_status}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
