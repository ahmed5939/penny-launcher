import type { ShopActions, useShopCatalog } from './-hooks'
import type {
  ShopCatalogOffer,
  ShopCatalogStorefront,
  ShopOffer,
} from '../../../kernel/core/shop'
import type { PickerOption } from '../../../components/page'

import { Compass, ExternalLink, Search, Store } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Callout,
  EmptyState,
  FilterBar,
  Panel,
  PanelBody,
  PanelHeader,
  Picker,
  SearchField,
  StatRow,
  StatTile,
} from '../../../components/page'

import { BuyButton } from './-offer-parts'

import { pennyDbLinks } from '../../../config/about/links'

function hideBrokenImage(event: { currentTarget: HTMLImageElement }) {
  event.currentTarget.style.display = 'none'
}

function formatLimits(offer: ShopCatalogOffer) {
  return (
    [
      offer.dailyLimit > 0 && `${offer.dailyLimit}/day`,
      offer.weeklyLimit > 0 && `${offer.weeklyLimit}/week`,
      offer.monthlyLimit > 0 && `${offer.monthlyLimit}/month`,
    ]
      .filter(Boolean)
      .join(' · ') || 'No purchase limit'
  )
}

export function ShopCatalog({
  accountOffers,
  actions,
  catalog: {
    catalog,
    catalogLoading,
    catalogSection,
    updateCatalogSection,
  },
  hasAccount,
}: {
  /** The selected account's own Epic offers, when loaded; Buy needs a match. */
  accountOffers: Array<ShopOffer> | null
  actions: ShopActions
  catalog: ReturnType<typeof useShopCatalog>
  hasAccount: boolean
}) {
  const { handlePurchase, purchasingOfferId } = actions
  const [search, setSearch] = useState('')

  const offersById = useMemo(
    () => new Map((accountOffers ?? []).map((offer) => [offer.offerId, offer])),
    [accountOffers]
  )

  const storefronts = catalog?.storefronts ?? []
  const storefrontOptions = useMemo<Array<PickerOption>>(
    () => [
      { label: 'All storefronts', value: 'all' },
      ...storefronts.map((storefront) => ({
        label: storefront.label,
        value: storefront.id,
      })),
    ],
    [storefronts]
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matches = (offer: ShopCatalogOffer) => {
      if (needle.length <= 0) {
        return true
      }

      return `${offer.name} ${offer.description} ${offer.templateId} ${offer.currencyLabel}`
        .toLowerCase()
        .includes(needle)
    }

    return storefronts
      .filter(
        (storefront) =>
          catalogSection === 'all' || storefront.id === catalogSection
      )
      .map((storefront) => ({
        ...storefront,
        offers: storefront.offers.filter(matches),
      }))
      .filter((storefront) => storefront.offers.length > 0)
  }, [catalogSection, search, storefronts])

  const totalOffers = storefronts.reduce(
    (count, storefront) => count + storefront.offers.length,
    0
  )

  return (
    <>
      {storefronts.length > 0 && (
        <StatRow className="lg:grid-cols-2">
          <StatTile
            icon={Store}
            label="Storefronts"
            value={storefronts.length}
          />
          <StatTile
            icon={Compass}
            label="On the shelves"
            value={totalOffers}
          />
        </StatRow>
      )}

      <Panel id="shop-catalog-card">
        <PanelHeader
          actions={
            <Button
              onClick={() =>
                window.electronAPI.openExternalURL(pennyDbLinks.stwShop)
              }
              size="sm"
              variant="ghost"
            >
              <ExternalLink className="size-3.5" />
              Penny DB
            </Button>
          }
          compact
          icon={Compass}
          title="Public catalog"
        />
        <FilterBar>
          <SearchField
            label="Search the catalog"
            onChange={setSearch}
            placeholder="Search llamas and storefronts…"
            value={search}
          />
          <Picker
            disabled={storefronts.length <= 0}
            label="Storefront"
            onChange={updateCatalogSection}
            options={storefrontOptions}
            value={
              storefrontOptions.some(
                (option) => option.value === catalogSection
              )
                ? catalogSection
                : 'all'
            }
          />
        </FilterBar>
        {catalog?.errorMessage ? (
          <PanelBody role="alert">
            <Callout
              title="Could not read the public catalog"
              tone="danger"
            >
              {catalog.errorMessage}. Try Refresh.
            </Callout>
          </PanelBody>
        ) : catalogLoading && storefronts.length <= 0 ? (
          <div role="status">
            <EmptyState
              className="border-0 bg-transparent py-8"
              description="Asking Penny DB for the current llamas and storefronts."
              icon={Compass}
              title="Loading the catalog…"
            />
          </div>
        ) : visible.length <= 0 && catalog ? (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description="Try another storefront, or clear the search."
            icon={Search}
            title="Nothing on this shelf"
          />
        ) : (
          <p className="px-5 py-2.5 text-xs text-muted-foreground">
            {hasAccount
              ? "Offers that are also in this account's Epic catalog can be bought here."
              : 'Choose an account in the title bar to buy matching offers.'}
          </p>
        )}
      </Panel>

      {visible.map((storefront) => (
        <StorefrontShelf
          hasAccount={hasAccount}
          key={storefront.id}
          offersById={offersById}
          onPurchase={handlePurchase}
          purchasingOfferId={purchasingOfferId}
          storefront={storefront}
        />
      ))}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Names, prices, limits and images come from Penny DB. Purchases go
        through this account&apos;s Epic catalog when the same offer is there —
        never through Penny DB.
      </p>

      <GoToTop containerId="shop-catalog-card" />
    </>
  )
}

