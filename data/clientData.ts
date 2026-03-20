import type { ClientInfo } from "../types/invoice"

export const clientsInfo: ClientInfo[] = [
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

// This file is no longer needed as client data is now managed by lib/client-storage.ts
// and initial clients are defined there.
// You can safely delete this file if it's not used elsewhere.
