import type { ShopActions } from './-hooks'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type {
  ShopCurrency,
  ShopEntry,
  ShopGrant,
  ShopOffer,
  ShopSection,
  ShopView,
} from '../../../kernel/core/shop'
import type { SegmentedOption } from '../../../components/page'

import { UpdateIcon } from '@radix-ui/react-icons'
import { Coins, PackageOpen, Sparkles, Store } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { Artboard } from '../../../components/items/artboard'
import {
  ItemIcon,
  itemBadge,
  resolveItemArt,
} from '../../../components/items/item-icon'
import {
  AccountResourceGate,
  EmptyState,
  ListRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  RefreshButton,
  Segmented,
  ToolBadges,
} from '../../../components/page'

import { getItemRecord, useItemDatabaseStore } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import {
  useShopActions,
  useShopCatalog,
  useShopResource,
  useShopView,
} from './-hooks'
import { ShopCatalog } from './-catalog'
import {
  BuyButton,
  isSoldOut,
  priceArtId,
  purchaseLimit,
} from './-offer-parts'

import { RarityType } from '../../../config/constants/resources'

import { cn } from '../../../lib/utils'

const viewOptions: Array<SegmentedOption<ShopView>> = [
  { label: 'Account shop', value: 'account' },
  { label: 'Browse catalog', value: 'browse' },
]

const sectionOptions: Array<SegmentedOption<ShopSection>> = [
  { label: 'X-Ray Llamas', value: 'llamas' },
  { label: 'Event Store', value: 'event' },
  { label: 'Weekly Store', value: 'weekly' },
]

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])
  useRequestItemDatabase()

  const { updateView, view } = useShopView()
  const { followUp, resource } = useShopResource()
  const actions = useShopActions(resource, followUp)
  const catalog = useShopCatalog(view === 'browse')
  const isBrowsing = view === 'browse'

  /** Browse leans on the account shop for its Buy buttons, so refresh both. */
  const handleRefresh = () => {
    if (isBrowsing) {
      catalog.handleLoadCatalog()
    }

    if (resource.accountId) {
      resource.refresh()
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Segmented
              onChange={updateView}
              options={viewOptions}
              value={view}
            />
            <RefreshButton
              disabled={!isBrowsing && !resource.accountId}
              loading={isBrowsing ? catalog.catalogLoading : resource.loading}
              onClick={handleRefresh}
            />
          </>
        }
        description="What is inside every X-Ray llama before you buy it, plus the event and weekly stores. Browse the public catalog without signing in."
        icon={Store}
        section={t('stw-operations.title')}
        status={<ToolBadges beta />}
        title={t('stw-operations.options.shop')}
      />
      {isBrowsing ? (
        <ShopCatalog
          accountOffers={resource.data?.offers ?? null}
          actions={actions}
          catalog={catalog}
          hasAccount={resource.accountId !== null}
        />
      ) : (
        <AccountResourceGate
          icon={Store}
          loading={{
            title: 'Loading the shop…',
            description:
              'Asking Epic for the X-Ray rolls, the event and weekly stores and your balances.',
          }}
          resource={resource}
          what="this account's shop"
        >
          {(entry) => (
            <AccountShop
              actions={actions}
              entry={entry}
              isRefreshing={resource.loading}
              key={entry.accountId}
            />
          )}
        </AccountResourceGate>
      )}
    </div>
  )
}

/**
 * The balance shelves, in the order a player reads them: what you spend,
 * what you evolve with, what re-rolls perks, then XP. Anything the
 * patterns do not recognise lands in "Other" rather than being dropped.
 */
const balanceGroups: Array<{ label: string; match: (id: string) => boolean }> = [
  { label: 'Currencies', match: (id) => /:(currency_|eventcurrency_|campaign_event_currency|voucher_)/.test(id) },
  { label: 'PERK-UP!', match: (id) => id.includes(':reagent_alteration_') },
  { label: 'Evolution materials', match: (id) => id.includes(':reagent_') },
  { label: 'XP', match: (id) => /:(heroxp|personnelxp|schematicxp|phoenixxp)$/.test(id) },
]

