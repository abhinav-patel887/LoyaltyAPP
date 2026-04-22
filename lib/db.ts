import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const DB_PATH = path.join(process.cwd(), 'data.json')

export interface Business {
  id: string
  name: string
  phone: string
  address?: string
  city?: string
  stampGoal: number
  minAmount: number
  rewardText: string
  createdAt: string
}

export interface Customer {
  id: string
  phone: string
  name?: string
  businessId: string
  stamps: number
  totalVisits: number
  redeemed: number
  totalSaved: number
  createdAt: string
  lastVisit?: string
}

export interface StampRequest {
  id: string
  businessId: string
  customerId: string
  customerPhone: string
  customerName?: string
  status: 'pending' | 'approved' | 'rejected'
  billAmount?: number
  createdAt: string
  resolvedAt?: string
}

export interface OtpSession {
  id: string
  phone: string
  otp: string
  role: 'business' | 'customer'
  businessId?: string
  verified: boolean
  expiresAt: string
  createdAt: string
}

interface DB {
  businesses: Business[]
  customers: Customer[]
  stampRequests: StampRequest[]
  otpSessions: OtpSession[]
}

function readDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    const empty: DB = { businesses: [], customers: [], stampRequests: [], otpSessions: [] }
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2))
    return empty
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

function writeDB(data: DB) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

