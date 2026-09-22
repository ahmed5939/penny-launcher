# Inventory Review

Requires Penny API v5. Import this folder through Add-ons, review its permissions,
then select an account and choose **Review recycling** on the add-on card.

The example reads the primary selected account and selects up to 50 unlocked
common items. Penny shows the account and exact items in a native confirmation.
Recycling is permanent. Cancel is the default; favorites and equipped items are
protected and the host checks inventory again after review.

Permissions: account selection, inventory reads, confirmed inventory recycling,
and an add-on UI action. No credentials, raw profiles, direct network, filesystem,
or process access. Nothing runs automatically. Job status and diagnostics appear
on the add-on card. Wait 30 seconds between recycling requests.

Validate without executing the example:

```sh
npm run plugin:validate -- plugins/examples/inventory-review
```
