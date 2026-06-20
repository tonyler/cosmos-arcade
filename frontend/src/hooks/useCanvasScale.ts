import { useState, useEffect } from 'react'

export function useCanvasScale(maxScale: number, canvasW: number, canvasH: number, reservedH = 160) {
  const [scale, setScale] = useState(maxScale)
  useEffect(() => {
    function compute() {
      const availW = window.innerWidth - 32
      const availH = window.innerHeight - reservedH
      setScale(Math.min(maxScale, availW / canvasW, availH / canvasH))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [maxScale, canvasW, canvasH, reservedH])
  return scale
}
