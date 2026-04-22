import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendWhatsAppOTP } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { phone, role, businessId } = await req.json()

    if (!phone || !role) {
      return NextResponse.json({ error: 'Phone and role required' }, { status: 400 })
    }

    const cleaned = phone.replace(/\D/g, '').slice(-10)
    if (cleaned.length !== 10) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 })
    }

    // For customer role, business must exist
    let businessName: string | undefined
    if (role === 'customer' && businessId) {
      const biz = db.findBusinessById(businessId)
      if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      businessName = biz.name
    }

    const session = db.createOtp(cleaned, role, businessId)
    const sent = await sendWhatsAppOTP(cleaned, session.otp, businessName)

    return NextResponse.json({
      success: true,
      message: sent
        ? `OTP sent to WhatsApp +91${cleaned}`
        : `OTP: ${session.otp} (dev mode — WhatsApp not configured)`,
      devOtp: process.env.NODE_ENV === 'development' ? session.otp : undefined
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 })
  }
}
