<p align="center">
<img height="200" src="./assets/kv.png" alt="VSCode Fake Coding">
</p>
<p align="center"> <a href="./README.md">English</a> | 简体中文</p>

# VSCode Fake Coding

**VSCode Fake Coding** 是一个 VSCode 插件，它通过可自定义的打字速度模拟编码活动。即使你的手不在键盘上，它也能让你看起来像是在编码。激活后，它会从头开始输入当前文本内容，模拟持续的编码活动。当停用或切换到另一个文件时，它会恢复你之前的内容。

## 功能

- 通过可自定义的打字速度模拟编码活动
- 自动输入当前文本内容
- 停用时恢复原始内容
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
3. 插件将开始输入文件内容
4. 要停止插件，请从命令面板运行 `Fake Coding: Stop` 命令

## 配置

你可以通过在 VSCode 设置中更改 `fake-coding.interval` 设置来自定义打字速度。该值以毫秒为单位。

```json
{
  "fake-coding.interval": 200
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
