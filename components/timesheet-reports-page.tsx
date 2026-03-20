"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Users, TrendingUp, Filter, Download, BarChart3 } from "lucide-react"
import { markTimesheetEntriesAsExported, getTimesheetDetailedDataWithExported } from "@/lib/supabase"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

interface TimesheetDetailedEntry {
  id: number
  entry_date: string
  activity: string
  client_name: string
  service: string
  status: string
  retainer: boolean
  bill_to_client: string
  hours: number
  rate: number
  total: number // Changed from amount to total to match database schema
  comments: string
  username: string
  user: string // Changed from user_id to user to match database schema
  exported?: string // Changed from boolean to string to match database schema
}

interface FilterState {
  startDate: string
  endDate: string
  client: string
  service: string
  status: string
  user: string
  exported: string
}

export function TimesheetReportsPage() {
  const [entries, setEntries] = useState<TimesheetDetailedEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<TimesheetDetailedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterState>({
    startDate: "",
    endDate: "",
    client: "All Clients",
    service: "All Services",
    status: "All Status",
    user: "All Users",
    exported: "All",
  })

  useEffect(() => {
    fetchTimesheetData()
  }, [])

  const fetchTimesheetData = async () => {
    try {
      console.log("📊 Fetching timesheet detailed data with exported field...")

      const data = await getTimesheetDetailedDataWithExported()

      console.log("✅ Fetched timesheet entries:", data?.length || 0)
      setEntries(data || [])
      setFilteredEntries(data || [])

      // Extract unique values for filters
      const uniqueClients = [...new Set(data?.map((entry) => entry.client_name).filter(Boolean))]
      const uniqueServices = [...new Set(data?.map((entry) => entry.service).filter(Boolean))]
      const uniqueUsers = [...new Set(data?.map((entry) => entry.username).filter(Boolean))]

      setClients(uniqueClients)
      setServices(uniqueServices)
      setUsers(uniqueUsers)
    } catch (error) {
      console.error("💥 Error in fetchTimesheetData:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let filtered = [...entries]

    if (filters.startDate) {
      filtered = filtered.filter((entry) => entry.entry_date >= filters.startDate)
    }
    if (filters.endDate) {
      filtered = filtered.filter((entry) => entry.entry_date <= filters.endDate)
    }
    if (filters.client !== "All Clients") {
      filtered = filtered.filter((entry) => entry.client_name === filters.client)
    }
    if (filters.service !== "All Services") {
      filtered = filtered.filter((entry) => entry.service === filters.service)
    }
    if (filters.status !== "All Status") {
      filtered = filtered.filter((entry) => entry.status === filters.status)
    }
    if (filters.user !== "All Users") {
      filtered = filtered.filter((entry) => entry.username === filters.user)
    }
    if (filters.exported !== "All") {
      if (filters.exported === "Exported") {
        filtered = filtered.filter((entry) => entry.exported === "True")
      } else if (filters.exported === "Not Exported") {
        filtered = filtered.filter((entry) => entry.exported !== "True")
      }
    }

    setFilteredEntries(filtered)
  }, [filters, entries])

  const totalHours = filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0)
  const totalRevenue = filteredEntries.reduce((sum, entry) => sum + (entry.total || 0), 0) // Changed from amount to total
  const billableHours = filteredEntries
    .filter((entry) => entry.status === "Billable")
    .reduce((sum, entry) => sum + (entry.hours || 0), 0)
  const billableRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0

  const clientRevenueData = clients
    .map((client) => {
      const clientEntries = filteredEntries.filter((entry) => entry.client_name === client)
      return {
        name: client,
        revenue: clientEntries.reduce((sum, entry) => sum + (entry.total || 0), 0), // Changed from amount to total
        hours: clientEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0),
      }
    })
    .filter((item) => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  const serviceDistribution = services
    .map((service) => {
      const serviceEntries = filteredEntries.filter((entry) => entry.service === service)
      return {
        name: service,
        value: serviceEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0),
      }
    })
    .filter((item) => item.value > 0)

  const dailyHoursData = filteredEntries.reduce(
    (acc, entry) => {
      const date = entry.entry_date
      if (!acc[date]) {
        acc[date] = { date, hours: 0, revenue: 0 }
      }
      acc[date].hours += entry.hours || 0
      acc[date].revenue += entry.total || 0 // Changed from amount to total
      return acc
    },
    {} as Record<string, { date: string; hours: number; revenue: number }>,
  )

  const dailyHoursArray = Object.values(dailyHoursData).sort((a, b) => a.date.localeCompare(b.date))

  const COLORS = [
    "#3b82f6", // blue-500
    "#ef4444", // red-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#8b5cf6", // violet-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
    "#ec4899", // pink-500
    "#84cc16", // lime-500
    "#6366f1", // indigo-500
    "#14b8a6", // teal-500
    "#f43f5e", // rose-500
  ]

  const exportToCSV = async () => {
    const headers = [
      "Date",
      "User",
      "Client",
      "Service",
      "Activity",
      "Hours",
      "Rate",
      "Amount",
      "Status",
      "Retainer",
      "Bill To Client",
      "Comments",
    ]

    const csvData = filteredEntries.map((entry) => [
      entry.entry_date,
      entry.username,
      entry.client_name,
      entry.service,
      entry.activity,
      entry.hours,
      entry.rate || 0,
      entry.total || 0, // Changed from amount to total
      entry.status,
      entry.retainer ? "Yes" : "No",
      entry.bill_to_client,
      entry.comments || "",
    ])

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        row
          .map((field) => (typeof field === "string" && field.includes(",") ? `"${field.replace(/"/g, '""')}"` : field))
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `timesheet-report-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Mark entries as exported using the correct function from lib/supabase.ts
    try {
      const entryIds = filteredEntries.map((entry) => entry.id)
      await markTimesheetEntriesAsExported(entryIds) // Using the imported function instead of local one

      // Refresh the data to show updated export status
      await fetchTimesheetData()
    } catch (error) {
      console.error("Error marking entries as exported:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-pink-800 bg-clip-text text-transparent">
              Timesheet Reports
            </h1>
            <p className="text-slate-600 text-lg">Detailed analytics from timesheet entries.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-pink-800 bg-clip-text text-transparent">
              Timesheet Reports
            </h1>
            <p className="text-slate-600 text-lg">Detailed analytics from timesheet entries.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-slate-900">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Start Date</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">End Date</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Client</label>
              <Select
                value={filters.client}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, client: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Clients">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Service</label>
              <Select
                value={filters.service}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, service: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Services">All Services</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Status">All Status</SelectItem>
                  <SelectItem value="Billable">Billable</SelectItem>
                  <SelectItem value="Work in Progress">Work in Progress</SelectItem>
                  <SelectItem value="Not Billable">Non-Billable</SelectItem>
                  <SelectItem value="Recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">User</label>
              <Select value={filters.user} onValueChange={(value) => setFilters((prev) => ({ ...prev, user: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Users">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Exported</label>
              <Select
                value={filters.exported}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, exported: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Exported">Exported</SelectItem>
                  <SelectItem value="Not Exported">Not Exported</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  startDate: "",
                  endDate: "",
                  client: "All Clients",
                  service: "All Services",
                  status: "All Status",
                  user: "All Users",
                  exported: "All",
                })
              }
            >
              Clear Filters
            </Button>
            <div className="text-sm text-slate-600">
              Showing {filteredEntries.length} of {entries.length} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="relative">
            <CardTitle className="flex items-center justify-between">
              <span>Total Hours</span>
              <Clock className="h-6 w-6" />
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold">{totalHours.toFixed(1)}</div>
            <p className="text-blue-100 text-sm">Across all entries</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="relative">
            <CardTitle className="flex items-center justify-between">
              <span>Total Revenue</span>
              <TrendingUp className="h-6 w-6" />
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold">R{(totalRevenue || 0).toLocaleString()}</div>
            <p className="text-green-100 text-sm">From timesheet entries</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="relative">
            <CardTitle className="flex items-center justify-between">
              <span>Billable Hours</span>
              <Calendar className="h-6 w-6" />
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold">{billableHours.toFixed(1)}</div>
            <p className="text-purple-100 text-sm">Billable entries only</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-500 to-red-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <CardHeader className="relative">
            <CardTitle className="flex items-center justify-between">
              <span>Billable Rate</span>
              <Users className="h-6 w-6" />
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold">{billableRate.toFixed(1)}%</div>
            <p className="text-orange-100 text-sm">Of total hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Revenue Chart */}
        <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
          <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-t-lg"></div>
          <CardHeader>
            <CardTitle className="text-slate-900">Revenue by Client</CardTitle>
            <CardDescription>Top performing clients by revenue with unique colors</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientRevenueData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => [`R${(Number(value) || 0).toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" radius={4}>
                  {clientRevenueData.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex flex-wrap gap-2">
              {clientRevenueData.slice(0, 10).map((client, index) => (
                <div key={client.name} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-xs text-slate-600">{client.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Distribution */}
        <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
          <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-lg"></div>
          <CardHeader>
            <CardTitle className="text-slate-900">Service Distribution</CardTitle>
            <CardDescription>Hours breakdown by service type with legend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={serviceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {serviceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => {
                    const total = serviceDistribution.reduce((sum, item) => sum + item.value, 0)
                    const percentage = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0
                    return [`${value} hours (${percentage}%)`, "Hours"]
                  }}
                  labelFormatter={(label) => `Service: ${label}`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {serviceDistribution.map((service, index) => (
                <div key={service.name} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-xs text-slate-600">
                    {service.name} ({service.value}h)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Hours Trend */}
        <Card className="border-0 shadow-xl bg-white backdrop-blur-sm lg:col-span-2">
          <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-t-lg"></div>
          <CardHeader>
            <CardTitle className="text-slate-900">Daily Hours Trend</CardTitle>
            <CardDescription>Hours and revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyHoursArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value, name) => [
                    name === "hours" ? `${value || 0} hours` : `R${(Number(value) || 0).toLocaleString()}`,
                    name === "hours" ? "Hours" : "Revenue",
                  ]}
                />
                <Line yAxisId="left" type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card className="border-0 shadow-xl bg-white backdrop-blur-sm">
        <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-lg"></div>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-slate-900">
            <span>Timesheet Entries</span>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardTitle>
          <CardDescription>Detailed view of all timesheet entries ({filteredEntries.length} entries)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                  <th className="text-left p-3 font-semibold text-slate-700">User</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Client</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Service</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Hours</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Rate</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Amount</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Exported</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.slice(0, 50).map((entry) => {
                  const statusStyles =
                    entry.status === "Billable"
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                      : entry.status === "Work in Progress"
                        ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-white"
                        : entry.status === "Recurring"
                          ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white"
                          : "bg-gradient-to-r from-orange-400 to-red-400 text-white"
                  const statusLabel = entry.status === "Not Billable" ? "Non-Billable" : entry.status

                  return (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3">{new Date(entry.entry_date).toLocaleDateString()}</td>
                      <td className="p-3">{entry.username}</td>
                      <td className="p-3">{entry.client_name}</td>
                      <td className="p-3">{entry.service}</td>
                      <td className="p-3">{entry.hours}</td>
                      <td className="p-3">R{entry.rate || 0}</td>
                      <td className="p-3">R{(entry.total || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <Badge className={statusStyles}>{statusLabel}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={entry.exported === "True" ? "default" : "outline"}>
                          {entry.exported === "True" ? "Yes" : "No"}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredEntries.length > 50 && (
              <div className="text-center p-4 text-slate-600">
                Showing first 50 entries of {filteredEntries.length} total
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
