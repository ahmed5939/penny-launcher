import { UpdateIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'

import { exampleCode } from '../../../../config/constants/examples'

import { InputSecret } from '../../../../components/ui/extended/form/input-secret'
import { SeparatorWithTitle } from '../../../../components/ui/extended/separator'
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

import { GenerateExchangeCodePage } from './-generate'

import { useSetupForm } from './-hooks'

export function ExchangeCodePage() {
  const { t } = useTranslation(['accounts', 'general'])

  const { form, isSubmitting, selected, onSubmit } = useSetupForm()

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      {selected && (
        <>
          <GenerateExchangeCodePage />
          <SeparatorWithTitle>
            {t('separators.or', {
              ns: 'general',
            })}
          </SeparatorWithTitle>
        </>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full"
        >
          <Panel>
            <PanelBody className="grid gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('form.credentials.login.label', {
                        ns: 'general',
                      })}
                    </FormLabel>
                    <FormControl>
                      <InputSecret
                        inputProps={{
                          placeholder: t(
                            'form.credentials.login.input.placeholder',
                            {
                              ns: 'general',
                              code: exampleCode,
                            }
                          ),
                          ...field,
                        }}
                      />
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
                  t('actions.login', {
                    ns: 'general',
                  })
                )}
              </Button>
            </PanelFooter>
          </Panel>
        </form>
      </Form>
    </div>
  )
}
