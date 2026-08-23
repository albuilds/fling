import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Next.js evaluates route modules during production builds, before runtime
// secrets are available. This fallback is deliberately unreachable and lets
// those imports complete without silently connecting to another database.
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://fling-build:fling-build@127.0.0.1:1/fling-build";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
