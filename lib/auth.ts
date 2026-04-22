import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'loyalty-dev-secret-change-in-prod'

export interface BusinessToken {
  businessId: string
  phone: string
  role: 'business'
}

export interface CustomerToken {
  customerId: string
  phone: string
  businessId: string
  role: 'customer'
}

export type AuthToken = BusinessToken | CustomerToken

export function signToken(payload: AuthToken): string {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): AuthToken | null {
  try {
    return jwt.verify(token, SECRET) as AuthToken
  } catch {
    return null
  }
}

// WhatsApp OTP via Gupshup
// In dev mode, we just log to console. In prod, swap with real Gupshup call.
export async function sendWhatsAppOTP(phone: string, otp: string, businessName?: string): Promise<boolean> {
  const message = businessName
    ? `Your OTP for ${businessName} Loyalty is *${otp}*. Valid for 10 minutes. Do not share with anyone.`
    : `Your LoyaltyApp OTP is *${otp}*. Valid for 10 minutes. Do not share with anyone.`

  // DEV MODE — log OTP to console
  if (!process.env.GUPSHUP_API_KEY) {
    console.log(`\n📱 [WhatsApp OTP to +91${phone}]: ${otp}\n`)
    console.log(`Message: ${message}\n`)
    return true
  }

  // PROD MODE — real Gupshup API call
  try {
    const res = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': process.env.GUPSHUP_API_KEY
      },
      body: new URLSearchParams({
        channel: 'whatsapp',
        source: process.env.GUPSHUP_SOURCE_NUMBER || '',
        destination: `91${phone}`,
        message: JSON.stringify({ type: 'text', text: message }),
        'src.name': process.env.GUPSHUP_APP_NAME || 'LoyaltyApp'
      })
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  if (!process.env.GUPSHUP_API_KEY) {
    console.log(`\n📱 [WhatsApp to +91${phone}]: ${message}\n`)
    return true
  }
  try {
    const res = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': process.env.GUPSHUP_API_KEY
      },
      body: new URLSearchParams({
        channel: 'whatsapp',
        source: process.env.GUPSHUP_SOURCE_NUMBER || '',
        destination: `91${phone}`,
        message: JSON.stringify({ type: 'text', text: message }),
        'src.name': process.env.GUPSHUP_APP_NAME || 'LoyaltyApp'
      })
    })
    return res.ok
  } catch {
    return false
  }
}
