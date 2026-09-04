import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { History, MoreHorizontal, Palette, Settings, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { colorThemes } from '../../config/constants/color-themes'
import { useUISidebarHistory } from '../../hooks/ui/sidebars'
import { useTheme } from '../theme-provider'
import { ThemeSwatch } from '../theme-picker'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

export function OverflowMenu() {
  const { t } = useTranslation(['sidebar', 'settings', 'general'])
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme()
  const { changeVisibility } = useUISidebarHistory()
  const openHistory = useRef(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="shell-more"
          size="icon"
          variant="ghost"
          aria-label={t('sidebar:more')}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        onCloseAutoFocus={(event) => {
          if (!openHistory.current) return
          event.preventDefault()
          openHistory.current = false
          changeVisibility(true)
        }}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Palette className="size-4" />
            {t('settings:app-settings.form.appearance.label')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-h-[75vh] overflow-y-auto">
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => {
                  if (
                    value === 'light' ||
                    value === 'dark' ||
                    value === 'system'
                  )
                    setTheme(value)
                }}
              >
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <DropdownMenuRadioItem key={mode} value={mode}>
                    {t(`settings:app-settings.form.appearance.mode.${mode}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={colorTheme}
                onValueChange={(value) => {
                  const color = colorThemes.find((item) => item.id === value)
                  if (color) setColorTheme(color.id)
                }}
              >
                {colorThemes.map((color) => (
                  <DropdownMenuRadioItem
                    className="gap-2"
                    key={color.id}
                    value={color.id}
                  >
                    <ThemeSwatch className="size-4" gradient={color.gradient} />
                    {color.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem
          className="gap-2"
          onSelect={() => {
            openHistory.current = true
          }}
        >
          <History className="size-4" />
          {t('sidebar:history')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link className="gap-2" to="/account">
            <Users className="size-4" />
            {t('sidebar:manage-accounts')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link className="gap-2" to="/settings">
            <Settings className="size-4" />
            {t('general:settings')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
