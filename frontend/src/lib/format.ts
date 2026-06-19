export const truncate = (addr: string) => addr.slice(0, 9) + '…' + addr.slice(-4)
export const toDisplay = (n: string) => (Number(n) / 1_000_000).toFixed(2)
export const toUbase = (n: string) => String(Math.floor(Number(n) * 1_000_000))
export const DENOM_LABEL: Record<string, string> = { uatom: 'ATOM', uusdc: 'USDC' }
