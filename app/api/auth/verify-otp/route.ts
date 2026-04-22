import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, role, businessId, name } = await req.json()
    const cleaned = phone.replace(/\D/g, '').slice(-10)

    const session = db.verifyOtp(cleaned, otp, role)
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
    }

    if (role === 'business') {
      let business = db.findBusinessByPhone(cleaned)
      if (!business) {
        // New business signup
        business = db.createBusiness({
          phone: cleaned,
          name: name || 'My Business',
          stampGoal: 3,
          minAmount: 200,
          rewardText: '₹200 off your next bill'
        })
      }
      const token = signToken({ businessId: business.id, phone: cleaned, role: 'business' })
      return NextResponse.json({ token, business, isNew: !db.findBusinessByPhone(cleaned) })
    }

    if (role === 'customer' && businessId) {
      const customer = db.findOrCreateCustomer(cleaned, businessId, name)
      const token = signToken({ customerId: customer.id, phone: cleaned, businessId, role: 'customer' })
      const business = db.findBusinessById(businessId)
      return NextResponse.json({ token, customer, business })
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