function groupBalances(currencies: ReadonlyArray<ShopCurrency>) {
  const groups = [...balanceGroups.map((group) => ({ label: group.label, items: [] as Array<ShopCurrency> })), { label: 'Other', items: [] as Array<ShopCurrency> }]

  currencies.forEach((currency) => {
    const id = currency.templateId.toLowerCase()
    const index = balanceGroups.findIndex((group) => group.match(id))

    groups[index === -1 ? groups.length - 1 : index].items.push(currency)
  })

  return groups.filter((group) => group.items.length > 0)
}

const xrayTicketId = 'AccountResource:currency_xrayllama'
const goldId = 'AccountResource:eventcurrency_scaling'

/** The wallet the game shows in the corner of each shelf. */
const walletBySection: Record<ShopSection, Array<string>> = {
  llamas: [xrayTicketId],
  event: [goldId],
  weekly: [goldId],
}

function AccountShop({
  actions,
  entry,
  isRefreshing,
}: {
  actions: ShopActions
  entry: ShopEntry
  isRefreshing: boolean
}) {
  const records = useItemDatabaseStore((state) => state.records)
  const { section, updateSection } = useShopView()
  const { handleOpenLlamas, isOpening } = actions

  const offers = entry.offers.filter((offer) => offer.section === section)
  const canOpen = !isOpening && entry.unopenedLlamas > 0
  const balances = groupBalances(entry.currencies)
  const nameOf = (currency: ShopCurrency) =>
    // The game's own name ("Pure Drop of Rain"), not the id turned into
    // words ("Reagent C T01").
    getItemRecord(records, currency.templateId)?.name ?? currency.label
  const wallet = walletBySection[section].map((templateId) => ({
    templateId,
    quantity:
      entry.currencies.find((currency) => currency.templateId === templateId)
        ?.quantity ?? 0,
  }))

  return (
    <>
      {/*
       * The game's Loot tab: the shelves as tabs along the top, the wallet
       * they are paid from and the rotation clock opposite them.
       */}
      <div
        className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border/60"
        id="shop-card"
      >
        <div
          aria-label="Store"
          className="flex gap-1"
          role="tablist"
        >
          {sectionOptions.map((option) => {
            const isActive = option.value === section
            const count = entry.offers.filter(
              (offer) => offer.section === option.value
            ).length

            return (
              <button
                aria-selected={isActive}
                className={cn(
                  '-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-title font-bold transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                key={option.value}
                onClick={() => updateSection(option.value)}
                role="tab"
                type="button"
              >
                {option.label}
                <span className="figure text-xs font-medium text-muted-foreground">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2.5 text-ui">
          {entry.expiration && (
            <span
              className="text-muted-foreground"
              title={dayjs(entry.expiration).format('MMM D, HH:mm')}
            >
              Refreshes in{' '}
              <span className="figure font-semibold text-foreground">
                {dayjs(entry.expiration).fromNow(true)}
              </span>
            </span>
          )}
          {(entry.unopenedLlamas > 0 || isOpening) && (
            <Button
              disabled={!canOpen}
              onClick={handleOpenLlamas}
              size="sm"
              variant="secondary"
            >
              {isOpening ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                <PackageOpen className="size-4" />
              )}
              Open {entry.unopenedLlamas}{' '}
              {entry.unopenedLlamas === 1 ? 'llama' : 'llamas'}
            </Button>
          )}
          {wallet.map((currency) => (
            <span
              className="flex items-center gap-1.5 rounded-lg bg-muted/40 py-1 pl-1.5 pr-3"
              key={currency.templateId}
            >
              <CurrencyGlyph
                className="size-6"
                records={records}
                templateId={currency.templateId}
              />
              <span className="figure text-title font-bold">
                {currency.quantity.toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      </div>

      {offers.length <= 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-12"
          description="The event and weekly stores only stock items while an event is running."
          icon={Store}
          title="Nothing on this shelf"
        />
      ) : section === 'llamas' ? (
        <LlamaShelf
          actions={actions}
          offers={offers}
          records={records}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
          {offers.map((offer) => (
            <StoreTile
              actions={actions}
              key={offer.offerId}
              offer={offer}
              records={records}
            />
          ))}
        </div>
      )}

      <Panel>
        <PanelHeader
          compact
          icon={Coins}
          title="Balances"
        />
        {balances.length > 0 ? (
          <div className="grid gap-px bg-border/30 md:grid-cols-2 xl:grid-cols-4">
            {balances.map((group) => (
              <section
                aria-label={group.label}
                className="bg-card px-4 py-3"
                key={group.label}
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {group.label}
                </p>
                <ul className="mt-1">
                  {group.items.map((currency) => (
                    <ListRow
                      className="py-1.5"
                      figure={currency.quantity.toLocaleString()}
                      key={currency.templateId}
                      name={nameOf(currency)}
                      well={
                        <ItemIcon
                          records={records}
                          templateId={currency.templateId}
                          title={nameOf(currency)}
                        />
                      }
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <PanelBody>
            <span className="text-xs text-muted-foreground">
              {isRefreshing ? 'Reading balances…' : 'No spendable currency'}
            </span>
          </PanelBody>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Offers, prices, limits and balances come from this account&apos;s Epic
        catalog; opening the page populates the X-Ray rolls exactly as walking
        into the llama store does. Buying asks twice and spends straight away;
        real-money offers cannot be bought here.
      </p>

      <GoToTop containerId="shop-card" />
    </>
  )
}

/** The display name for an offer, preferring the game's over Epic's dev title. */
function offerName(offer: ShopOffer, records: ItemRecordMap) {
  const subject = offer.itemGrants[0] ?? offer.preroll?.[0]
  const art = subject
    ? resolveItemArt(subject.templateId, records, subject.portrait)
    : null
  const hasInternalTitle =
    offer.title.includes('[VIRTUAL]') ||
    offer.title.includes('GameItem:') ||
    offer.title.includes('AccountResource:')

  return hasInternalTitle && art?.preferName ? art.name : offer.title
}

/** "3 left today", the way the game counts a limit down. */
function stockLabel(offer: ShopOffer) {
  const limit = purchaseLimit(offer)

  if (limit <= 0) {
    return null
  }

  const left = Math.max(0, limit - offer.purchased)
  const window =
    offer.dailyLimit > 0
      ? ' today'
      : offer.weeklyLimit > 0
        ? ' this week'
        : offer.monthlyLimit > 0
          ? ' this month'
          : ''

  return left <= 0 ? 'Sold out' : `${left.toLocaleString()} left${window}`
}

function PriceIcon({
  offer,
  records,
}: {
  offer: ShopOffer
  records: ItemRecordMap
}) {
  const templateId = priceArtId(offer)

  return templateId ? (
    <CurrencyGlyph
      className="size-5"
      records={records}
      templateId={templateId}
      title={offer.currencyLabel}
    />
  ) : null
}

/** A currency drawn bare, as the game prints it beside a figure. */
function CurrencyGlyph({
  className,
  records,
  templateId,
  title,
}: {
  className?: string
  records: ItemRecordMap
  templateId: string
  title?: string
}) {
  const art = resolveItemArt(templateId, records)

  return art.imgUrl ? (
    <img
      alt={title ?? art.name}
      className={cn('shrink-0 object-contain', className)}
      src={art.imgUrl}
      title={title ?? art.name}
    />
  ) : null
}

/** A small dark pill laid over card art: stock, quantity. */
const overlayPill =
  'rounded-md bg-background/80 px-1.5 py-0.5 text-2xs font-semibold leading-none'

/**
 * X-Ray llamas as the game lays them out: the llamas stood side by side,
 * the one you have picked lit, and what it will drop beside it.
 */
function LlamaShelf({
  actions,
  offers,
  records,
}: {
  actions: ShopActions
  offers: Array<ShopOffer>
  records: ItemRecordMap
}) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const picked =
    offers.find((offer) => offer.offerId === pickedId) ?? offers[0]
  const { handlePurchase, purchasingOfferId } = actions
  const name = offerName(picked, records)
  const contents = picked.preroll ?? picked.itemGrants
  const limit = purchaseLimit(picked)

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[auto_minmax(0,1fr)]">
      <div
        aria-label="X-Ray llamas"
        className="flex flex-wrap gap-3"
        role="listbox"
      >
        {offers.map((offer) => (
          <LlamaCard
            isPicked={offer.offerId === picked.offerId}
            key={offer.offerId}
            offer={offer}
            onPick={() => setPickedId(offer.offerId)}
            records={records}
          />
        ))}
      </div>

      <Panel>
        <PanelHeader
          actions={
            limit > 0 && (
              <span className="figure text-xs text-muted-foreground">
                {Math.min(picked.purchased, limit)}/{limit} bought
              </span>
            )
          }
          compact
          icon={Sparkles}
          title={`${name} contents`}
        />
        <PanelBody className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {picked.preroll
              ? 'Rolled for this account — X-Ray shows exactly what drops.'
              : 'Contents are not revealed for this llama.'}
          </p>
          {contents.length > 0 && (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2.5">
              {contents.map((grant, index) => (
                <ContentTile
                  grant={grant}
                  key={`${grant.templateId}-${index}`}
                  records={records}
                />
              ))}
            </ul>
          )}
          <BuyButton
            isPurchaseLocked={
              purchasingOfferId !== null &&
              purchasingOfferId !== picked.offerId
            }
            isPurchasing={purchasingOfferId === picked.offerId}
            offer={picked}
            onPurchase={() => handlePurchase({ ...picked, title: name })}
          />
        </PanelBody>
      </Panel>
    </div>
  )
}

function LlamaCard({
  isPicked,
  offer,
  onPick,
  records,
}: {
  isPicked: boolean
  offer: ShopOffer
  onPick: () => void
  records: ItemRecordMap
}) {
  const subject = offer.itemGrants[0] ?? offer.preroll?.[0]
  const art = subject
    ? resolveItemArt(subject.templateId, records, subject.portrait)
    : null
  const name = offerName(offer, records)
  const stock = stockLabel(offer)
  const soldOut = isSoldOut(offer)
  const isDiscounted = offer.finalPrice < offer.regularPrice
  /*
   * A llama has no rarity of its own worth reading, so it stands on the
   * game's blue unless the database grades it (Troll Stash is Legendary).
   */
  const wash =
    art && art.rarity !== RarityType.Common ? art.rarity : RarityType.Rare

  return (
    <button
      aria-selected={isPicked}
      className={cn(
        'group flex w-44 flex-col overflow-hidden rounded-xl text-left outline-none ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring',
        isPicked ? 'ring-2 ring-primary' : 'hover:brightness-110',
        soldOut && 'opacity-60'
      )}
      onClick={onPick}
      role="option"
      type="button"
    >
      <Artboard
        className="flex aspect-[4/5] flex-col"
        rarity={wash}
      >
        <span className="relative z-10 px-3 pt-2.5 text-ui font-bold leading-tight drop-shadow">
          {name}
        </span>
        {stock && (
          <span className={cn(overlayPill, 'relative z-10 mx-3 mt-1.5 self-start')}>
            {stock}
          </span>
        )}
        {art?.imgUrl && (
          <img
            alt=""
            className="absolute inset-x-0 bottom-0 mx-auto h-[78%] object-contain transition-transform duration-200 group-hover:scale-105"
            decoding="async"
            loading="lazy"
            src={art.largeImgUrl ?? art.imgUrl}
          />
        )}
      </Artboard>
      <span className="flex items-center justify-center gap-1.5 bg-muted/60 px-3 py-2">
        <PriceIcon
          offer={offer}
          records={records}
        />
        <span
          className={cn(
            'figure text-title font-bold leading-none',
            !offer.affordable && 'text-muted-foreground'
          )}
        >
          {offer.finalPrice.toLocaleString()}
        </span>
        {isDiscounted && (
          <s className="figure text-xs text-muted-foreground">
            {offer.regularPrice.toLocaleString()}
          </s>
        )}
      </span>
    </button>
  )
}

/** One drop in a llama: the item's card, the way the reveal screen draws it. */
function ContentTile({
  grant,
  records,
}: {
  grant: ShopGrant
  records: ItemRecordMap
}) {
  const art = resolveItemArt(grant.templateId, records, grant.portrait)
  const label = art.preferName && art.name ? art.name : grant.name

  return (
    <li
      className="flex flex-col gap-1.5"
      title={label}
    >
      <Artboard
        className="aspect-square rounded-lg"
        rarity={art.rarity}
      >
        {art.imgUrl && (
          <img
            alt=""
            className="size-full object-contain p-1"
            decoding="async"
            loading="lazy"
            src={art.imgUrl}
          />
        )}
        {grant.tier > 0 && (
          <span className={cn(itemBadge, 'figure left-1 top-1')}>
            T{grant.tier}
          </span>
        )}
        {grant.quantity > 1 && (
          <span className={cn(itemBadge, 'figure bottom-1 right-1')}>
            ×{grant.quantity.toLocaleString()}
          </span>
        )}
      </Artboard>
      <span className="line-clamp-2 text-xs font-medium leading-tight">
        {label}
      </span>
    </li>
  )
}

/**
 * An event or weekly store offer as the game's tile: the item's art on its
 * rarity, stock and quantity pinned over it, the name, and the price strip
 * that is also the Buy button.
 */
function StoreTile({
  actions,
  offer,
  records,
}: {
  actions: ShopActions
  offer: ShopOffer
  records: ItemRecordMap
}) {
  const { handlePurchase, purchasingOfferId } = actions
  const grants = offer.preroll ?? offer.itemGrants
  const subject = grants[0]
  const art = subject
    ? resolveItemArt(subject.templateId, records, subject.portrait)
    : null
  /* The quantity has its own pill, so "10 x " would say it twice. */
  const name = offerName(offer, records).replace(/^\d+\s*x\s+/i, '')
  const stock = stockLabel(offer)
  const soldOut = isSoldOut(offer)
  const isDiscounted = offer.finalPrice < offer.regularPrice

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl bg-muted/25',
        (soldOut || offer.fulfillmentOwned) && 'opacity-60'
      )}
    >
      <Artboard
        className="aspect-square"
        rarity={art?.rarity}
      >
        {art?.imgUrl && (
          <img
            alt=""
            className="size-full object-contain p-3"
            decoding="async"
            loading="lazy"
            src={art.largeImgUrl ?? art.imgUrl}
          />
        )}
        <span className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
          {stock ? <span className={overlayPill}>{stock}</span> : <span />}
          {subject && subject.quantity > 1 && (
            <span className={cn(overlayPill, 'figure')}>
              ×{subject.quantity.toLocaleString()}
            </span>
          )}
        </span>
        {grants.length > 1 && (
          <span className={cn(overlayPill, 'absolute bottom-2 right-2 z-10')}>
            +{grants.length - 1} more
          </span>
        )}
      </Artboard>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <p
          className="line-clamp-2 text-ui font-semibold leading-tight"
          title={name}
        >
          {name}
        </p>
        {isDiscounted && (
          <s className="figure -mt-1 text-xs text-muted-foreground">
            {offer.regularPrice.toLocaleString()}
          </s>
        )}
        <BuyButton
          className="mt-auto"
          currencyIcon={
            <PriceIcon
              offer={offer}
              records={records}
            />
          }
          isPurchaseLocked={
            purchasingOfferId !== null && purchasingOfferId !== offer.offerId
          }
          isPurchasing={purchasingOfferId === offer.offerId}
          offer={offer}
          onPurchase={() => handlePurchase({ ...offer, title: name })}
        />
      </div>
    </article>
  )
}
