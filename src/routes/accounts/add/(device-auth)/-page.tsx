import { UpdateIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'

import { InputSecret } from '../../../../components/ui/extended/form/input-secret'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import {
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../../components/page'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../../components/ui/form'

import { useSetupForm } from './-hooks'

export function DeviceAuthPage() {
  const { t } = useTranslation(['general', 'accounts'])

  const { form, isSubmitting, onPaste, onSubmit } = useSetupForm()

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-md"
      >
        <Panel>
          <PanelBody className="grid gap-4">
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.credentials.account-id')}</FormLabel>
                  <FormControl>
                    <Input {...field} onPaste={onPaste} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              disabled={isSubmitting}
            />
            <FormField
              control={form.control}
              name="deviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.credentials.device-id')}</FormLabel>
                  <FormControl>
                    <InputSecret inputProps={{ ...field, onPaste }} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              disabled={isSubmitting}
            />
            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.credentials.secret')}</FormLabel>
                  <FormControl>
                    <InputSecret inputProps={{ ...field, onPaste }} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              disabled={isSubmitting}
            />
          </PanelBody>
          <PanelFooter>
            <Button
              type="submit"
              className="ml-auto min-w-32"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <UpdateIcon className="animate-spin" />
                  {t('device-auth.signing-in', {
                    ns: 'accounts',
                  })}
                </>
              ) : (
                t('actions.login')
              )}
            </Button>
          </PanelFooter>
        </Panel>
      </form>
    </Form>
  )
}
