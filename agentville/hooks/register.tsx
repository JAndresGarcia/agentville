export function register(on, options) {
  on('ui.render', { component: 'Pane', requestId: 'agentville' }, async ($, e) => {
    const { Box, Client } = $.ui.resolve(e)
    return <Box><Client key="a" module="./btns.tsx" props={{}} /></Box>
  })
  on('ui.render', { component: 'Pane', requestId: 'av-b' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return ui.Box({ children: [ui.Client({ key: 'b', module: './btns.tsx', props: {} })] })
  })
  on('ui.render', { component: 'Pane', requestId: 'av-c' }, async ($, e) => {
    const { Box, Client } = $.ui.resolve(e)
    return Box({ children: [Client({ key: 'c', module: './btns.tsx', props: {} })] })
  })
  on('ui.render', { component: 'Pane', requestId: 'av-d' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return <ui.Box><ui.Client key="d" module="./btns.tsx" props={{}} /></ui.Box>
  })
  on('ui.render', { component: 'Pane', requestId: 'av-e' }, async ($, e) => {
    return $.ui.resolve(e).Client({ key: 'e', module: './btns.tsx', props: {} })
  })
}
