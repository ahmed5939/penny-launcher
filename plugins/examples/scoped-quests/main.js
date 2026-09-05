// @ts-check
/** @type {import('../../sdk').Activate} */
async function activate(context) {
  let message = 'Select an account in Penny, then read its active quests.'
  const render = () => context.ui.register({
    panels: [{ id: 'quests', title: 'Active quests', body: message }],
    actions: [{ id: 'refresh', label: 'Read selected account quests', run: () => {
      // Start a visible cancellable job; return promptly from the UI action.
      void context.jobs.run('read-quests', 'Read selected account quests', async (signal) => {
        const { primary } = await context.accounts.getScoped()
        if (!primary) throw new Error('Select a primary account in Penny first.')
        if (signal.aborted) return
        const result = await context.accounts.quests(primary.accountId)
        if (signal.aborted) return
        if (result.errorMessage) throw new Error(result.errorMessage)
        message = `${primary.displayName}: ${result.quests.length} active quests.`
        await render()
      }).catch((error) => context.log(String(error)))
    } }],
  })
  context.events.on('account-scope-changed', () => {
    message = 'Account selection changed. Read quests to refresh the result.'
    return render()
  })
  await render()
}
module.exports = { activate }
