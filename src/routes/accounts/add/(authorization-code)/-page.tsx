import { ExternalLinkIcon, UpdateIcon } from '@radix-ui/react-icons'
import { Trans, useTranslation } from 'react-i18next'

import { exampleCode } from '../../../../config/constants/examples'
import {
  epicGamesAuthorizationCodeURL,
  epicGamesLoginURL,
} from '../../../../config/fortnite/links'

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

import { useHandlers } from '../-hooks'
import { useSetupForm } from './-hooks'

export function AuthorizationCodePage() {
  const { t } = useTranslation(['accounts', 'general'])

  const { goToAuthorizationCodeURL, goToEpicGamesLogin } = useHandlers()
  const { form, isSubmitting, onSubmit } = useSetupForm()

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-md"
      >
        <Panel>
          <div className="space-y-2 border-b border-border/60 px-5 py-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
            <p>
              <Trans
                ns="accounts"
                i18nKey="auth-code.guide.steps.1"
                values={{
                  url: epicGamesLoginURL,
                }}
                shouldUnescape
              >
                <span className="font-semibold text-foreground">1.</span>{' '}
                Sign in to Epic Games:{' '}
                <a
                  href={epicGamesLoginURL}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  title={epicGamesLoginURL}
                  onClick={goToEpicGamesLogin}
                >
                  {epicGamesLoginURL}
                </a>
              </Trans>
            </p>
            <p>
              <Trans
                ns="accounts"
                i18nKey="auth-code.guide.steps.2"
              >
                <span className="font-semibold text-foreground">2.</span>{' '}
                Open{' '}
                <a
                  href={epicGamesAuthorizationCodeURL}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  title={epicGamesAuthorizationCodeURL}
                  onClick={goToAuthorizationCodeURL}
                >
                  Get code
                </a>
                , then paste the authorizationCode value below.
              </Trans>
            </p>
          </div>
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
              variant="ghost"
              className="flex-1 space-x-1"
              asChild
            >
              <a
                href={epicGamesAuthorizationCodeURL}
                title={epicGamesAuthorizationCodeURL}
                onClick={goToAuthorizationCodeURL}
              >
                <Trans
                  ns="general"
                  i18nKey="form.credentials.login.get-code"
                >
                  <span>Get Code</span>
                  <ExternalLinkIcon />
                </Trans>
              </a>
            </Button>
            <Button
              type="submit"
              className="flex-1"
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
  )
}
