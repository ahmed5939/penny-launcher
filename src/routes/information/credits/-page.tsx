import type { MouseEvent } from 'react'

import { ExternalLink, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import packageJson from '../../../../package.json'

import { PageHeader, Panel } from '../../../components/page'

import { useActions } from './-hooks'

import { whatIsThis } from '../../../lib/callbacks'
import { cn } from '../../../lib/utils'

const links = {
  kuda: 'https://www.youtube.com/@kuda9098',
  LeleDerGrasshalmi:
    'https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation',
  HyperionCSharp: 'https://github.com/HyperionCSharp/EpicGamesAPIDocs',
  SaseQ: 'https://github.com/SaseQ',
  PRO100KatYT: 'https://github.com/PRO100KatYT',
  eric_guest1: '',
}

export function ComponentRoute() {
  const { t } = useTranslation(['general'])

  const { handleEricDejaDeJoder, handleFreshAttrs, handleSick } =
    useActions()

  const openURL = (url: string) => (event: MouseEvent) => {
    event.preventDefault()
    window.electronAPI.openExternalURL(url)
  }

  return (
    <>
      <PageHeader
        icon={Heart}
        title={t('credits')}
      />
      {/*
        Three flat lists of names under 3xl headings. Sectioned into panels
        with the names as links and the blurbs as secondary text, so it
        scans as credits rather than a wall of prose.
      */}
      <div
        className={cn(
          'max-w-3xl space-y-4',
          '[&_.list]:divide-y [&_.list]:divide-border/50',
          '[&_.item]:space-y-1 [&_.item]:px-5 [&_.item]:py-3.5',
          '[&_.item>div]:text-[0.8125rem] [&_.item>div]:leading-relaxed [&_.item>div]:text-muted-foreground',
          '[&_.link]:gap-1 [&_.link]:inline-flex [&_.link]:items-center [&_.link]:font-medium [&_.link]:text-foreground [&_.link:hover]:text-primary'
        )}
      >
        <Panel>
          <h2 className="border-b border-border/60 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Credits
          </h2>
          <ul className="list">
              <li className="item">
                <a
                  href={packageJson.repository.url}
                  className="link"
                  onClick={openURL(packageJson.repository.url)}
                  onAuxClick={whatIsThis()}
                >
                  Ciensprog <ExternalLink className="h-3 w-3" />
                </a>
                <div>
                  Original developer of Aerial Launcher, the project Penny
                  Launcher is based on.
                </div>
              </li>
              <li className="item">
                <a
                  href={links.kuda}
                  className="link"
                  onClick={openURL(links.kuda)}
                  onAuxClick={whatIsThis()}
                >
                  Kuda <ExternalLink className="h-3 w-3" />
                </a>
                <div>
                  Helped with the logos, design and suggested many cool
                  features along the way. Lleva meses con la misma{' '}
                  <span onClick={handleSick}>tos ☠️</span>
                </div>
              </li>
              <li className="item">
                <a
                  href={links.LeleDerGrasshalmi}
                  className="link"
                  onClick={openURL(links.LeleDerGrasshalmi)}
                  onAuxClick={whatIsThis()}
                >
                  LeleDerGrasshalmi <ExternalLink className="h-3 w-3" />
                </a>{' '}
                and{' '}
                <a
                  href={links.HyperionCSharp}
                  className="link"
                  onClick={openURL(links.HyperionCSharp)}
                  onAuxClick={whatIsThis()}
                >
                  HyperionCSharp <ExternalLink className="h-3 w-3" />
                </a>
                <div>
                  Their endpoint list helped me a lot during the
                  development.
                </div>
              </li>
              <li className="item">
                <div>
                  <span className="text-muted-foreground">
                    MyNameIsPako
                  </span>{' '}
                  and{' '}
                  <span className="text-muted-foreground">Espiroaka</span>
                </div>
                <div>
                  Both helped me to test some things, fix some features and
                  share some assets, also they have a great community{' '}
                  <a
                    href="https://discord.gg/vphWQWFNf9"
                    className="link font-bold italic text-muted-foreground underline"
                    onClick={openURL('https://discord.gg/vphWQWFNf9')}
                    onAuxClick={whatIsThis()}
                  >
                    Mia <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  a dedicated Discord bot for Fortnite with many cool
                  features.
                </div>
              </li>
              <li className="item">
                <a
                  href={links.SaseQ}
                  className="link"
                  onClick={openURL(links.SaseQ)}
                  onAuxClick={whatIsThis()}
                >
                  SaseQ <ExternalLink className="h-3 w-3" />
                </a>{' '}
                and{' '}
                <a
                  href={links.PRO100KatYT}
                  className="link"
                  onClick={openURL(links.PRO100KatYT)}
                  onAuxClick={whatIsThis()}
                >
                  PRO100KatYT <ExternalLink className="h-3 w-3" />
                </a>
                <div>
                  Daily quests were implemented by SaseQ using research
                  done by PRO100KatYT.
                </div>
              </li>
          </ul>
        </Panel>

        <Panel>
          <h2 className="border-b border-border/60 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Greetings
          </h2>
          <ul className="list">
              <li className="item">
                <span
                  className="text-muted-foreground"
                  {...handleFreshAttrs}
                >
                  Fresh
                </span>
                <div>
                  I'd like to also thank Fresh for backing me with his
                  point of view through Aerial's development. He's been a
                  day1 supporter and helped me test features anytime I
                  needed. #Fresh4President
                </div>
              </li>
              <li className="item">
                <span
                  className="text-muted-foreground"
                  onClick={handleEricDejaDeJoder}
                >
                  eric_guest1
                </span>
                <div>
                  Eric helped me test some of the first versions of Aerial,
                  aswell as being many hours in voice chat sharing his
                  opinions and ideas about the project.
                </div>
              </li>
          </ul>
        </Panel>

        <Panel>
          <h2 className="border-b border-border/60 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Translations
          </h2>
          <p className="px-5 pt-3.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
            Thank you for dedicating part of your time to translate Aerial
            to different languages 💖
          </p>
          <ul className="px-5 py-3.5">
            <li className="flex items-center gap-2 py-1 text-[0.8125rem]">
              <span className="font-medium">SayaGoodBye</span>
              <span className="text-muted-foreground">
                — Chinese (Simplified)
              </span>
            </li>
            <li className="flex items-center gap-2 py-1 text-[0.8125rem]">
              <span className="font-medium">stxfano</span>
              <span className="text-muted-foreground">— Italian</span>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  )
}

