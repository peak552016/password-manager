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