// ── Business ──────────────────────────────────────────────
export const db = {
  // Businesses
  createBusiness(data: Omit<Business, 'id' | 'createdAt'>): Business {
    const d = readDB()
    const b: Business = { ...data, id: uuidv4(), createdAt: new Date().toISOString() }
    d.businesses.push(b)
    writeDB(d)
    return b
  },
  findBusinessByPhone(phone: string): Business | undefined {
    return readDB().businesses.find(b => b.phone === phone)
  },
  findBusinessById(id: string): Business | undefined {
    return readDB().businesses.find(b => b.id === id)
  },
  updateBusiness(id: string, data: Partial<Business>): Business | undefined {
    const d = readDB()
    const idx = d.businesses.findIndex(b => b.id === id)
    if (idx === -1) return undefined
    d.businesses[idx] = { ...d.businesses[idx], ...data }
    writeDB(d)
    return d.businesses[idx]
  },

  // Customers
  findOrCreateCustomer(phone: string, businessId: string, name?: string): Customer {
    const d = readDB()
    let c = d.customers.find(c => c.phone === phone && c.businessId === businessId)
    if (!c) {
      c = { id: uuidv4(), phone, name, businessId, stamps: 0, totalVisits: 0, redeemed: 0, totalSaved: 0, createdAt: new Date().toISOString() }
      d.customers.push(c)
      writeDB(d)
    }
    return c
  },
  findCustomerByPhone(phone: string, businessId: string): Customer | undefined {
    return readDB().customers.find(c => c.phone === phone && c.businessId === businessId)
  },
  findCustomerById(id: string): Customer | undefined {
    return readDB().customers.find(c => c.id === id)
  },
  getBusinessCustomers(businessId: string): Customer[] {
    return readDB().customers.filter(c => c.businessId === businessId)
      .sort((a, b) => new Date(b.lastVisit || b.createdAt).getTime() - new Date(a.lastVisit || a.createdAt).getTime())
  },
  updateCustomer(id: string, data: Partial<Customer>): Customer | undefined {
    const d = readDB()
    const idx = d.customers.findIndex(c => c.id === id)
    if (idx === -1) return undefined
    d.customers[idx] = { ...d.customers[idx], ...data }
    writeDB(d)
    return d.customers[idx]
  },

  // Stamp Requests
  createStampRequest(data: Omit<StampRequest, 'id' | 'createdAt'>): StampRequest {
    const d = readDB()
    // Cancel any existing pending for this customer
    d.stampRequests = d.stampRequests.map(r =>
      r.customerId === data.customerId && r.status === 'pending'
        ? { ...r, status: 'rejected' as const, resolvedAt: new Date().toISOString() }
        : r
    )
    const r: StampRequest = { ...data, id: uuidv4(), createdAt: new Date().toISOString() }
    d.stampRequests.push(r)
    writeDB(d)
    return r
  },
  getPendingRequests(businessId: string): StampRequest[] {
    return readDB().stampRequests.filter(r => r.businessId === businessId && r.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },
  resolveStampRequest(id: string, status: 'approved' | 'rejected', billAmount?: number): StampRequest | undefined {
    const d = readDB()
    const idx = d.stampRequests.findIndex(r => r.id === id)
    if (idx === -1) return undefined
    d.stampRequests[idx] = { ...d.stampRequests[idx], status, billAmount, resolvedAt: new Date().toISOString() }
    writeDB(d)
    return d.stampRequests[idx]
  },
  getRecentActivity(businessId: string, limit = 20): StampRequest[] {
    return readDB().stampRequests
      .filter(r => r.businessId === businessId && r.status !== 'pending')
      .sort((a, b) => new Date(b.resolvedAt || b.createdAt).getTime() - new Date(a.resolvedAt || a.createdAt).getTime())
      .slice(0, limit)
  },
  findPendingRequest(customerId: string): StampRequest | undefined {
    return readDB().stampRequests.find(r => r.customerId === customerId && r.status === 'pending')
  },

  // Customer history for a specific business
  getCustomerHistory(customerId: string, limit = 30): StampRequest[] {
    return readDB().stampRequests
      .filter(r => r.customerId === customerId && r.status !== 'pending')
      .sort((a, b) => new Date(b.resolvedAt || b.createdAt).getTime() - new Date(a.resolvedAt || a.createdAt).getTime())
      .slice(0, limit)
  },

  // All businesses a phone number has visited
  getCustomerAllBusinesses(phone: string): Array<Customer & { business: Business | undefined }> {
    const d = readDB()
    return d.customers
      .filter(c => c.phone === phone)
      .map(c => ({ ...c, business: d.businesses.find(b => b.id === c.businessId) }))
      .sort((a, b) => new Date(b.lastVisit || b.createdAt).getTime() - new Date(a.lastVisit || a.createdAt).getTime())
  },

  // Total rupees saved by a customer at a specific business
  getTotalSaved(customerId: string): number {
    const d = readDB()
    const customer = d.customers.find(c => c.id === customerId)
    if (!customer) return 0
    return customer.totalSaved || 0
  },

  // OTP
  createOtp(phone: string, role: 'business' | 'customer', businessId?: string): OtpSession {
    const d = readDB()
    d.otpSessions = d.otpSessions.filter(o => !(o.phone === phone && o.role === role))
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const session: OtpSession = {
      id: uuidv4(), phone, otp, role, businessId,
      verified: false,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    }
    d.otpSessions.push(session)
    writeDB(d)
    return session
  },
  verifyOtp(phone: string, otp: string, role: 'business' | 'customer'): OtpSession | null {
    const d = readDB()
    const s = d.otpSessions.find(o => o.phone === phone && o.otp === otp && o.role === role && !o.verified && new Date(o.expiresAt) > new Date())
    if (!s) return null
    const idx = d.otpSessions.findIndex(o => o.id === s.id)
    d.otpSessions[idx].verified = true
    writeDB(d)
    return s
  },

  // Stats
  getBusinessStats(businessId: string) {
    const d = readDB()
    const customers = d.customers.filter(c => c.businessId === businessId)
    const today = new Date().toDateString()
    const todayScans = d.stampRequests.filter(r =>
      r.businessId === businessId && r.status === 'approved' &&
      new Date(r.resolvedAt || '').toDateString() === today
    ).length
    const totalRewards = customers.reduce((sum, c) => sum + c.redeemed, 0)
    const returning = customers.filter(c => c.totalVisits > 1).length
    return {
      totalCustomers: customers.length,
      todayScans,
      totalRewards,
      returningRate: customers.length > 0 ? Math.round((returning / customers.length) * 100) : 0
    }
  }
}
