/** Shorten very long hostnames (cloud RDS ids) while keeping both ends readable. */
export function shortHost(host: string, max = 34): string {
  if (host.length <= max) return host
  const tail = Math.ceil(max * 0.55)
  return `${host.slice(0, max - tail - 1)}…${host.slice(-tail)}`
}

/** "customer_uat · ae45050d…rds.myhuaweicloud.com:5432" */
export function databaseSummary(v: Record<string, string>): string {
  const host = v.host ? `${shortHost(v.host)}${v.port ? `:${v.port}` : ''}` : ''
  return [v.database, host].filter(Boolean).join(' · ')
}

export interface DbEngine {
  label: string
  short: string
  color: string
  guessed: boolean
}

const ENGINES: [RegExp, string, string, string][] = [
  [/postgres|pgsql|\bpg\b/i, 'PostgreSQL', 'PG', '#6aa1e8'],
  [/oracle/i, 'Oracle', 'ORA', '#ff5a4f'],
  [/mariadb/i, 'MariaDB', 'MDB', '#c9a27a'],
  [/mysql/i, 'MySQL', 'MY', '#f29b2a'],
  [/sql ?server|mssql|sqlserver/i, 'SQL Server', 'MS', '#c084fc'],
  [/mongo/i, 'MongoDB', 'MGO', '#4fbf5b'],
  [/redis/i, 'Redis', 'RDS', '#ef4d3f'],
  [/sqlite/i, 'SQLite', 'LITE', '#5ea4d6'],
  [/db2/i, 'DB2', 'DB2', '#5b8def'],
  [/redshift/i, 'Redshift', 'RS', '#9a6bff'],
  [/snowflake/i, 'Snowflake', 'SF', '#29b5e8'],
]

const PORTS: Record<string, string> = { '5432': 'PostgreSQL', '1521': 'Oracle', '3306': 'MySQL', '1433': 'SQL Server', '27017': 'MongoDB', '6379': 'Redis' }

/** Database engine from the "ชนิด" field, the connection string, or (as a guess) the port. */
export function dbEngine(v: Record<string, string>): DbEngine | null {
  const find = (text: string) => ENGINES.find(([re]) => re.test(text))
  let hit = (v.dbType && find(v.dbType)) || (v.connectionString && find(v.connectionString))
  let guessed = false
  if (!hit && v.dbType) return { label: v.dbType, short: v.dbType.slice(0, 3).toUpperCase(), color: '#94a3b8', guessed: false }
  if (!hit && v.port && PORTS[v.port]) {
    hit = find(PORTS[v.port])
    guessed = true
  }
  return hit ? { label: hit[1], short: hit[2], color: hit[3], guessed } : null
}
