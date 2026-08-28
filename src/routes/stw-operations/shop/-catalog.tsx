import type {
  ShopCatalogOffer,
  ShopCatalogStorefront,
  ShopOffer,
} from '../../../kernel/core/shop'
import type { SegmentedOption } from '../../../components/page'

import { UpdateIcon } from '@radix-ui/react-icons'
import { Compass, ExternalLink, RefreshCw, Search, Store } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { Input } from '../../../components/ui/input'
import {
  Callout,
  Chip,
  EmptyState,
  Panel,
  PanelBody,
  PanelHeader,
  Segmented,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useShopCatalog } from './-hooks'

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

export function ShopCatalog() {
  const {
    account,
    catalog,
    catalogLoading,
    catalogSection,
    handleLoadCatalog,
    handlePurchase,
    offersById,
    purchasingOfferId,
    updateCatalogSection,
  } = useShopCatalog()

  const [search, setSearch] = useState('')

  const storefronts = catalog?.storefronts ?? []
  const sectionOptions = useMemo<Array<SegmentedOption<string>>>(
    () => [
      { label: 'All', value: 'all' },
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
      <Panel id="shop-catalog-card">
        <PanelHeader
          compact
          as="div"
          title="Public catalog"
          actions={
            <>
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
              <Button
                disabled={catalogLoading}
                onClick={handleLoadCatalog}
                size="sm"
                variant="ghost"
              >
                {catalogLoading ? (
                  <UpdateIcon className="animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="size-3.5" />
                    Refresh
                  </>
                )}
              </Button>
            </>
          }
        />
        <PanelBody className="space-y-3">
          <Callout
            title="Read-only catalog"
            tone="info"
          >
            Names, prices, limits and images come from Penny DB. Purchases still
            go through this account's Epic catalog when the same offer is there
            — never through Penny DB.
          </Callout>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search llamas and storefronts…"
              value={search}
            />
          </div>
        </PanelBody>
      </Panel>

      {catalog?.errorMessage && (
        <Callout
          title="Could not read the public catalog"
          tone="danger"
        >
          {catalog.errorMessage}
        </Callout>
      )}

      {storefronts.length > 0 && (
        <>
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

          <Segmented
            onChange={updateCatalogSection}
            options={sectionOptions}
            value={catalogSection}
          />
        </>
      )}

      {catalogLoading && storefronts.length <= 0 ? (
        <EmptyState
          description="Asking Penny DB for the current llamas and storefronts."
          icon={Compass}
          title="Loading catalog"
        />
      ) : visible.length > 0 ? (
        <div className="space-y-6">
          {visible.map((storefront) => (
            <StorefrontShelf
              hasAccount={account !== null}
              key={storefront.id}
              offersById={offersById}
              onPurchase={handlePurchase}
              purchasingOfferId={purchasingOfferId}
              storefront={storefront}
            />
          ))}
        </div>
      ) : catalog && !catalog.errorMessage ? (
        <EmptyState
          description="Try another shelf, or clear the search."
          icon={Store}
          title="Nothing on this shelf"
        />
      ) : null}

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
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{storefront.label}</h2>
        <span className="text-[0.65rem] text-muted-foreground">
          {storefront.offers.length}
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
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
      </div>
    </section>
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
  const soldOut =
    mcpOffer !== null &&
    (mcpOffer.dailyLimit || mcpOffer.weeklyLimit || mcpOffer.monthlyLimit) >
      0 &&
    mcpOffer.purchased >=
      (mcpOffer.dailyLimit || mcpOffer.weeklyLimit || mcpOffer.monthlyLimit)

  return (
    <Panel>
      <header className="flex items-start gap-3 border-b border-border/60 px-4 py-3">
        {catalogOffer.imageUrl ? (
          <img
            alt=""
            className="size-14 shrink-0 rounded-md bg-muted/40 object-contain p-1"
            loading="lazy"
            onError={hideBrokenImage}
            src={catalogOffer.imageUrl}
          />
        ) : (
          <div className="size-14 shrink-0 rounded-md bg-muted/40" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-medium">
            {catalogOffer.name}
          </p>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {formatLimits(catalogOffer)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums">
            {catalogOffer.currencyImageUrl && (
              <img
                alt=""
                className="size-4 object-contain"
                loading="lazy"
                onError={hideBrokenImage}
                src={catalogOffer.currencyImageUrl}
              />
            )}
            {catalogOffer.price.toLocaleString()}
          </p>
          <p className="text-[0.6rem] text-muted-foreground">
            {catalogOffer.currencyLabel || '—'}
          </p>
        </div>
      </header>

      <PanelBody className="space-y-3">
        {catalogOffer.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {catalogOffer.description}
          </p>
        )}

        {mcpOffer ? (
          <Button
            className="w-full"
            disabled={
              isPurchaseLocked ||
              isPurchasing ||
              !mcpOffer.affordable ||
              soldOut ||
              mcpOffer.currency === 'RealMoney'
            }
            onClick={() => onPurchase({ ...mcpOffer, title: catalogOffer.name })}
            size="sm"
            variant={mcpOffer.affordable ? 'default' : 'secondary'}
          >
            {isPurchasing ? (
              <UpdateIcon className="animate-spin" />
            ) : soldOut ? (
              'Purchased · limit reached'
            ) : mcpOffer.currency === 'RealMoney' ? (
              'Real money only'
            ) : mcpOffer.affordable ? (
              `Buy for ${mcpOffer.finalPrice.toLocaleString()} ${mcpOffer.currencyLabel}`
            ) : (
              `Not enough ${mcpOffer.currencyLabel}`
            )}
          </Button>
        ) : (
          <Chip className="w-fit">
            {hasAccount
              ? "View only · not in this account's catalog"
              : 'View only · pick an account to buy matching offers'}
          </Chip>
        )}
      </PanelBody>
    </Panel>
  )
}