function StorefrontShelf({
  hasAccount,
  offersById,
  onPurchase,
  purchasingOfferId,
  storefront,
}: {
  hasAccount: boolean
  offersById: Map<string, ShopOffer>
  onPurchase: (offer: ShopOffer) => void
  purchasingOfferId: string | null
  storefront: ShopCatalogStorefront
}) {
  return (
    <Panel>
      <PanelHeader
        actions={
          <span className="text-xs text-muted-foreground">
            <span className="figure">{storefront.offers.length}</span>{' '}
            {storefront.offers.length === 1 ? 'offer' : 'offers'}
          </span>
        }
        compact
        icon={Store}
        title={storefront.label}
      />
      <PanelBody className="grid gap-3 xl:grid-cols-2">
        {storefront.offers.map((offer) => (
          <CatalogCard
            catalogOffer={offer}
            hasAccount={hasAccount}
            isPurchaseLocked={
              purchasingOfferId !== null &&
              purchasingOfferId !== offer.offerId
            }
            isPurchasing={purchasingOfferId === offer.offerId}
            key={offer.offerId}
            mcpOffer={offersById.get(offer.offerId) ?? null}
            onPurchase={onPurchase}
          />
        ))}
      </PanelBody>
    </Panel>
  )
}

function CatalogCard({
  catalogOffer,
  hasAccount,
  isPurchaseLocked,
  isPurchasing,
  mcpOffer,
  onPurchase,
}: {
  catalogOffer: ShopCatalogOffer
  hasAccount: boolean
  isPurchaseLocked: boolean
  isPurchasing: boolean
  mcpOffer: ShopOffer | null
  onPurchase: (offer: ShopOffer) => void
}) {
  /* A store tile, the same shape as the account shop's. */
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-muted/25 p-4">
      <header className="flex items-start gap-3">
        {catalogOffer.imageUrl ? (
          <img
            alt=""
            className="size-16 shrink-0 rounded-lg bg-muted/40 object-contain p-1"
            loading="lazy"
            onError={hideBrokenImage}
            src={catalogOffer.imageUrl}
          />
        ) : (
          <div className="size-16 shrink-0 rounded-lg bg-muted/40" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-ui font-semibold leading-tight">
            {catalogOffer.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatLimits(catalogOffer)}
          </p>
          {catalogOffer.description && (
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {catalogOffer.description}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="flex items-center justify-end gap-1.5">
            {catalogOffer.currencyImageUrl && (
              <img
                alt=""
                className="size-5 object-contain"
                loading="lazy"
                onError={hideBrokenImage}
                src={catalogOffer.currencyImageUrl}
              />
            )}
            <span className="figure text-lg font-bold leading-none">
              {catalogOffer.price.toLocaleString()}
            </span>
          </p>
          {!catalogOffer.currencyImageUrl && (
            <p className="text-xs text-muted-foreground">
              {catalogOffer.currencyLabel || '—'}
            </p>
          )}
        </div>
      </header>

      <div className="mt-auto">
        {mcpOffer ? (
          <BuyButton
            isPurchaseLocked={isPurchaseLocked}
            isPurchasing={isPurchasing}
            offer={mcpOffer}
            onPurchase={() =>
              onPurchase({ ...mcpOffer, title: catalogOffer.name })
            }
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {hasAccount
              ? "View only · not in this account's catalog"
              : 'View only · pick an account to buy matching offers'}
          </p>
        )}
      </div>
    </article>
  )
}
