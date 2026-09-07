import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool as PgPool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * The one database client. Nothing else under `src/` imports a driver.
 *
 * On Vercel the Neon serverless driver's WebSocket `Pool` is used (transactions work;
 * the HTTP driver has none). Everywhere else, plain `pg` against the Neon `dev` branch.
 * Node 22 ships a global WebSocket, so no `ws` shim is needed.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The transaction handle `db().transaction()` passes to its callback. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let instance: Db | undefined;
let pool: { end(): Promise<void> } | undefined;

function createDb(): Db {
  const env = getEnv();
  if (env.VERCEL) {
    const neonPool = new NeonPool({ connectionString: env.DATABASE_URL });
    pool = neonPool;
    return drizzleNeon({ client: neonPool, schema });
  }
  const pgPool = new PgPool({ connectionString: env.DATABASE_URL });
  pool = pgPool;
  return drizzlePg({ client: pgPool, schema });
}

/** Lazily created so importing a query module never opens a connection by itself. */
export function db(): Db {
  instance ??= createDb();
  return instance;
}

/** Ends the pool so a CLI process (seed, reset) can exit; the app never calls this. */
export async function closeDb(): Promise<void> {
  const current = pool;
  instance = undefined;
  pool = undefined;
  await current?.end();
}
