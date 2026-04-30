export const TOKEN_KEY = 'hkbk_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = t => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export async function api(url, method = 'GET', body = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } }
    const token = getToken()
    if (token) opts.headers['x-auth-token'] = token
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(url, opts)
    return await res.json()
  } catch (e) {
    return { error: e.message }
  }
}
