import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { env } from './env.js'

const accessToken = env.MP_ACCESS_TOKEN || 'TEST-placeholder'

export const mpClient = new MercadoPagoConfig({
  accessToken,
  options: { timeout: 5000 },
})

export const mpPreferenceClient = new Preference(mpClient)
export const mpPaymentClient = new Payment(mpClient)

export const isMPConfigured = Boolean(env.MP_ACCESS_TOKEN)
