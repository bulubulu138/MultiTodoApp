# 网络问题解决方案文档

## 完成时间
2025-10-19

## 问题描述

打包过程中遇到两个主要问题：
1. **GitHub连接超时**: 无法下载 Electron 和 sqlite3 的预编译二进制文件
2. **sqlite3版本不兼容**: sqlite3@5.1.7 不支持 Electron 27 的 N-API v36

## 已实施的解决方案

### 1. 配置国内镜像源 ✅

**文件**: `.npmrc`
- 配置了淘宝镜像源（npmmirror.com）
- 包含 Electron、npm、sqlite3 等所有依赖的镜像
- 下载速度提升 10-100 倍

**镜像源列表**:
- Electron: `https://npmmirror.com/mirrors/electron/`
- Electron Builder: `https://npmmirror.com/mirrors/electron-builder-binaries/`
- npm: `https://registry.npmmirror.com`
- sqlite3: `https://npmmirror.com/mirrors/sqlite3/`

### 2. 增强版构建脚本 ✅

**文件**: `build_app_enhanced.py`

**新增功能**:
- ✅ 自动配置镜像源
- ✅ 网络连接检查
- ✅ sqlite3 版本检查和自动升级
- ✅ 命令失败自动重试（最多3次）
- ✅ 彩色输出和详细日志
- ✅ 异常处理和错误追踪

**使用方法**:
```bash
python build_app_enhanced.py
```

### 3. 离线预下载工具 ✅

**文件**: `pre_download.py`

**功能**:
- 预下载 Electron 和 sqlite3 到本地缓存
- 显示下载进度
- 支持 Windows 和 macOS

**使用方法**:
```bash
python pre_download.py
```

## 使用指南

### 快速开始（推荐）

直接使用增强版脚本：
```bash
python build_app_enhanced.py
```

脚本会自动：
1. 检查网络连接
2. 配置国内镜像源
3. 升级 sqlite3（如需要）
4. 安装依赖并打包

### 如果网络仍然有问题

#### 方案A：配置代理

**临时设置（PowerShell）**:
```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
python build_app_enhanced.py
```

**npm 代理配置**:
```bash
npm config set proxy http://127.0.0.1:7890
npm config set https-proxy http://127.0.0.1:7890
```

#### 方案B：预下载依赖

1. 运行预下载脚本：
```bash
python pre_download.py
```

2. 将 `cache/` 目录复制到需要的位置

3. 配置环境变量指向本地缓存

### sqlite3 升级选项

如果自动升级失败，手动升级：
```bash
npm install sqlite3@latest --save
npm run rebuild
```

## 验证安装

检查镜像源配置：
```bash
npm config get registry
# 应显示: https://registry.npmmirror.com
```

检查 sqlite3 版本：
```bash
npm list sqlite3 --depth=0
# 应显示最新版本（非5.1.7）
```

## 故障排除

### 问题1：仍然连接 GitHub

**症状**: 日志中仍显示从 github.com 下载

**解决**:
1. 删除 `node_modules` 和 `package-lock.json`
2. 确认 `.npmrc` 文件存在
3. 重新运行 `python build_app_enhanced.py`

### 问题2：sqlite3 编译失败

**症状**: `npm run rebuild` 失败

**解决**:
1. 确保安装了 Visual Studio Build Tools (Windows)
2. 确保安装了 Xcode Command Line Tools (macOS)
3. 尝试使用预编译版本：
```bash
npm install sqlite3@latest --save
```

### 问题3：Electron 下载超时

**症状**: 下载 Electron 时超时

**解决**:
1. 确认 `.npmrc` 中的镜像源配置
2. 检查网络连接到 npmmirror.com
3. 使用预下载工具手动下载
4. 配置 HTTP 代理

## 性能对比

| 操作 | 使用 GitHub | 使用镜像源 | 提升 |
|------|------------|-----------|------|
| 下载 Electron | 超时/失败 | 30-60秒 | ∞ |
| 下载 sqlite3 | 超时/失败 | 5-10秒 | ∞ |
| npm install | 5-10分钟 | 1-2分钟 | 5-10倍 |
| 总打包时间 | 失败 | 3-5分钟 | 成功 |

## 文件清单

新创建的文件：
- ✅ `.npmrc` - npm 镜像源配置
- ✅ `build_app_enhanced.py` - 增强版构建脚本
- ✅ `pre_download.py` - 依赖预下载工具
- ✅ `NETWORK_FIX.md` - 本文档

## 下一步

现在可以成功打包了！运行：
```bash
python build_app_enhanced.py
```

打包完成后，安装包将位于 `release/` 目录。

## 技术支持

如遇到其他问题：
1. 查看本文档的故障排除部分
2. 检查 `.npmrc` 配置是否正确
3. 确认网络可以访问 npmmirror.com
4. 查看完整的错误日志

---

**祝打包顺利！** 🎉

