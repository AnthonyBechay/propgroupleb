import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Append pool-safety params to DATABASE_URL when missing.
 * - connection_limit: cap per-process pool (frontend + backend share one Postgres)
 * - connect_timeout: fail fast if all pool slots are busy (seconds)
 * - pool_timeout: how long to wait for a free connection from the pool (seconds)
 * - statement_timeout: auto-kill queries that run longer than this (ms)
 */
function buildDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  const sep = raw.includes('?') ? '&' : '?'
  const extras: string[] = []
  if (!raw.includes('connection_limit')) extras.push('connection_limit=5')
  if (!raw.includes('connect_timeout')) extras.push('connect_timeout=10')
  if (!raw.includes('pool_timeout')) extras.push('pool_timeout=10')
  if (!raw.includes('statement_timeout')) extras.push('statement_timeout=15000')
  return extras.length > 0 ? `${raw}${sep}${extras.join('&')}` : raw
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    datasourceUrl: buildDatasourceUrl(),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Export both named and default exports
export { PrismaClient }
export default prisma

// Re-export all Prisma types and enums
export * from '@prisma/client'
