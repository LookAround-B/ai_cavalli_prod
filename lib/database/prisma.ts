import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,               // remote DB — keep pool small
    min: 0,               // don't pre-open connections (avoids HMR exhaustion)
    idleTimeoutMillis: 120_000,      // keep connections alive 2 min
    connectionTimeoutMillis: 15_000, // 15s for remote host
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  })

  pool.on('error', (err) => {
    console.error('[DB Pool] Unexpected client error:', err)
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
