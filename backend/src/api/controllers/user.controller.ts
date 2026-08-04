import {
  findAccountByUserId,
  updateUserOnboarding,
  getOnboardingStatus,
} from '@/repositories/user.repository'
import { AuthRequestHandler } from '@/types/handlers'
import { CompleteOnboardingRequest } from '@shared/types/src/requests/user'

export const getUser: AuthRequestHandler<{}> = async (req, res) => {
  const user = req.user
  res.json(user)
}

export const getAccount: AuthRequestHandler<{}> = async (req, res) => {
  const account = await findAccountByUserId(req.user.id)
  res.json(account)
}

export const completeOnboarding: AuthRequestHandler<{}> = async (req, res) => {
  const { name, role, industry } = req.body as CompleteOnboardingRequest

  if (!role || !industry) {
    return res.status(400).json({ error: 'Role and industry are required' })
  }

  await updateUserOnboarding(req.user.id, {
    ...(name ? { name } : {}),
    onboardingRole: role,
    onboardingIndustry: industry,
    onboardingComplete: true,
  })

  res.json({ success: true })
}

export const getOnboardingStatusHandler: AuthRequestHandler<{}> = async (
  req,
  res,
) => {
  const status = await getOnboardingStatus(req.user.id)
  res.json({ onboardingComplete: status?.onboardingComplete ?? false })
}
