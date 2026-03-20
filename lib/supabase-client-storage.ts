import { supabase } from "./supabase"
import type { ClientInfo } from "../types/invoice"
import { v4 as uuidv4 } from "uuid"

interface BillToClient {
  id: number
  bill_to_client: string
}

interface ClientWithBillTo extends ClientInfo {
  id?: string
  created_at?: string
  bill_to?: string // Changed from number to string to store client name directly
  bill_to_client_name?: string
}

/**
 * Retrieves all clients from the Supabase anchor_clients table
 */
export async function getSupabaseClients(): Promise<ClientWithBillTo[]> {
  try {
    const { data, error } = await supabase
      .from("anchor_clients")
      .select("*") // Simplified select since we're no longer joining with bill_to_clients table
      .order("client_name", { ascending: true })

    if (error) {
      console.error("Error fetching clients:", error)
      return []
    }

    // Transform Supabase data to ClientInfo format
    return data.map((client) => ({
      id: client.id,
      name: client.client_name,
      address: client.address || "",
      email: client.email || "",
      phone: client.phone || undefined,
      created_at: client.created_at,
      bill_to: client.bill_to, // Now stores client name directly
    }))
  } catch (error) {
    console.error("Failed to retrieve clients from Supabase:", error)
    return []
  }
}

/**
 * Adds a new client to the Supabase anchor_clients table
 */
export async function addClientToSupabase(newClient: ClientInfo & { bill_to?: string }): Promise<string> {
  // Changed bill_to type to string
  try {
    // Check if client already exists
    const { data: existingClient } = await supabase
      .from("anchor_clients")
      .select("client_name")
      .eq("client_name", newClient.name)
      .single()

    if (existingClient) {
      throw new Error("Client with this name already exists")
    }

    const clientId = uuidv4()

    // Insert new client
    const { error } = await supabase.from("anchor_clients").insert([
      {
        id: clientId,
        client_name: newClient.name,
        address: newClient.address,
        email: newClient.email,
        phone: newClient.phone || null,
        bill_to: newClient.bill_to || null, // Now stores client name directly
        created_at: new Date().toISOString(),
      },
    ])

    if (error) {
      console.error("Error adding client to Supabase:", error)
      throw error
    }

    return clientId
  } catch (error) {
    console.error("Failed to save client to Supabase:", error)
    throw error
  }
}

/**
 * Updates an existing client in the Supabase anchor_clients table
 */
export async function updateClientInSupabase(originalName: string, updatedClient: ClientWithBillTo): Promise<boolean> {
  try {
    // If name is changing, check if new name already exists
    if (originalName !== updatedClient.name) {
      const { data: existingClient } = await supabase
        .from("anchor_clients")
        .select("client_name")
        .eq("client_name", updatedClient.name)
        .single()

      if (existingClient) {
        throw new Error("Client with this name already exists")
      }
    }

    const { error } = await supabase
      .from("anchor_clients")
      .update({
        client_name: updatedClient.name,
        address: updatedClient.address,
        email: updatedClient.email,
        phone: updatedClient.phone || null,
        bill_to: updatedClient.bill_to || null, // Now stores client name directly
      })
      .eq("client_name", originalName)

    if (error) {
      console.error("Error updating client in Supabase:", error)
      throw error
    }

    return true
  } catch (error) {
    console.error("Failed to update client in Supabase:", error)
    throw error
  }
}

/**
 * Deletes a client from the Supabase anchor_clients table
 */
export async function deleteClientFromSupabase(clientName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("anchor_clients").delete().eq("client_name", clientName)

    if (error) {
      console.error("Error deleting client from Supabase:", error)
      throw error
    }

    return true
  } catch (error) {
    console.error("Failed to delete client from Supabase:", error)
    throw error
  }
}
