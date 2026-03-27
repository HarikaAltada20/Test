/**
 * Logged-in users are redirected from `/` to their dashboard unless this query
 * param is set (see middleware). Use {@link MARKETING_HOME_AS_GUEST} in links.
 */
export const MARKETING_HOME_GUEST_PARAM = 'guest'

/** Public landing page URL that does not trigger the logged-in home redirect. */
export const MARKETING_HOME_AS_GUEST = `/?${MARKETING_HOME_GUEST_PARAM}=1` as const

export function shouldAllowLoggedInMarketingHome(
  searchParams: URLSearchParams
): boolean {
  const v = searchParams.get(MARKETING_HOME_GUEST_PARAM)
  if (v === null) return false
  if (v === '') return true
  return v === '1' || v.toLowerCase() === 'true'
}
