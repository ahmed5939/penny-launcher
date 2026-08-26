function activate(context) {
  return {
    open: () => context.openRoute('/stw-operations/endurance'),
  }
}

module.exports = { activate }
