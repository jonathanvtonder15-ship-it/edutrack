exports.SESSION_COOKIE = 'edutrack_session'
exports.checkRequestOrigin = () => null
exports.getAuthenticatedSupabase = async () => {
  if (process.env.LOGOUT_TEST_FAILURE === 'setup') throw new Error('Provider configuration unavailable')
  return { auth: { signOut: async () => {
    if (process.env.LOGOUT_TEST_FAILURE === 'network') throw new Error('Network unavailable')
    return { error: process.env.LOGOUT_TEST_FAILURE === 'returned' ? new Error('Provider rejected logout') : null }
  } } }
}
