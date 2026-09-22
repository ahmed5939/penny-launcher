// @ts-check
/** @type {import('../../sdk').Activate} */
async function activate(context) {
  /** @param {string} title @param {string} body */
  const show = async (title, body) => context.ui.register({
    panels: [{ id: 'showcase', title, body: body.slice(0, 4000) }],
    actions: [
      { id: 'progress', label: 'Show STW progress', run: () => run('campaign') },
      { id: 'cosmetics', label: 'Show cosmetic counts', run: () => run('athena') },
      { id: 'locker', label: 'Show equipped locker', run: () => run('locker') },
    ],
  })
  /** @param {'campaign' | 'athena' | 'locker'} kind */
  function run(kind) {
    void context.jobs.run('showcase', 'Read account showcase', async (signal) => {
      const { primary } = await context.accounts.getScoped()
      if (!primary) throw new Error('Select an account first.')
      if (kind === 'locker') {
        const result = await context.eos.locker(primary.accountId)
        if (!signal.aborted) await show(primary.displayName, JSON.stringify(result.activeLoadoutGroup, null, 2))
      } else {
        const profile = await context.mcp.queryProfile(primary.accountId, kind)
        /** @type {Record<string, number>} */
        const counts = {}
        for (const item of Object.values(profile.items)) {
          const category = item.templateId.split(':')[0]
          counts[category] = (counts[category] || 0) + 1
        }
        if (!signal.aborted) await show(primary.displayName, JSON.stringify({ profile: kind, stats: profile.stats.attributes, itemCounts: counts }, null, 2))
      }
    })
  }
  await show('Account Showcase', 'Select an account, then choose a view. Reads are limited to one every two seconds. This add-on cannot change your account.')
}
module.exports = { activate }
