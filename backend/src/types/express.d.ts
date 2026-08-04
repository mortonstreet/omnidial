declare global {
  namespace Express {
    interface Request {
      validated?: any
      organizationId?: string
      userId?: string
    }
  }
}

export {}
