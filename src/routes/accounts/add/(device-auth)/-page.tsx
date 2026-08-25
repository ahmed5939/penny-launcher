import { UpdateIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'

import { InputSecret } from '../../../../components/ui/extended/form/input-secret'
import { Button } from '../../../../components/ui/button'
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
  const { t } = useTranslation(['general'])

  const { form, isSubmitting, onSubmit } = useSetupForm()

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
                    <InputSecret inputProps={field} />
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
                    <InputSecret inputProps={field} />
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
                    <InputSecret inputProps={field} />
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
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <UpdateIcon className="animate-spin" />
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
