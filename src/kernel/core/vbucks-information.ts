import { RuntimeLog } from "../runtime-log";
import type { MCPQueryProfileMainProfile } from "../../types/services/mcp";
import type { AccountData } from "../../types/accounts";

import { ElectronAPIEventKeys } from "../../config/constants/main-process";

import { MainWindow } from "../startup/windows/main";
import { Authentication } from "./authentication";

import {
  VBucksInformationBreakdown,
  VBucksInformationCurrency,
  VBucksInformationSource,
  VBucksInformationState,
} from "../../state/management/vbucks-information";

import { getQueryProfileMainProfile } from "../../services/endpoints/mcp";

const PLATFORM_NAMES: Record<string, string> = {
  ANDROID: "Android",
  EpicPC: "Epic Games",
  EpicPCKorea: "Epic Games (Korea)",
  IOS: "iOS",
  Nintendo: "Nintendo Switch",
  PSN: "PlayStation",
  Shared: "Shared",
  XBL: "Xbox",
};

function getPlatformName(platform: string): string {
  return PLATFORM_NAMES[platform] ?? platform;
}

/**
 * The common_core stats payload carries more V-Bucks fields than the strict
 * endpoint type models (`mtx_affiliate`, purchase history, gift allowance).
 * This is the loose view the breakdown parser actually reads.
 */
type MainProfileStats = {
  allowed_to_send_gifts?: boolean;
  current_mtx_platform?: string;
  gift_history?: { num_gifts_remaining?: number };
  mtx_affiliate?: string | null;
  mtx_affiliate_set_time?: string | null;
  mtx_platform?: string;
  mtx_purchase_history?: {
    purchases?: Array<{
      appStore?: string;
      lootResult?: Array<{
        itemType?: string;
        quantity?: number;
      }>;
      mtxQuantity?: number;
      platform?: string;
      purchaseDate?: string;
      quantity?: number;
      totalMtxPaid?: number;
    }>;
  };
};

type MainProfileItem = {
  attributes?: { platform?: string };
  quantity?: number;
  templateId?: string;
};

