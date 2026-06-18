const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000/ws'

type Handler = (data: unknown) => void

class WSClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Handler>>()
  private queue: string[] = []
  private _connected = false

  get connected() { return this._connected }

  connect(address?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return
    const url = address ? `${WS_URL}?address=${encodeURIComponent(address)}` : WS_URL
    this.ws = new WebSocket(url)
    this.ws.onopen = () => {
      this._connected = true
      this.queue.forEach((m) => this.ws!.send(m))
      this.queue = []
    }
    this.ws.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data as string)
        this.handlers.get(type)?.forEach((h) => h(data))
      } catch {}
    }
    this.ws.onclose = () => {
      this._connected = false
      setTimeout(() => this.connect(address), 2000)
    }
    this.ws.onerror = () => this.ws?.close()
  }

  send(type: string, data: unknown) {
    const msg = JSON.stringify({ type, data })
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(msg)
    else this.queue.push(msg)
  }

  on(type: string, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)!.delete(handler)
  }

}

export const ws = new WSClient()
