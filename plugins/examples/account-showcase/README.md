# Account Showcase

Import this folder in Penny's Add-ons page. Requires API v5. Review the requested
account, game-profile, EOS-locker, and UI permissions. Select an account, then use
**Show STW progress**, **Show cosmetic counts**, or **Show equipped locker**.

This example requests only `campaign`/`athena` profile reads and EOS locker reads.
It has no command permission and runs only when you press an action. Wait at
least two seconds between reads. Job failures appear on the add-on card.

The host filters private and unknown fields. The display truncates to 4,000
characters; it is an example of using the API, not a full inventory browser.
Source: [Fortnite API guide](../../FORTNITE.md).

```sh
npm run plugin:validate -- plugins/examples/account-showcase
```
