import type { Response } from 'express';
import type { PaginationResponse } from '../types/index.js';

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendCreated<T>(res: Response, data: T, message?: string) {
  sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  data: T,
  pagination: PaginationResponse,
  message?: string
) {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
}

export function sendError(res: Response, statusCode: number, message: string, details?: unknown) {
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Error',
    message,
    ...(details ? { details } : {}),
  });
}

export function sendNotFound(res: Response, resource = 'Resource') {
  sendError(res, 404, `${resource} not found`);
}
