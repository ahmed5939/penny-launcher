import type { MouseEvent, ReactNode } from 'react'

import { ExternalLink, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageHeader, Panel, PanelHeader } from '../../../components/page'


const links = {
  kuda: 'https://www.youtube.com/@kuda9098',
  LeleDerGrasshalmi:
    'https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation',
  HyperionCSharp: 'https://github.com/HyperionCSharp/EpicGamesAPIDocs',
  SaseQ: 'https://github.com/SaseQ',
  PRO100KatYT: 'https://github.com/PRO100KatYT',
  eric_guest1: '',
}

function openURL(url: string) {
  return (event: MouseEvent) => {
    event.preventDefault()
    window.electronAPI.openExternalURL(url)
  }
}

/** A name that goes somewhere: the person's page, opened in the browser. */
function Person({ href, name }: { href?: string; name: string }) {
  if (!href) {
    return <span className="font-semibold text-foreground">{name}</span>
  }

  return (
    <a
      className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
      href={href}
      onClick={openURL(href)}
    >
      {name}
      <ExternalLink className="size-3 text-muted-foreground" />
    </a>
  )
}

/** One credit: who, then what they did, as a roll reads. */
function Credit({ children, people }: { children: ReactNode; people: ReactNode }) {
  return (
    <li className="py-3.5">
      <p className="text-ui">{people}</p>
      <p className="mt-1 text-ui leading-relaxed text-muted-foreground">
        {children}
      </p>
    </li>
  )
}

export function ComponentRoute() {
  const { t } = useTranslation(['general'])

  return (
    <>
      <PageHeader
        description="The people Penny Launcher is built on."
        icon={Heart}
        title={t('credits')}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel>
          <PanelHeader
            compact
            title="Made by"
          />
          <ul className="divide-y divide-border/30 px-5">
            <Credit people={<Person href="https://github.com/ahmed5939" name="Ahmed (ahmed5939)" />}>
              Current maintainer of Penny Launcher.
            </Credit>
            <Credit people={<Person href="https://github.com/Ciensprog/Aerial-Launcher" name="Ciensprog" />}>
              Original developer of Aerial Launcher, the project Penny Launcher
              is based on.
            </Credit>
            <Credit people={<Person href={links.kuda} name="Kuda" />}>
              Helped with the logos and design, and suggested many cool
              features along the way.
            </Credit>
            <Credit
              people={
                <>
                  <Person href={links.LeleDerGrasshalmi} name="LeleDerGrasshalmi" />
                  <span className="text-muted-foreground"> and </span>
                  <Person href={links.HyperionCSharp} name="HyperionCSharp" />
                </>
              }
            >
              Their endpoint documentation helped a lot during development.
            </Credit>
            <Credit
              people={
                <>
                  <Person name="MyNameIsPako" />
                  <span className="text-muted-foreground"> and </span>
                  <Person name="Espiroaka" />
                </>
              }
            >
              Tested, fixed features and shared assets. They also run a great
              community around{' '}
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href="https://discord.gg/vphWQWFNf9"
                onClick={openURL('https://discord.gg/vphWQWFNf9')}
              >
                Mia
              </a>
              , a Discord bot for Fortnite.
            </Credit>
            <Credit
              people={
                <>
                  <Person href={links.SaseQ} name="SaseQ" />
                  <span className="text-muted-foreground"> and </span>
                  <Person href={links.PRO100KatYT} name="PRO100KatYT" />
                </>
              }
            >
              Daily quests were implemented by SaseQ using research by
              PRO100KatYT.
            </Credit>
          </ul>
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel>
            <PanelHeader
              compact
              title="Special thanks"
            />
            <ul className="divide-y divide-border/30 px-5">
              <Credit people={<Person name="Fresh" />}>
                Backed Aerial's development with his point of view from day
                one and tested features whenever needed. #Fresh4President
              </Credit>
              <Credit people={<Person name="eric_guest1" />}>
                Tested the first versions of Aerial and spent many hours in
                voice chat sharing ideas about the project.
              </Credit>
            </ul>
          </Panel>

          <Panel>
            <PanelHeader
              compact
              description="Thank you for translating Aerial into other languages."
              title="Translations"
            />
            <ul className="divide-y divide-border/30 px-5">
              <li className="flex items-center justify-between gap-3 py-3 text-ui">
                <span className="font-semibold">SayaGoodBye</span>
                <span className="text-muted-foreground">Chinese (Simplified)</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-3 text-ui">
                <span className="font-semibold">stxfano</span>
                <span className="text-muted-foreground">Italian</span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
