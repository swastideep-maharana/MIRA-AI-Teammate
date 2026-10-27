"use client"

if (typeof window !== "undefined") {
  ;(window as any).next = (window as any).next || {}
  ;(window as any).next.version = "16.4.3"

  try {
    Object.defineProperty(window, "__internal_onBeforeSetActive", {
      configurable: false,
      enumerable: true,
      get: () => () => Promise.resolve(),
      set: () => {},
    })
  } catch {}
}

export function ClerkFix() {
  return null
}
