"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import {
  getServiceItems,
  createServiceItem,
  updateServiceItem,
  deleteServiceItem,
  type ServiceItem,
  type ServiceItemRaw,
} from "@/lib/supabase"
import { ProtectedRoute } from "@/components/protected-route"

export default function ServiceItemsAdmin() {
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    rate: 0,
    account: 4100,
    taxRate: "Standard Rate Sales",
  })

  useEffect(() => {
    loadServiceItems()
  }, [])

  const loadServiceItems = async () => {
    try {
      setLoading(true)
      const items = await getServiceItems()
      setServiceItems(items)
    } catch (error) {
      console.error("Error loading service items:", error)
      toast({
        title: "Error",
        description: "Failed to load service items. Please refresh the page.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const rawData: Omit<ServiceItemRaw, "xero_item_code"> = {
        xero_sales_description: formData.name,
        sales_unit_price: formData.rate.toString(),
        sales_account: formData.account,
        sales_tax_rate: formData.taxRate,
      }

      // If code is provided, include it in the raw data
      const createData = formData.code.trim()
        ? ({ ...rawData, xero_item_code: formData.code } as ServiceItemRaw)
        : rawData

      const newItemRaw = await createServiceItem(createData)

      // Transform the returned raw data to application format
      const newItem: ServiceItem = {
        code: newItemRaw.xero_item_code,
        name: newItemRaw.xero_sales_description,
        rate: Number.parseFloat(newItemRaw.sales_unit_price) || 0,
        account: newItemRaw.sales_account,
        taxRate: newItemRaw.sales_tax_rate,
      }

      setServiceItems([...serviceItems, newItem])
      setIsCreateDialogOpen(false)
      setFormData({
        code: "",
        name: "",
        rate: 0,
        account: 4100,
        taxRate: "Standard Rate Sales",
      })
      toast({
        title: "Service Item Created Successfully!",
        description: `"${newItem.name}" has been added with rate R${newItem.rate.toLocaleString()} and is now available for timesheet entries.`,
      })
    } catch (error) {
      console.error("Error creating service item:", error)
      toast({
        title: "Failed to Create Service Item",
        description: "Unable to save the service item. Please check all fields are filled correctly and try again.",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (item: ServiceItem) => {
    setEditingItem(item)
    setFormData({
      code: item.code,
      name: item.name,
      rate: item.rate,
      account: item.account,
      taxRate: item.taxRate,
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingItem) return

    try {
      const updates: Partial<ServiceItemRaw> = {
        xero_sales_description: formData.name,
        sales_unit_price: formData.rate.toString(),
        sales_account: formData.account,
        sales_tax_rate: formData.taxRate,
      }

      const updatedItemRaw = await updateServiceItem(editingItem.code, updates)

      // Transform the returned raw data to application format
      const updatedItem: ServiceItem = {
        code: updatedItemRaw.xero_item_code,
        name: updatedItemRaw.xero_sales_description,
        rate: Number.parseFloat(updatedItemRaw.sales_unit_price) || 0,
        account: updatedItemRaw.sales_account,
        taxRate: updatedItemRaw.sales_tax_rate,
      }

      setServiceItems(serviceItems.map((item) => (item.code === editingItem.code ? updatedItem : item)))
      setIsEditDialogOpen(false)
      setEditingItem(null)
      toast({
        title: "Service Item Updated Successfully!",
        description: `"${updatedItem.name}" has been updated with the new rate of R${updatedItem.rate.toLocaleString()}.`,
      })
    } catch (error) {
      console.error("Error updating service item:", error)
      toast({
        title: "Failed to Update Service Item",
        description: "Unable to save changes to the service item. Please verify your changes and try again.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm("Are you sure you want to delete this service item?")) return

    try {
      await deleteServiceItem(code)
      const deletedItem = serviceItems.find((item) => item.code === code)
      setServiceItems(serviceItems.filter((item) => item.code !== code))
      toast({
        title: "Service Item Deleted Successfully!",
        description: `"${deletedItem?.name || code}" has been removed from the system.`,
      })
    } catch (error) {
      console.error("Error deleting service item:", error)
      toast({
        title: "Failed to Delete Service Item",
        description: "Unable to delete the service item. It may be in use by existing timesheet entries.",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      rate: 0,
      account: 4100,
      taxRate: "Standard Rate Sales",
    })
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="container mx-auto p-6 space-y-8 max-w-7xl">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent">
                Service Items Management
              </h1>
              <p className="text-slate-600 text-lg">Manage service items and their pricing for timesheet entries.</p>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-slate-800 flex items-center">Service Items</CardTitle>
                <CardDescription>Manage accounting service items and their standard rates</CardDescription>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Service Item</DialogTitle>
                    <DialogDescription>
                      Add a new service item to the system. The item code will be auto-generated if not provided.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="code" className="text-right">
                        Item Code
                      </Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Auto-generated if empty"
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">
                        Description *
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Service description"
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="rate" className="text-right">
                        Unit Price (R)
                      </Label>
                      <Input
                        id="rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.rate}
                        onChange={(e) => setFormData({ ...formData, rate: Number.parseFloat(e.target.value) || 0 })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="account" className="text-right">
                        Account Code
                      </Label>
                      <Input
                        id="account"
                        type="number"
                        value={formData.account}
                        onChange={(e) => setFormData({ ...formData, account: Number.parseInt(e.target.value) || 4100 })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="taxRate" className="text-right">
                        Tax Rate
                      </Label>
                      <Select
                        value={formData.taxRate}
                        onValueChange={(value) => setFormData({ ...formData, taxRate: value })}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Standard Rate Sales">Standard Rate Sales</SelectItem>
                          <SelectItem value="Standard Rate Purchases">Standard Rate Purchases</SelectItem>
                          <SelectItem value="Zero Rate">Zero Rate</SelectItem>
                          <SelectItem value="Exempt">Exempt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false)
                        resetForm()
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={!formData.name.trim()}>
                      Create Service Item
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-slate-500">Loading service items...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Item Code</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Description</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Unit Price</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Account</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Tax Rate</TableHead>
                      <TableHead className="text-slate-700 font-semibold w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center space-y-3 text-slate-500">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                              <Settings className="h-8 w-8 text-slate-400" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">No service items found</p>
                              <p className="text-sm">Create your first service item to get started</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      serviceItems.map((item, index) => (
                        <TableRow
                          key={item.code}
                          className={`border-slate-100 hover:bg-slate-50/50 ${index % 2 === 0 ? "bg-white" : "bg-slate-25"}`}
                        >
                          <TableCell className="font-mono text-sm text-slate-700">{item.code}</TableCell>
                          <TableCell className="text-slate-700 max-w-xs">{item.name}</TableCell>
                          <TableCell className="text-slate-700 font-medium">R {item.rate.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-700">{item.account}</TableCell>
                          <TableCell className="text-slate-700">{item.taxRate}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(item.code)}
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Service Item</DialogTitle>
              <DialogDescription>Update the service item details. The item code cannot be changed.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-code" className="text-right">
                  Item Code
                </Label>
                <Input id="edit-code" value={formData.code} disabled className="col-span-3 bg-slate-100" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Description *
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Service description"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-rate" className="text-right">
                  Unit Price (R)
                </Label>
                <Input
                  id="edit-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: Number.parseFloat(e.target.value) || 0 })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-account" className="text-right">
                  Account Code
                </Label>
                <Input
                  id="edit-account"
                  type="number"
                  value={formData.account}
                  onChange={(e) => setFormData({ ...formData, account: Number.parseInt(e.target.value) || 4100 })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-taxRate" className="text-right">
                  Tax Rate
                </Label>
                <Select
                  value={formData.taxRate}
                  onValueChange={(value) => setFormData({ ...formData, taxRate: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard Rate Sales">Standard Rate Sales</SelectItem>
                    <SelectItem value="Standard Rate Purchases">Standard Rate Purchases</SelectItem>
                    <SelectItem value="Zero Rate">Zero Rate</SelectItem>
                    <SelectItem value="Exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingItem(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={!formData.name.trim()}>
                Update Service Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
