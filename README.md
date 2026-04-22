<p align="center">
<img height="200" src="./assets/kv.png" alt="VSCode Fake Coding">
</p>
<p align="center"> English | <a href="./README_zh.md">简体中文</a></p>

# VSCode Fake Coding

**VSCode Fake Coding** is a VSCode extension that simulates coding activity with customizable typing speed. It allows you to appear as if you are coding even when your hands are off the keyboard. When activated, it types out the current text content from the beginning, simulating continuous coding activity. When deactivated or when you switch to another file, it restores your previous content.

## Features

- Simulate coding activity with customizable typing speed
- Automatically types out the current text content
- Support `Start`, `Start From Cursor`, `Start From Selection`, `Start Interactive`, `Start Wander`, `Pause`, `Resume`, and `Stop` commands
- Support `steady` and `realistic` typing rhythm modes
- Support typing from the file start, current cursor, or current selection
- Support preset commands for different fake coding scenarios
- Support automatic stop after a configurable duration
- Support following your real editor switches or auto-wandering across opened file tabs
- Restore original content when stopped or when switching files
- Persist the active snapshot and restore it after an unexpected crash or reload
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
3. You can also start from a more specific range:
   - `Fake Coding: Start From Cursor`
   - `Fake Coding: Start From Selection`
4. You can also click the status bar button while idle and choose a start mode directly.
5. For more realistic interaction, you can also use:
   - `Fake Coding: Start Interactive`: follow your real editor switches
   - `Fake Coding: Start Wander`: automatically switch across opened file tabs with short pauses
6. `Follow` and `Wander` work on a smaller local activity window instead of replaying the entire file, which makes switching look more natural and avoids full-file flashing.
7. The extension will start typing out the selected range or remaining content
8. Use the status bar button or Command Palette to control the session:
   - `Fake Coding: Pause`
   - `Fake Coding: Resume`
   - `Fake Coding: Stop`
9. You can switch presets from the Command Palette:
   - `Fake Coding: Use Preset - Steady`
   - `Fake Coding: Use Preset - Realistic`
   - `Fake Coding: Use Preset - Fast Demo`
   - `Fake Coding: Use Preset - Slow Review`
10. When you stop the session or switch to another file, the original content is restored. Only one file is ever temporarily modified at a time, and dirty files are restored without being auto-saved.

## Commands

- `Fake Coding: Start`: start fake coding in the current file
- `Fake Coding: Start From Cursor`: start fake coding from the current cursor position
- `Fake Coding: Start From Selection`: start fake coding only within the current selection
- `Fake Coding: Start Interactive`: follow the file you activate manually
- `Fake Coding: Start Wander`: automatically wander across opened file tabs
- `Fake Coding: Pause`: pause the current fake coding session
- `Fake Coding: Resume`: resume the paused session
- `Fake Coding: Stop`: stop the session and restore the original content
- `Fake Coding: Toggle`: switch between start, pause, and resume based on the current state
- `Fake Coding: Use Preset - Steady`: apply a stable typing preset
- `Fake Coding: Use Preset - Realistic`: apply a more human-like typing preset
- `Fake Coding: Use Preset - Fast Demo`: apply a faster demo-oriented preset
- `Fake Coding: Use Preset - Slow Review`: apply a slower review-oriented preset

## Configuration

You can customize the extension with these settings:

- `fake-coding.interval`: base typing interval in milliseconds
- `fake-coding.mode`: typing rhythm mode, `steady` or `realistic`
- `fake-coding.startFrom`: start fake coding from `fileStart`, `cursor`, or `selection`
- `fake-coding.autoStopMinutes`: automatically stop after `0`, `5`, `15`, or `30` minutes
- `fake-coding.saveOnStop`: whether to save the file after restoring the original content
- `fake-coding.activityMinChars`: minimum local activity window size for follow and wander modes
- `fake-coding.activityMaxChars`: maximum local activity window size for follow and wander modes
- `fake-coding.wanderMinSeconds`: minimum dwell time before auto wander switches files
- `fake-coding.wanderMaxSeconds`: maximum dwell time before auto wander switches files
- `fake-coding.wanderSkipDirtyFiles`: skip already-dirty files when auto wander picks the next target
- `fake-coding.wanderAllowLanguages`: optional VS Code language IDs to allow during auto wander
- `fake-coding.wanderMaxFileChars`: skip files larger than this character count during auto wander
- `fake-coding.wanderIgnorePaths`: skip files whose paths contain any of the configured substrings during auto wander

Crash safety note: the extension stores the original content of the active fake-coding file in workspace state. If VSCode reloads or crashes mid-session, that snapshot is restored on the next activation.

```json
{
  "fake-coding.interval": 200,
  "fake-coding.mode": "steady",
  "fake-coding.startFrom": "fileStart",
  "fake-coding.autoStopMinutes": 0,
  "fake-coding.saveOnStop": true,
  "fake-coding.activityMinChars": 40,
  "fake-coding.activityMaxChars": 80,
  "fake-coding.wanderMinSeconds": 9,
  "fake-coding.wanderMaxSeconds": 18,
  "fake-coding.wanderSkipDirtyFiles": true,
  "fake-coding.wanderAllowLanguages": [],
  "fake-coding.wanderMaxFileChars": 0,
  "fake-coding.wanderIgnorePaths": []
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
