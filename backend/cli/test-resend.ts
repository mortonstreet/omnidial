import { config } from '../src/config'
import { Resend } from 'resend'

async function testResend() {
  const apiKey = config.resend.apiKey
  if (!apiKey || apiKey === 'replace-me') {
    console.error('RESEND_API_KEY not set')
    process.exit(1)
  }

  const resend = new Resend(apiKey)
  console.log('API key present:', apiKey.slice(0, 8) + '...')

  // 1. List verified domains
  console.log('\n--- Verified Domains ---')
  try {
    const { data: domains, error } = await resend.domains.list()
    if (error) {
      console.error('Failed to list domains:', error)
    } else if (domains?.data) {
      for (const d of domains.data) {
        console.log(`  ${d.name} — status: ${d.status}, region: ${d.region}`)
      }
      const hasOmnidial = domains.data.some(
        (d) => d.name === 'omnidial.io' && d.status === 'verified',
      )
      console.log(
        hasOmnidial
          ? '\n  ✓ omnidial.io is verified'
          : '\n  ✗ omnidial.io is NOT verified — magic link emails will fail',
      )
    } else {
      console.log('  No domains found')
    }
  } catch (err) {
    console.error('Domain list error:', err)
  }

  // 2. Try sending a test email
  console.log('\n--- Test Email Send ---')
  const fromAddress =
    config.resend.fromAddress || 'OmniDial <noreply@omnidial.io>'
  console.log('From:', fromAddress)
  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: 'delivered@resend.dev', // Resend's test sink
      subject: 'OmniDial Email Test',
      text: 'Testing email delivery from OmniDial backend.',
    })
    if (error) {
      console.error('Send FAILED:', JSON.stringify(error, null, 2))
    } else {
      console.log('Send OK — id:', data?.id)
    }
  } catch (err) {
    console.error('Send threw:', err)
  }

  process.exit(0)
}

testResend().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
