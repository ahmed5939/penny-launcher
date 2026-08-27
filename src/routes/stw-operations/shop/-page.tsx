import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type {
  ShopGrant,
  ShopOffer,
  ShopSection,
} from '../../../kernel/core/shop'
import type { SegmentedOption } from '../../../components/page'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  Gift,
  PackageOpen,
  RefreshCw,
  Sparkles,
  Store,
  Timer,
  UserX,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { ItemIcon, resolveItemArt } from '../../../components/items/item-icon'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  Segmented,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useShopData } from './-hooks'

import { parseCustomDisplayName } from '../../../lib/utils'

const sectionOptions: Array<SegmentedOption<ShopSection>> = [
  { label: 'X-Ray Llamas', value: 'llamas' },
  { label: 'Event Store', value: 'event' },
  { label: 'Weekly Store', value: 'weekly' },
]

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Store}
        section={t('stw-operations.title')}
        title={
          <span className="flex items-center gap-2">
            {t('stw-operations.options.shop')}
            <BetaBadge />
          </span>
        }
        description="What is inside every X-Ray llama before you buy it, plus the event and weekly stores."
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    account,
    currencies,
    errorMessage,
    expiration,
    handleLoad,
    handleOpenLlamas,
    handlePurchase,
    hasLoaded,
    isDisabledOpen,
    isLoading,
    isOpening,
    offers,
    purchasingOfferId,
    records,
    section,
    unopenedLlamas,
    updateSection,
  } = useShopData()

  if (!account) {
    return (
      <EmptyState
        description="Pick one in the title bar and its shop loads here."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  return (
    <>
      <Panel id="shop-card">
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.8125rem] font-medium">
              {parseCustomDisplayName(account)}
            </span>
            <Button
              className="ml-auto"
              disabled={isLoading}
              onClick={handleLoad}
              size="sm"
              variant="ghost"
            >
              {isLoading ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  Refresh
                </>
              )}
            </Button>
            <Button
              disabled={isDisabledOpen}
              onClick={handleOpenLlamas}
              size="sm"
            >
              {isOpening ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                <>
                  <PackageOpen className="size-4" />
                  Open all llamas ({unopenedLlamas})
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {currencies.length > 0 ? (
              currencies.map((currency) => (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface/60 py-0.5 pl-0.5 pr-2 text-[0.65rem] font-medium"
                  key={currency.templateId}
                >
                  <ItemIcon
                    records={records}
                    size="small"
                    templateId={currency.templateId}
                    title={currency.label}
                  />
                  <span className="tabular-nums">
                    {currency.quantity.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">
                    {currency.label}
                  </span>
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                {isLoading ? 'Reading balances…' : 'No spendable currency'}
              </span>
            )}
          </div>
        </PanelBody>
      </Panel>

      {errorMessage && (
        <Callout
          title="Could not read this account's shop"
          tone="danger"
        >
          {errorMessage}
        </Callout>
      )}

      {hasLoaded && !errorMessage && (
        <>
          <StatRow className="lg:grid-cols-3">
            <StatTile
              icon={Gift}
              label="Unopened llamas"
              tone={unopenedLlamas > 0 ? 'primary' : 'default'}
              value={unopenedLlamas}
            />
            <StatTile
              hint={
                expiration
                  ? dayjs(expiration).format('MMM D, HH:mm')
                  : undefined
              }
              icon={Timer}
              label="Shop rotates"
              value={expiration ? dayjs(expiration).fromNow() : '—'}
            />
            <StatTile
              icon={Store}
              label="On offer"
              value={offers.length}
            />
          </StatRow>

          <Segmented
            onChange={updateSection}
            options={sectionOptions}
            value={section}
          />

          {section === 'llamas' && (
            <Callout
              title="These rolls belong to this account"
              tone="info"
            >
              Opening this page asks Epic to populate the X-Ray rolls, exactly
              as the game does when you walk into the llama store. Switch
              account in the title bar to see a different set.
            </Callout>
          )}

          {offers.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {offers.map((offer) => (
                <OfferCard
                  isPurchaseLocked={
                    purchasingOfferId !== null &&
                    purchasingOfferId !== offer.offerId
                  }
                  isPurchasing={purchasingOfferId === offer.offerId}
                  key={offer.offerId}
                  offer={offer}
                  onPurchase={() => handlePurchase(offer)}
                  records={records}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              description="The event and weekly stores only stock items while an event is running."
              icon={Store}
              title="Nothing on this shelf"
            />
          )}
        </>
      )}

      <GoToTop containerId="shop-card" />
    </>
  )
}

function OfferCard({
  isPurchaseLocked,
  isPurchasing,
  offer,
  onPurchase,
  records,
}: {
  isPurchaseLocked: boolean
  isPurchasing: boolean
  offer: ShopOffer
  onPurchase: () => void
  records: ItemRecordMap
}) {
  /** X-Ray llamas advertise a generic grant; the roll is the real content. */
  const contents = offer.preroll ?? offer.itemGrants
  const isDiscounted = offer.finalPrice < offer.regularPrice
  const purchaseLimit =
    offer.dailyLimit || offer.weeklyLimit || offer.monthlyLimit
  const soldOut = purchaseLimit > 0 && offer.purchased >= purchaseLimit

  return (
    <Panel>
      <header className="flex items-start gap-3 border-b border-border/60 px-4 py-3">
        {offer.itemGrants[0] && (
          <ItemIcon
            records={records}
            size="large"
            templateId={offer.itemGrants[0].templateId}
            title={offer.title}
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-[0.8125rem] font-medium">
              {offer.title}
            </span>
            {offer.preroll && (
              <Sparkles className="size-3 shrink-0 text-primary" />
            )}
          </p>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {[
              offer.saleExpiration &&
                `leaves ${dayjs(offer.saleExpiration).fromNow()}`,
              offer.dailyLimit > 0 && `${offer.dailyLimit}/day`,
              offer.weeklyLimit > 0 && `${offer.weeklyLimit}/week`,
              offer.monthlyLimit > 0 && `${offer.monthlyLimit}/month`,
              purchaseLimit > 0 &&
                `${Math.min(offer.purchased, purchaseLimit)}/${purchaseLimit} purchased`,
            ]
              .filter(Boolean)
              .join(' · ') || 'No purchase limit'}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">
            {offer.finalPrice.toLocaleString()}
          </p>
          <p className="text-[0.6rem] text-muted-foreground">
            {isDiscounted && (
              <s className="mr-1 tabular-nums">
                {offer.regularPrice.toLocaleString()}
              </s>
            )}
            {offer.currencyLabel}
          </p>
        </div>
      </header>

      <PanelBody className="space-y-3">
        {contents.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {contents.map((grant, index) => (
              <GrantTile
                grant={grant}
                key={`${grant.templateId}-${index}`}
                records={records}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Contents are not revealed for this offer.
          </p>
        )}

        <Button
          className="w-full"
          disabled={
            isPurchaseLocked ||
            isPurchasing ||
            !offer.affordable ||
            soldOut ||
            offer.currency === 'RealMoney'
          }
          onClick={onPurchase}
          size="sm"
          variant={offer.affordable ? 'default' : 'secondary'}
        >
          {isPurchasing ? (
            <UpdateIcon className="animate-spin" />
          ) : soldOut ? (
            'Purchased · limit reached'
          ) : offer.currency === 'RealMoney' ? (
            'Real money only'
          ) : offer.affordable ? (
            `Buy for ${offer.finalPrice.toLocaleString()} ${offer.currencyLabel}`
          ) : (
            `Not enough ${offer.currencyLabel}`
          )}
        </Button>
      </PanelBody>
    </Panel>
  )
}

function GrantTile({
  grant,
  records,
}: {
  grant: ShopGrant
  records: ItemRecordMap
}) {
  const art = resolveItemArt(grant.templateId, records)
  const label = art.preferName && art.name ? art.name : grant.name

  return (
    <li className="flex w-[4.5rem] flex-col items-center gap-1 text-center">
      <ItemIcon
        quantity={grant.quantity}
        records={records}
        size="xl"
        templateId={grant.templateId}
        tier={grant.tier}
        title={`${label} · ${grant.templateId}`}
      />
      <span className="line-clamp-2 text-[0.6rem] leading-tight text-muted-foreground">
        {label}
      </span>
    </li>
  )
}
