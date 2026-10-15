// eslint-disable-next-line import/no-unresolved
import { type ExternalToast, toast as sonnerToast } from 'sonner'

type Message = Parameters<typeof sonnerToast.error>[0]

const attentionDuration = 6000

export const toast = Object.assign(
  (message: Message, data?: ExternalToast) => sonnerToast(message, data),
  sonnerToast,
  {
    error: (message: Message, data?: ExternalToast) =>
      sonnerToast.error(message, {
        ...data,
        duration: data?.duration ?? attentionDuration,
      }),
    warning: (message: Message, data?: ExternalToast) =>
      sonnerToast.warning(message, {
        ...data,
        duration: data?.duration ?? attentionDuration,
      }),
  }
)
