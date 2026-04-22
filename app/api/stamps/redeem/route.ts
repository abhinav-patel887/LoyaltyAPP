import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = verifyToken(auth.replace('Bearer ', ''))
  if (!token || token.role !== 'business') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId, savedAmount } = await req.json()
  const customer = db.findCustomerById(customerId)
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const business = db.findBusinessById(customer.businessId)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  if (customer.stamps < business.stampGoal) {
    return NextResponse.json({ error: 'Not enough stamps' }, { status: 400 })
  }

  db.updateCustomer(customer.id, {
    stamps: 0,
    redeemed: customer.redeemed + 1,
    totalSaved: (customer.totalSaved || 0) + Number(savedAmount || 0),
    lastVisit: new Date().toISOString()
  })

  await sendWhatsAppMessage(customer.phone,
    `✨ Your reward "*${business.rewardText}*" has been redeemed at *${business.name}*! Start collecting stamps again — your next reward is waiting. See you soon! 🙏`)

  return NextResponse.json({ success: true })
}
