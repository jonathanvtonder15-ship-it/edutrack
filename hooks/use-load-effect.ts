'use client'
import { useEffect } from 'react'

// Defer loading until after commit and cancel work queued by an obsolete render.
export function useLoadEffect(load: () => void | Promise<void>) {
  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timer)
  }, [load])
}
