"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "framer-motion"

// framer-motion 12 stores the preference in useState on the first render.
// During SSR that render has no `window`, the stored value stays null, and
// the hook never reads the media query again. Keep a live matchMedia
// subscription so reduced motion still applies after hydration.
export function usePrefersReducedMotion(): boolean {
  const fromLibrary = useReducedMotion() === true
  const [fromMedia, setFromMedia] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setFromMedia(query.matches)
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [])

  return fromLibrary || fromMedia
}
