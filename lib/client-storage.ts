import type { ClientInfo } from "../types/invoice"

const LOCAL_STORAGE_KEY = "v0_clients"

// Initial set of clients
const initialClientsInfo: ClientInfo[] = [
  {
    name: "PCG",
    address: "123 Business Park\nCape Town, 8001\nSouth Africa",
    email: "accounts@pcg.co.za",
    phone: "+27 21 123 4567",
  },
  {
    name: "TechCorp Ltd",
    address: "456 Innovation Drive\nJohannesburg, 2000\nSouth Africa",
    email: "billing@techcorp.co.za",
    phone: "+27 11 987 6543",
  },
  {
    name: "StartupXYZ",
    address: "789 Startup Street\nDurban, 4000\nSouth Africa",
    email: "finance@startupxyz.co.za",
    phone: "+27 31 555 0123",
  },
  {
    name: "RetailPlus",
    address: "321 Retail Road\nPretoria, 0001\nSouth Africa",
    email: "payments@retailplus.co.za",
    phone: "+27 12 444 5678",
  },
  {
    name: "Manufacturing Co",
    address: "654 Industrial Ave\nPort Elizabeth, 6000\nSouth Africa",
    email: "accounts@manufacturing.co.za",
    phone: "+27 41 333 9876",
  },
  {
    name: "ConsultingFirm",
    address: "987 Professional Plaza\nBloemfontein, 9300\nSouth Africa",
    email: "billing@consultingfirm.co.za",
    phone: "+27 51 222 1234",
  },
]

/**
 * Retrieves all clients, merging initial clients with those stored in local storage.
 * @returns An array of ClientInfo objects.
 */
export function getStoredClients(): ClientInfo[] {
  if (typeof window === "undefined") {
    return initialClientsInfo // Return initial clients on server-side
  }
  try {
    const storedClientsJson = localStorage.getItem(LOCAL_STORAGE_KEY)
    const storedClients: ClientInfo[] = storedClientsJson ? JSON.parse(storedClientsJson) : []

    // Merge initial clients with stored clients, prioritizing stored clients if names conflict
    const mergedClientsMap = new Map<string, ClientInfo>()
    initialClientsInfo.forEach((client) => mergedClientsMap.set(client.name, client))
    storedClients.forEach((client) => mergedClientsMap.set(client.name, client))

    return Array.from(mergedClientsMap.values())
  } catch (error) {
    console.error("Failed to retrieve clients from local storage:", error)
    return initialClientsInfo // Fallback to initial clients on error
  }
}

/**
 * Adds a new client to local storage.
 * @param newClient The ClientInfo object to add.
 */
export function addClientToStorage(newClient: ClientInfo): void {
  if (typeof window === "undefined") {
    return // Do nothing on server-side
  }
  try {
    const currentClients = getStoredClients()
    // Ensure no duplicate names, update if exists
    const updatedClients = currentClients.filter((client) => client.name !== newClient.name)
    updatedClients.push(newClient)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedClients))
  } catch (error) {
    console.error("Failed to save client to local storage:", error)
  }
}

/**
 * Clears all stored clients from local storage (for development/testing).
 */
export function clearStoredClients(): void {
  if (typeof window === "undefined") {
    return // Do nothing on server-side
  }
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    console.log("All clients cleared from local storage.")
  } catch (error) {
    console.error("Failed to clear clients from local storage:", error)
  }
}
