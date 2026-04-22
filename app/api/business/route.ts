import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

function getBizFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return null
  const token = verifyToken(auth.replace('Bearer ', ''))
  if (!token || token.role !== 'business') return null
  return token
}

export async function GET(req: NextRequest) {
  // Public lookup by ?id= (used by customer scan page to show business name early)
  const publicId = req.nextUrl.searchParams.get('id')
  if (publicId) {
    const business = db.findBusinessById(publicId)
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Only return safe public fields
    return NextResponse.json({ business: { id: business.id, name: business.name, address: business.address, stampGoal: business.stampGoal, rewardText: business.rewardText } })
  }

  // Authenticated business dashboard lookup
  const t = getBizFromToken(req)
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = db.findBusinessById(t.businessId)
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const stats = db.getBusinessStats(t.businessId)
  const customers = db.getBusinessCustomers(t.businessId)
  const pending = db.getPendingRequests(t.businessId)
  const activity = db.getRecentActivity(t.businessId)

  return NextResponse.json({ business, stats, customers, pending, activity })
}


export async function PATCH(req: NextRequest) {
  const t = getBizFromToken(req)
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const allowed = ['name', 'address', 'city', 'stampGoal', 'minAmount', 'rewardText']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key]
  }

  const business = db.updateBusiness(t.businessId, update)
  return NextResponse.json({ business })
}
