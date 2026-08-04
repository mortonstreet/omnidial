import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { config } from '@/config'
import logger from '@/lib/logger'

// Use Resend API if API key is available (production or development with key)
// Fall back to MailHog (local SMTP) only if no Resend API key
export const useResendApi =
  !!config.resend.apiKey && config.resend.apiKey !== 'RESEND_API_KEY'

// Resend SDK client for API-based sending (preferred in production)
export const resendClient = useResendApi
  ? new Resend(config.resend.apiKey)
  : null

// Nodemailer transporter for local development (MailHog)
const transportOptions: SMTPTransport.Options = {
  host: 'localhost',
  port: 1025,
  secure: false,
}

export const transporter = nodemailer.createTransport(transportOptions)

// Log which email method is being used on startup
logger.info(
  `Email configuration: ${useResendApi ? 'Resend API' : 'Local MailHog (SMTP)'}`,
)
