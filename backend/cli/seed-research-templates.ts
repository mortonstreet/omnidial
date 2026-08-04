import { seedSystemTemplates } from '../src/services/researchTemplate.service'

async function main() {
  console.log('Seeding research templates...')

  try {
    const created = await seedSystemTemplates()
    console.log(`✅ Created ${created} system templates`)
  } catch (error) {
    console.error('Error seeding templates:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
