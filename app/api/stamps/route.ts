import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Customer requests a stamp
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = verifyToken(auth.replace('Bearer ', ''))
  if (!token || token.role !== 'customer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId, businessId, phone } = token as { customerId: string; businessId: string; phone: string; role: 'customer' }

  const customer = db.findCustomerById(customerId)
  const business = db.findBusinessById(businessId)
  if (!customer || !business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if already at max stamps (reward pending)
  if (customer.stamps >= business.stampGoal) {
    return NextResponse.json({ error: 'Reward already unlocked — redeem it first!' }, { status: 400 })
  }

  const request = db.createStampRequest({
    businessId,
    customerId,
    customerPhone: phone,
    customerName: customer.name,
    status: 'pending'
  })

  return NextResponse.json({ request })
}

export async function PATCH(req: NextRequest) {
  // Cashier approves or rejects
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = verifyToken(auth.replace('Bearer ', ''))
  if (!token || token.role !== 'business') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId, action, billAmount } = await req.json()

  if (!requestId || !action) return NextResponse.json({ error: 'requestId and action required' }, { status: 400 })

  const resolved = db.resolveStampRequest(requestId, action, billAmount)
  if (!resolved) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  if (action === 'approved') {
    const business = db.findBusinessById(resolved.businessId)
    const customer = db.findCustomerById(resolved.customerId)
    if (business && customer) {
      const newStamps = customer.stamps + 1
      const newVisits = customer.totalVisits + 1
      db.updateCustomer(customer.id, {
        stamps: newStamps,
        totalVisits: newVisits,
        lastVisit: new Date().toISOString()
      })

      // Send WhatsApp notification
      const remaining = business.stampGoal - newStamps
      if (newStamps >= business.stampGoal) {
        await sendWhatsAppMessage(customer.phone,
          `🎉 Congratulations ${customer.name || 'there'}! You've unlocked your reward at *${business.name}*: *${business.rewardText}*. Show this message at the counter to redeem. Thank you for your loyalty! 🙏`)
      } else if (remaining === 1) {
        await sendWhatsAppMessage(customer.phone,
          `👋 Hey ${customer.name || 'there'}! Just *1 more visit* to unlock your reward at *${business.name}*: ${business.rewardText}. Don't miss out!`)
      } else {
        await sendWhatsAppMessage(customer.phone,
          `✅ Stamp added! You now have *${newStamps}/${business.stampGoal}* stamps at *${business.name}*. ${remaining} more visit${remaining > 1 ? 's' : ''} to earn: ${business.rewardText}`)
      }
    }
  }

  return NextResponse.json({ resolved })
}
