<p align="center">
<img height="200" src="./assets/kv.png" alt="VSCode Fake Coding">
</p>
<p align="center"> English | <a href="./README_zh.md">简体中文</a></p>

# VSCode Fake Coding

**VSCode Fake Coding** is a VSCode extension that simulates coding activity with customizable typing speed. It allows you to appear as if you are coding even when your hands are off the keyboard. When activated, it types out the current text content from the beginning, simulating continuous coding activity. When deactivated or when you switch to another file, it restores your previous content.

## Features

- Simulate coding activity with customizable typing speed
- Automatically types out the current text content
- Support `Start`, `Pause`, `Resume`, and `Stop` commands
- Support `steady` and `realistic` typing rhythm modes
- Support automatic stop after a configurable duration
- Restore original content when stopped or when switching files
- Optionally skip saving the file when stopping
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
4. Use the status bar button or Command Palette to control the session:
   - `Fake Coding: Pause`
   - `Fake Coding: Resume`
   - `Fake Coding: Stop`
5. When you stop the session or switch to another file, the original content is restored

## Commands

- `Fake Coding: Start`: start fake coding in the current file
- `Fake Coding: Pause`: pause the current fake coding session
- `Fake Coding: Resume`: resume the paused session
- `Fake Coding: Stop`: stop the session and restore the original content
- `Fake Coding: Toggle`: switch between start, pause, and resume based on the current state

## Configuration

You can customize the extension with these settings:

- `fake-coding.interval`: base typing interval in milliseconds
- `fake-coding.mode`: typing rhythm mode, `steady` or `realistic`
- `fake-coding.autoStopMinutes`: automatically stop after `0`, `5`, `15`, or `30` minutes
- `fake-coding.saveOnStop`: whether to save the file after restoring the original content

```json
{
  "fake-coding.interval": 200,
  "fake-coding.mode": "steady",
  "fake-coding.autoStopMinutes": 0,
  "fake-coding.saveOnStop": true
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
