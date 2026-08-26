import { ExternalLinkIcon, UpdateIcon } from '@radix-ui/react-icons'
import { Trans, useTranslation } from 'react-i18next'

import { exampleCode } from '../../../../config/constants/examples'
import {
  epicGamesAuthorizationCodeURL,
  epicGamesLoginURL,
} from '../../../../config/fortnite/links'

import { InputSecret } from '../../../../components/ui/extended/form/input-secret'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../components/ui/accordion'
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
          {/* The guide is optional reading, so it collapses above the form. */}
          <div className="border-b border-border/60 px-5">
            <Accordion type="multiple">
              <AccordionItem value="how-to-get">
                <AccordionTrigger>
                  {t('auth-code.guide.title')}
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                    <Trans
                      ns="accounts"
                      i18nKey="auth-code.guide.steps.1"
                      values={{
                        url: epicGamesLoginURL,
                      }}
                      shouldUnescape
                    >
                      <span className="font-bold">Step 1:</span> You must
                      sign in to your Epic Games account:{' '}
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
                  <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                    <Trans
                      ns="accounts"
                      i18nKey="auth-code.guide.steps.2"
                    >
                      <span className="font-bold">Step 2:</span> Click on{' '}
                      <a
                        href={epicGamesAuthorizationCodeURL}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        title={epicGamesAuthorizationCodeURL}
                        onClick={goToAuthorizationCodeURL}
                      >
                        this link
                      </a>{' '}
                      or in button below, this will be open a new tab in
                      your browser with a json response with your
                      authorization code:
                    </Trans>
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-border/60 bg-surface/70 p-2.5 text-xs">
                    <>
                      {JSON.stringify(
                        {
                          redirectUrl: '.../?code=COPY_THIS',
                          authorizationCode: 'COPY_THIS',
                          exchangeCode: null,
                          sid: null,
                          ssoV2Enabled: true,
                        },
                        null,
                        2
                      )}
                    </>
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
