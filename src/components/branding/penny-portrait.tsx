import pennyHead from '../../assets/brand/penny-head.png'
import pennyFull from '../../assets/brand/penny.png'

import { cn } from '../../lib/utils'

/**
 * The Power B.A.S.E. Penny render the app is named and themed after.
 *
 * Two framings from the same source art: `avatar` is the pre-cropped head for
 * small round slots (titlebar, menus), `full` is the untouched bust used as a
 * large watermark. Epic Games artwork — see `src/assets/brand`.
 */

export function PennyAvatar({
  className,
  ...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  return (
    <img
      src={pennyHead}
      alt="Penny"
      className={cn(
        'shrink-0 rounded-full object-cover',
        'ring-1 ring-primary/40',
        className
      )}
      {...props}
    />
  )
}

export function PennyRender({
  className,
  ...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  return (
    <img
      src={pennyFull}
      alt=""
      aria-hidden
      className={cn('pointer-events-none select-none', className)}
      {...props}
    />
  )
}