export class VBucksInformation {
  static async requestBulkInfo(accounts: Array<AccountData>) {
    const results = await Promise.all(
      accounts.map(async (account) => {
        try {
          const data = await VBucksInformation.getInfo(account);

          if (!data) {
            return null;
          }

          const items = Object.entries(
            data.profileChanges[0]?.profile.items ?? {},
          );

          const currency: Record<string, VBucksInformationCurrency> = {};

          /**
           * The V-Bucks currencies the profile tracks:
           *   MtxPurchased     — bought with real money, per platform
           *   MtxPurchaseBonus — bonus granted alongside a purchase
           *   MtxGiveaway      — battle pass and challenge rewards
           *   MtxComplimentary — gifts and Epic compensation
           *
           * Epic adds templates over time, so `total` is the sum of every
           * `Currency:` item rather than of the buckets below — the balance a
           * card shows can never disagree with the rows it lists, and an
           * unmapped currency still lands in `sources` under its own name.
           */
          let purchased = 0;
          let earned = 0;
          let complimentary = 0;
          let total = 0;
          const sources: Record<string, VBucksInformationSource> = {};

          const stats = (data.profileChanges[0]?.profile.stats ?? {
            attributes: {},
          }) as { attributes: MainProfileStats };

          items.forEach(([itemId, rawItem]) => {
            const item = rawItem as unknown as MainProfileItem;

            if (!item.templateId?.startsWith("Currency:")) {
              return;
            }

            currency[itemId] = {
              platform: item.attributes?.platform ?? "Unknown",
              quantity: item.quantity ?? 0,
              template: item.templateId.replace("Currency:Mtx", ""),
            };

            const quantity = item.quantity ?? 0;
            const platform = item.attributes?.platform ?? "Unknown";

            total += quantity;

            if (
              item.templateId === "Currency:MtxPurchased" ||
              item.templateId === "Currency:MtxPurchaseBonus"
            ) {
              purchased += quantity;

              if (quantity > 0) {
                const suffix =
                  item.templateId === "Currency:MtxPurchaseBonus"
                    ? "purchase bonus"
                    : "purchased";
                const platformName = `${getPlatformName(platform)} — ${suffix}`;
                const groupKey = `${quantity}-${platformName}`;

                sources[groupKey] ??= {
                  amount: quantity,
                  count: 0,
                  platform: platformName,
                  type: "purchased",
                };
                sources[groupKey].count++;
              }
            } else if (item.templateId === "Currency:MtxGiveaway") {
              earned += quantity;

              if (quantity > 0) {
                sources["earned"] ??= {
                  amount: 0,
                  count: 0,
                  platform: "Battle pass & challenges",
                  type: "earned",
                };
                sources["earned"].amount += quantity;
                sources["earned"].count++;
              }
            } else if (item.templateId === "Currency:MtxComplimentary") {
              complimentary += quantity;

              if (quantity > 0) {
                sources["complimentary"] ??= {
                  amount: 0,
                  count: 0,
                  platform: "Complimentary & gifts",
                  type: "complimentary",
                };
                sources["complimentary"].amount += quantity;
                sources["complimentary"].count++;
              }
            } else if (quantity > 0) {
              /*
               * A currency template this build does not know about. It is not
               * claimed by any of the three tiles, but it is part of the
               * balance, so it has to be visible in the list under whatever
               * Epic calls it.
               */
              const platformName = `${getPlatformName(
                platform,
              )} ${item.templateId.replace("Currency:Mtx", "")}`.trim();
              const groupKey = `other-${platformName}`;

              sources[groupKey] ??= {
                amount: 0,
                count: 0,
                platform: platformName,
                type: "earned",
              };
              sources[groupKey].amount += quantity;
              sources[groupKey].count++;
            }
          });

          /**
           * Full purchase history — every real-money V-Bucks purchase the
           * profile records. The granted bundle size comes from the
           * loot result's currency grant when present, falling back to
           * whatever amount field the record carries.
           */
          const purchaseHistory = (stats.attributes.mtx_purchase_history
            ?.purchases ?? [])
            .map((purchase) => {
              const currencyGrant = purchase.lootResult?.find((entry) =>
                entry.itemType?.startsWith("Currency:Mtx"),
              );

              const amount =
                currencyGrant?.quantity ??
                purchase.totalMtxPaid ??
                purchase.quantity ??
                purchase.mtxQuantity ??
                0;

              return {
                amount,
                date: purchase.purchaseDate ?? null,
                platform:
                  purchase.platform ?? purchase.appStore ?? null,
              };
            })
            .filter((purchase) => purchase.amount > 0)
            .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

          const breakdown: VBucksInformationBreakdown = {
            complimentary,
            creatorCode: stats.attributes.mtx_affiliate ?? null,
            creatorSetTime: stats.attributes.mtx_affiliate_set_time ?? null,
            currentPlatform: getPlatformName(
              stats.attributes.current_mtx_platform ??
                stats.attributes.mtx_platform ??
                "EpicPC",
            ),
            earned,
            giftsAllowed: stats.attributes.allowed_to_send_gifts !== false,
            giftsRemaining:
              stats.attributes.gift_history?.num_gifts_remaining ?? null,
            purchased,
            purchaseCount: purchaseHistory.length,
            purchaseHistory,
            sources: Object.values(sources).sort((a, b) => b.amount - a.amount),
            total,
          };

          const accountCurrency: VBucksInformationState["data"] = {
            [account.accountId]: {
              accountId: account.accountId,
              breakdown,
              currency,
            },
          };

          accountCurrency[account.accountId].currency = Object.entries(
            accountCurrency[account.accountId].currency,
          )
            .toSorted(([, itemA], [, itemB]) => itemB.quantity - itemA.quantity)
            .reduce(
              (accumulator, [templateId, current]) => {
                accumulator[templateId] = current;

                return accumulator;
              },
              {} as Record<string, VBucksInformationCurrency>,
            );

          return accountCurrency[account.accountId];
        } catch (error) {
          RuntimeLog.error("caught:core/vbucks-information:parse", error);

          return null;
        }
      }),
    );

    const response = results.reduce<VBucksInformationState["data"]>(
      (accumulator, result) => {
        if (result) {
          accumulator[result.accountId] = result;
        }

        return accumulator;
      },
      {},
    );

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.VBucksInformationResponseData,
      response,
    );
  }

  static async getInfo(account: AccountData) {
    let result: MCPQueryProfileMainProfile | null = null;

    try {
      const accessToken = await Authentication.verifyAccessToken(account);

      if (!accessToken) {
        return null;
      }

      const response = await getQueryProfileMainProfile({
        accessToken,
        accountId: account.accountId,
      });

      result = response.data;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error("caught:core/vbucks-information.ts", error);
    }

    return result;
  }
}
