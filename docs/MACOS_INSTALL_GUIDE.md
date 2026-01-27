# macOS 安装和运行指南

## 首次安装步骤

### 1. 下载正确版本

根据你的 Mac 芯片类型下载对应的 DMG 文件：

- **Intel 芯片 Mac**（2019 年及早期）：`MultiTodo-*-x64.dmg`
- **Apple Silicon Mac**（M1/M2/M3/M4）：`MultiTodo-*-arm64.dmg`

**如何查看芯片类型**：
1. 点击屏幕左上角的 🍎 图标
2. 选择"关于本机"
3. 查看"处理器"或"芯片"信息
   - Intel 芯片显示：Intel Core i5/i7/i9 等
   - Apple Silicon 显示：M1、M2、M3、M4 等

### 2. 安装应用

1. 双击下载的 `.dmg` 文件打开
2. 将 `MultiTodo.app` 拖拽到 `Applications` 文件夹
3. 等待复制完成
4. 推出 DMG 镜像

### 3. 首次运行

由于 MultiTodo 使用 ad-hoc 签名（未购买 Apple Developer 证书），首次运行需要手动允许：

#### 方法 1：右键打开（推荐）

1. 在 Finder 中找到 `MultiTodo.app`（在 Applications 文件夹）
2. **右键点击**应用（不要双击）
3. 在弹出的菜单中选择"打开"
4. 在安全提示对话框中点击"打开"
5. ✅ 以后就可以直接双击运行了

#### 方法 2：系统设置允许

1. 尝试双击打开应用（会显示无法打开）
2. 打开"系统设置" → "隐私与安全性"
3. 向下滚动找到"MultiTodo 被阻止"的消息
4. 点击"仍要打开"
5. ✅ 应用将打开，以后可以正常运行

## 常见问题

### Q: 为什么需要这样操作？

A: Apple 要求所有分发的应用都必须使用 Apple Developer 证书签名（$99/年）。作为开源项目，MultiTodo 使用免费的 ad-hoc 签名。macOS 会拦截未签名的应用以保护用户安全，但允许用户手动允许运行。这是 macOS 的正常安全机制。

### Q: 应用是否安全？

A: ✅ 完全安全。MultiTodo 是开源项目，所有代码都在 GitHub 上公开透明。你可以：
- 查看源代码：https://github.com/bulubulu138/MultiTodoApp
- 自行构建应用
- 社区已广泛使用和验证

### Q: 提示"文件已损坏"怎么办？

A: 这通常表示下载不完整或签名有问题。尝试：
1. 删除现有的 `MultiTodo.app`
2. 重新下载 DMG 文件
3. 重新安装

### Q: 如何查看详细的错误日志？

A: 如果应用无法启动，可以从终端查看日志：

```bash
# 导航到应用目录
cd /Applications

# 运行应用并查看日志
./MultiTodo.app/Contents/MacOS/MultiTodo
```

将输出的错误信息报告到：https://github.com/bulubulu138/MultiTodoApp/issues

## 系统要求

- macOS 10.15 (Catalina) 或更高版本
- Intel 芯片（x86_64）或 Apple Silicon（arm64）
- 至少 100MB 可用磁盘空间
- 4GB RAM（推荐 8GB）

## 卸载

1. 完全退出 MultiTodo（如果正在运行）
2. 删除 `MultiTodo.app`（从 Applications 文件夹）
3. （可选）删除用户数据：
   ```bash
   rm -rf ~/Library/Application\ Support/MultiTodo
   ```
