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
      lootResult?: Array<unknown>;
      mtxQuantity?: number;
      platform?: string;
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
           * The three V-Bucks currencies the profile tracks:
           *   MtxPurchased     — bought with real money, per platform
           *   MtxGiveaway      — battle pass and challenge rewards
           *   MtxComplimentary — gifts and Epic compensation
           */
          let purchased = 0;
          let earned = 0;
          let complimentary = 0;
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

            if (item.templateId === "Currency:MtxPurchased") {
              purchased += quantity;

              if (quantity > 0) {
                const platformName = `${getPlatformName(platform)} — purchased`;
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
            }
          });

          /**
           * Purchase history sits in the profile stats — every past
           * real-money purchase with its platform and bundle size.
           */
          for (const purchase of stats.attributes.mtx_purchase_history
            ?.purchases ?? []) {
            const quantity =
              purchase.totalMtxPaid ??
              purchase.quantity ??
              purchase.mtxQuantity ??
              0;

            if (quantity <= 0) {
              continue;
            }

            const platform = purchase.lootResult?.length
              ? "Store purchase"
              : `${getPlatformName(purchase.platform ?? "Unknown")} — purchased`;
            const groupKey = `history-${quantity}-${platform}`;

            sources[groupKey] ??= {
              amount: quantity,
              count: 0,
              platform: `${platform} (history)`,
              type: "purchased",
            };
            sources[groupKey].count++;
          }

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
            sources: Object.values(sources).sort((a, b) => b.amount - a.amount),
            total: purchased + earned + complimentary,
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
