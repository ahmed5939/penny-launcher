// @ts-check
/** @type {import('../../sdk').Activate} */
async function activate(context) {
  await context.ui.register({
    panels: [{ id: 'about', title: 'Review common items', body: 'Find up to 50 unlocked common items in your selected account. Penny asks you to confirm the exact items before permanent recycling.' }],
    actions: [{ id: 'review', label: 'Review recycling', run: () => {
      // Return immediately: the host review can take longer than the action timeout.
      void context.jobs.run('recycle-review', 'Review common items', async (signal) => {
        const { primary } = await context.accounts.getScoped()
        if (!primary) throw new Error('Select an account in Penny first.')
        const entry = await context.inventory.read(primary.accountId)
        const ids = entry.items.filter((item) => item.rarity === 'common' && item.lockedReason === null)
          .slice(0, 50).map((item) => item.itemId)
        if (signal.aborted) return
        if (!ids.length) { await context.log('No unlocked common items found.'); return }
        const result = await context.inventory.recycle(primary.accountId, ids)
        await context.log(result.cancelled ? 'Review cancelled.' : `Recycled ${result.recycled}; skipped ${result.skipped}.`)
      })
    } }],
  })
}
module.exports = { activate }
