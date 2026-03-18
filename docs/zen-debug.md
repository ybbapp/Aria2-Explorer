# Zen Browser 调试 Aria2-Explorer 扩展指南

## 环境准备

Zen Browser 是基于 Firefox 的浏览器，所有 Firefox 扩展调试方法均适用。

下载地址：https://zen-browser.app/

安装完成后无需额外配置，直接按以下步骤加载扩展即可。

---

## 加载扩展

1. 在地址栏输入 `about:debugging#/runtime/this-firefox`，回车
2. 点击页面左侧的 **"This Firefox"**（如果尚未选中）
3. 点击 **"Load Temporary Add-on..."** 按钮
4. 在文件选择对话框中，导航到项目根目录，选择 `manifest.json`
5. 扩展加载成功后会出现在扩展列表中，显示名称为 **Aria2 Explorer**

> 临时加载的扩展在浏览器重启后会消失，需要重新加载。

---

## 调试 Background Service Worker

扩展的后台逻辑运行在 Service Worker（`background.js`）中，属于 Manifest V3 架构。

1. 打开 `about:debugging#/runtime/this-firefox`
2. 找到 **Aria2 Explorer** 扩展条目
3. 点击 **"Inspect"** 按钮
4. 浏览器会打开一个独立的开发者工具窗口，连接到该 Service Worker 的上下文
5. 在 Console 标签页中可以直接执行命令、查看日志

> Service Worker 可能处于休眠状态。点击 "Inspect" 会唤醒它。如果控制台没有响应，先点击 "Inspect" 再执行命令。

---

## 调试 Extension Pages（AriaNG / Options）

扩展页面包括：

- AriaNG 主界面：`ui/ariang/index.html`（新标签页或侧边栏）
- 选项页：`options.html`
- 弹出窗口：`ui/ariang/popup.html`

调试方法：

1. 打开对应的扩展页面（点击扩展图标或从 `about:debugging` 打开）
2. 在页面上按 `F12`，或右键点击页面空白处选择 **"检查元素"**
3. 开发者工具会附加到该页面的上下文

> AriaNG 页面和选项页共享同一个 `moz-extension://UUID/` 源下的 localStorage，可以在任意一个页面的控制台中读写。

---

## 常用调试命令

### 在 Background Service Worker 控制台中执行

查看所有已存储的扩展配置：

```js
chrome.storage.sync.get(null, r => console.log(JSON.stringify(r, null, 2)))
```

查找当前已打开的 AriaNG 标签页：

```js
chrome.tabs.query({url: chrome.runtime.getURL('ui/ariang/index.html')}).then(t => console.log(t))
```

模拟 `rpcList` 变更，测试新标签页重载逻辑（用于验证 config-sync 修复）：

```js
chrome.storage.sync.get(['rpcList'], result => {
  const current = result.rpcList || []
  chrome.storage.sync.set({ rpcList: current }, () => {
    console.log('rpcList change triggered, AriaNG tabs should reload')
  })
})
```

### 在 AriaNG 页面控制台中执行

查看 AriaNG 当前完整配置：

```js
JSON.parse(localStorage.getItem("AriaNg.Options"))
```

单独检查 RPC 主机地址：

```js
JSON.parse(localStorage.getItem("AriaNg.Options")).rpcHost
```

---

## 热重载扩展

修改代码后，不需要重新选择 `manifest.json`，直接在 `about:debugging` 中重载即可：

1. 打开 `about:debugging#/runtime/this-firefox`
2. 找到 **Aria2 Explorer** 扩展条目
3. 点击 **"Reload"** 按钮

重载后 Service Worker 会重新初始化，所有内存状态清空，`chrome.storage` 中的数据保留。

---

## 常见问题

### Service Worker 休眠，控制台无响应

Service Worker 在无活动时会自动进入休眠。解决方法：在 `about:debugging` 中点击扩展的 **"Inspect"** 按钮，这会唤醒 Service Worker 并打开调试窗口。

### 权限错误（Permission denied）

确认 `manifest.json` 中已声明所需权限。当前扩展已声明：`cookies`、`tabs`、`notifications`、`contextMenus`、`downloads`、`storage`、`scripting`、`sidePanel`、`power`。临时加载的扩展权限与正式安装相同。

### 修改选项后 AriaNG 页面没有更新 RPC 配置

这是本次修复针对的核心问题。AriaNG（AngularJS）在初始化时读取一次 `localStorage["AriaNg.Options"]` 并缓存在内存中，后续不会自动感知变化。修复方案是在 `background.js` 的 `storage.onChanged` 监听器中检测 `rpcList` 变更，然后通过 `chrome.scripting.executeScript` 强制重载已打开的 AriaNG 标签页，使其重新读取最新配置。
