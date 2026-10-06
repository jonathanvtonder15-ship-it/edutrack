import { registerHooks } from 'node:module'

// Only substitute external dependencies; exercise the actual route's error/cookie handling.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/supabase-auth' || specifier === '@/lib/session') {
      return nextResolve(new URL('./logout-provider.cjs', import.meta.url).href, context)
    }
    return nextResolve(specifier, context)
  },
})
