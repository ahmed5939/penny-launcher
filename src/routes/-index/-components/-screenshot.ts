export async function copyElementScreenshot(element: HTMLElement) {
  // Pulled in on demand: the screenshot library is only needed once the
  // user actually asks for one, so it stays out of the startup path.
  const { domToBlob } = await import('modern-screenshot')

  const background = getComputedStyle(document.documentElement)
    .getPropertyValue('--background')
    .trim()

  const data = await domToBlob(element, {
    backgroundColor: `hsl(${background})`,
    type: 'image/png',
  })

  await window.navigator.clipboard.write([
    new ClipboardItem({
      'image/png': data,
    }),
  ])
}
