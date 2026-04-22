import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = verifyToken(auth.replace('Bearer ', ''))
  if (!token || token.role !== 'customer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId, businessId, phone } = token as { customerId: string; businessId: string; role: 'customer'; phone: string }

  const customer = db.findCustomerById(customerId)
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const business = db.findBusinessById(businessId)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const pending = db.findPendingRequest(customerId)
  const history = db.getCustomerHistory(customerId)
  const allBusinesses = db.getCustomerAllBusinesses(phone)
  const totalSaved = db.getTotalSaved(customerId)

  return NextResponse.json({ customer, business, pending, history, allBusinesses, totalSaved })
}

export async function PATCH(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = verifyToken(auth.replace('Bearer ', ''))
  if (!token || token.role !== 'customer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId } = token as { customerId: string; role: 'customer' }
  const { name } = await req.json()

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const updated = db.updateCustomer(customerId, { name: name.trim() })
  if (!updated) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  return NextResponse.json({ customer: updated })
}
