import { createBottomBar, createExtension, registerCommand } from '@vscode-use/utils'

export = createExtension(() => {
  let isOpen = false
  const bar = createBottomBar({
    text: `Fake Coding ${isOpen ? '✅' : '❎'}`,
    command: 'fake-coding.toggle',
    position: 'left',
    offset: 500,
  })
  bar.show()
  registerCommand('fake-coding.toggle', () => {
    isOpen = !isOpen
    bar.text = `Fake Coding ${isOpen ? '✅' : '❎'}`
  })
}, () => {

})
