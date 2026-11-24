export const ENVIRONMENTS = ['DEV', 'SIT', 'UAT', 'PRE-PROD', 'PROD']

/** css-safe slug, e.g. PRE-PROD -> preprod */
export const envSlug = (env: string) => env.toLowerCase().replace(/[^a-z0-9]/g, '')
