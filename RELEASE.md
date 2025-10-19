# 多功能待办应用 - 发布说明

## 📦 构建安装包

### Windows

**方式1：使用Python脚本（推荐）**
```bash
python build_app.py
```

**方式2：使用批处理文件**
```bash
build_installer.bat
```

### macOS

```bash
python3 build_app.py
```

## 📍 数据存储位置

### Windows
```
C:\Users\<用户名>\AppData\Roaming\多功能待办\todo_app.db
```

### macOS
```
~/Library/Application Support/多功能待办/todo_app.db
```

## 🔒 数据安全保证

### 1. 持久化存储
- 使用 Electron 官方推荐的 `app.getPath('userData')` 路径
- 数据存储在用户目录，与应用程序分离
- 升级时数据自动保留，无需手动备份

### 2. 卸载保护
- **Windows**: 卸载时会弹出对话框，询问是否删除用户数据
  - 选择「是」：永久删除所有待办数据
  - 选择「否」：保留数据，下次安装可继续使用
- **macOS**: 卸载应用不会删除用户数据，需手动删除数据目录

### 3. 数据库迁移
- 数据库表使用 `IF NOT EXISTS` 创建
- 升级时自动检测并保留现有数据
- 支持无缝升级，不会丢失任何数据

### 4. 数据查看
- 在应用「设置」中可查看数据库路径
- 点击「打开数据文件夹」可直接访问数据目录
- 支持复制路径，方便备份

## 📦 安装包说明

### Windows (NSIS)
- 文件名格式：`多功能待办-1.0.0-x64-setup.exe`
- 大小：约 150-200 MB
- 支持架构：x64
- 功能：
  - ✅ 自定义安装目录
  - ✅ 创建桌面快捷方式
  - ✅ 添加到开始菜单
  - ✅ 卸载时询问是否删除数据

### macOS (DMG)
- 文件名格式：
  - `多功能待办-1.0.0-x64.dmg` (Intel Mac)
  - `多功能待办-1.0.0-arm64.dmg` (Apple Silicon)
- 大小：约 150-200 MB
- 安装方式：拖拽到 Applications 文件夹

## 🔄 版本升级流程

### 用户升级步骤
1. 下载新版本安装包
2. 运行安装程序
3. 如有提示，选择「升级」而非「卸载后重装」
4. 安装完成后，数据自动保留

### 开发者发布步骤
1. 修改 `package.json` 中的版本号
2. 运行构建脚本生成新版安装包
3. 测试升级流程
4. 发布到 GitHub Releases 或其他渠道

## 🛠️ 构建要求

### 系统要求
- **Windows**: Windows 10 或更高版本
- **macOS**: macOS 10.13 或更高版本

### 开发工具
- Node.js 18+
- npm 8+
- Python 3.7+
- electron-builder 24+

### 首次构建
```bash
# 1. 克隆项目
git clone <repository-url>
cd MultiTodoApp

# 2. 安装依赖
npm install

# 3. 重新编译 native 模块
npm run rebuild

# 4. 构建应用
npm run build

# 5. 打包安装程序
python build_app.py
```

## 📝 注意事项

### Windows
1. 首次构建需要安装 Visual Studio Build Tools
2. electron-rebuild 需要 Python 2.7 或 3.x
3. 如遇到 sqlite3 编译错误，运行 `npm run rebuild`

### macOS
1. 需要安装 Xcode Command Line Tools
2. 如需签名，配置 `build.mac.identity`
3. 如需公证，配置 Apple Developer 账号

### 图标文件
当前使用临时图标，建议使用专业工具设计：
- Windows: 256x256 的 .ico 文件
- macOS: 512x512 的 .icns 文件
- 可使用 `assets/create_icons.py` 生成基础图标

## 🐛 常见问题

### Q: 构建失败，提示 sqlite3 错误
A: 运行 `npm run rebuild` 重新编译 native 模块

### Q: Windows 安装包无法运行
A: 检查是否被防病毒软件拦截，或使用管理员权限运行

### Q: macOS 提示「无法打开」
A: 在「系统偏好设置 > 安全性与隐私」中允许运行

### Q: 升级后数据丢失
A: 检查旧版本是否正确安装在用户目录，而非临时目录

## 📧 技术支持

如有问题，请：
1. 查看本文档的常见问题部分
2. 在 GitHub Issues 中提交问题
3. 提供详细的错误信息和日志

## 📄 许可证

MIT License - 详见 LICENSE 文件

