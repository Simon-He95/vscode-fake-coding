<p align="center">
<img height="200" src="./assets/kv.png" alt="VSCode Fake Coding">
</p>
<p align="center"> English | <a href="./README_zh.md">简体中文</a></p>

# VSCode Fake Coding

**VSCode Fake Coding** is a VSCode extension that simulates coding activity with customizable typing speed. It allows you to appear as if you are coding even when your hands are off the keyboard. When activated, it types out the current text content from the beginning, simulating continuous coding activity. When deactivated or when you switch to another file, it restores your previous content.

## Features

- Simulate coding activity with customizable typing speed
- Automatically types out the current text content
- Restores original content when deactivated
- Easy to use and configure

## Installation

To install the extension, follow these steps:

1. Open VSCode
2. Go to the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of the window or by pressing `Ctrl+Shift+X`
3. Search for `VSCode Fake Coding`
4. Click `Install`

Alternatively, you can install it from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/).

## Usage

To use the extension, follow these steps:

1. Open a file in VSCode
2. Activate the extension by running the `Fake Coding: Start` command from the Command Palette (`Ctrl+Shift+P`)
3. The extension will start typing out the content of the file
4. To stop the extension, run the `Fake Coding: Stop` command from the Command Palette

## Configuration

You can customize the typing speed by changing the `fake-coding.interval` setting in your VSCode settings. The value is in milliseconds.

```json
{
  "fake-coding.interval": 200
}
```

## :coffee:

[buy me a cup of coffee](https://github.com/Simon-He95/sponsor)

## License

[MIT](./license)

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>
