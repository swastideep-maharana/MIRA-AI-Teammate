import { Daytona } from "@daytona/sdk"

let _daytona: Daytona | null = null

export function getDaytona(): Daytona {
  if (!_daytona) {
    _daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
    })
  }
  return _daytona
}

export const daytona = new Proxy({} as Daytona, {
  get(_target, prop) {
    const client = getDaytona()
    const value = (client as any)[prop]
    return typeof value === "function" ? value.bind(client) : value
  },
})
