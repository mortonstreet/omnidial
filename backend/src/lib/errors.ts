import { StatusCodes } from 'http-status-codes'

/**
 * HTTP Error class for throwing errors with proper status codes
 */
export class HttpError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number = StatusCodes.BAD_REQUEST) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(message, StatusCodes.BAD_REQUEST)
    this.name = 'BadRequestError'
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends HttpError {
  constructor(message: string = 'Unauthorized') {
    super(message, StatusCodes.UNAUTHORIZED)
    this.name = 'UnauthorizedError'
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends HttpError {
  constructor(message: string = 'Forbidden') {
    super(message, StatusCodes.FORBIDDEN)
    this.name = 'ForbiddenError'
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends HttpError {
  constructor(message: string = 'Not found') {
    super(message, StatusCodes.NOT_FOUND)
    this.name = 'NotFoundError'
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends HttpError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT)
    this.name = 'ConflictError'
  }
}

/**
 * 422 Unprocessable Entity
 */
export class UnprocessableError extends HttpError {
  constructor(message: string) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY)
    this.name = 'UnprocessableError'
  }
}
