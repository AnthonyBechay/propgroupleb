import type { Request, Response, NextFunction } from 'express';

// User type matching Prisma select in auth middleware
export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'AGENT';
  isActive: boolean;
  bannedAt: Date | null;
  emailVerifiedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  investmentGoals: string[];
  membershipTier: string;
  membershipStartDate: Date | null;
  membershipEndDate: Date | null;
  agentCommissionRate?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Extended Express Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

// Type for route handlers that may or may not have auth
export type MaybeAuthRequest = Request & { user?: AuthUser };

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Standard API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: PaginationResponse;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

// Express handler types
export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;
