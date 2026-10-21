export function register(on, options) {
  on('ui.render', { component: 'Pane', requestId: 'agentville' }, async ($, e) => {
    const { Box, Client } = $.ui.resolve(e)
    return <Box><Client key="hits" module="./btns.tsx" props={{}} /></Box>
  })
}
