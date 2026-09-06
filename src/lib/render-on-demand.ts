/** Coalesce changes into one frame and suspend all rendering while hidden. */
export function renderOnDemand(render: () => void) {
  let frame = 0
  let disposed = false
  const draw = () => {
    frame = 0
    if (!disposed && !document.hidden) render()
  }
  const request = () => {
    if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(draw)
  }
  const visibilityChanged = () => {
    cancelAnimationFrame(frame)
    frame = 0
    request()
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  return {
    request,
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visibilityChanged)
    },
  }
}
