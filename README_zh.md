<p align="center">
<img height="200" src="./assets/kv.png" alt="VSCode Fake Coding">
</p>
<p align="center"> <a href="./README.md">English</a> | 简体中文</p>

# VSCode Fake Coding

**VSCode Fake Coding** 是一个 VSCode 插件，它通过可自定义的打字速度模拟编码活动。即使你的手不在键盘上，它也能让你看起来像是在编码。激活后，它会从头开始输入当前文本内容，模拟持续的编码活动。当停用或切换到另一个文件时，它会恢复你之前的内容。

## 功能

- 通过可自定义的打字速度模拟编码活动
- 自动输入当前文本内容
- 支持 `Start`、`Start From Cursor`、`Start From Selection`、`Pause`、`Resume`、`Stop` 命令
- 支持 `steady` 和 `realistic` 两种打字节奏
- 支持从文件开头、当前光标或当前选区开始模拟输入
- 支持不同场景的 preset 命令
- 支持按时长自动停止
- 停止或切换文件时恢复原始内容
- 支持停止时不保存文件
- 易于使用和配置

## 安装

要安装此插件，请按照以下步骤操作：

1. 打开 VSCode
2. 点击窗口侧边栏中的扩展图标，或按 `Ctrl+Shift+X` 打开扩展视图
3. 搜索 `VSCode Fake Coding`
4. 点击 `安装`

或者，你可以从 [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/) 安装。

## 使用方法

要使用此插件，请按照以下步骤操作：

1. 在 VSCode 中打开一个文件
2. 从命令面板 (`Ctrl+Shift+P`) 运行 `Fake Coding: Start` 命令激活插件
3. 你也可以从更具体的范围开始：
   - `Fake Coding: Start From Cursor`
   - `Fake Coding: Start From Selection`
4. 插件会从指定范围开始输入内容
4. 你可以通过状态栏按钮或命令面板控制当前会话：
   - `Fake Coding: Pause`
   - `Fake Coding: Resume`
   - `Fake Coding: Stop`
5. 你可以通过命令面板切换 preset：
   - `Fake Coding: Use Preset - Steady`
   - `Fake Coding: Use Preset - Realistic`
   - `Fake Coding: Use Preset - Fast Demo`
   - `Fake Coding: Use Preset - Slow Review`
6. 当你停止会话或切换到其他文件时，原始内容会被恢复

## 命令

- `Fake Coding: Start`：在当前文件中开始模拟输入
- `Fake Coding: Start From Cursor`：从当前光标位置开始模拟输入
- `Fake Coding: Start From Selection`：仅在当前选区内模拟输入
- `Fake Coding: Pause`：暂停当前模拟会话
- `Fake Coding: Resume`：继续已暂停的会话
- `Fake Coding: Stop`：停止会话并恢复原始内容
- `Fake Coding: Toggle`：根据当前状态在开始、暂停、继续之间切换
- `Fake Coding: Use Preset - Steady`：应用稳定打字节奏预设
- `Fake Coding: Use Preset - Realistic`：应用更拟真的打字节奏预设
- `Fake Coding: Use Preset - Fast Demo`：应用更快的演示预设
- `Fake Coding: Use Preset - Slow Review`：应用更慢的 review 预设

## 配置

你可以通过以下配置项来自定义插件行为：

- `fake-coding.interval`：基础打字间隔，单位为毫秒
- `fake-coding.mode`：打字节奏模式，可选 `steady` 或 `realistic`
- `fake-coding.startFrom`：模拟输入起点，可选 `fileStart`、`cursor`、`selection`
- `fake-coding.autoStopMinutes`：自动停止时间，可选 `0`、`5`、`15`、`30`
- `fake-coding.saveOnStop`：恢复原始内容后是否保存文件

```json
{
  "fake-coding.interval": 200,
  "fake-coding.mode": "steady",
  "fake-coding.startFrom": "fileStart",
  "fake-coding.autoStopMinutes": 0,
  "fake-coding.saveOnStop": true
}
```

## :coffee:

[请我喝一杯咖啡](https://github.com/Simon-He95/sponsor)

## License

[MIT](./license)

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>
