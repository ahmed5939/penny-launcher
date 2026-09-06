function activate(context) {
  return {
    open: () => context.openRoute('/plugins/endurance'),
  }
}

module.exports = { activate }
