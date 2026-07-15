# 桌面端同步功能实现指南

**目标读者：** 桌面端开发者  
**预计完成时间：** 3-4天  
**前置条件：** 熟悉Electron、Node.js、TypeScript

---

## 概述

本指南详细说明如何在桌面端（Electron）实现局域网同步功能，与移动端协同工作。

### 架构概览

```
桌面端新增组件：
├── src/main/services/
│   ├── SyncServer.ts          (TCP服务器，监听53318端口)
│   ├── DeviceDiscovery.ts     (UDP广播，端口53317)
│   └── SyncManager.ts         (智能合并逻辑)
├── src/main/preload.ts        (新增IPC handlers)
├── src/renderer/components/
│   ├── SyncModal.tsx          (同步主界面)
│   ├── DeviceList.tsx         (设备列表)
│   └── PairingCodeDisplay.tsx (配对码显示)
```

---

## 第一步：安装依赖

```bash
# 无需新增依赖，使用Node.js内置模块
# - net (TCP服务器)
# - dgram (UDP多播)
# - crypto (SHA256哈希)
```

---

## 第二步：实现 SyncServer.ts

创建文件：`src/main/services/SyncServer.ts`

```typescript
/**
 * SyncServer - TCP服务器，处理移动端连接和同步请求
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface SyncMessage {
  type: string;
  [key: string]: any;
}

export class SyncServer extends EventEmitter {
  private server: net.Server | null = null;
  private clients = new Map<string, net.Socket>();
  private currentPairingCode: string | null = null;
  private pairingExpiry: number | null = null;
  private readonly PORT = 53318;

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (error) => {
        console.error('Sync server error:', error);
        this.emit('error', error);
      });

      this.server.listen(this.PORT, '0.0.0.0', () => {
        console.log(`Sync server listening on port ${this.PORT}`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // 关闭所有客户端连接
    for (const socket of this.clients.values()) {
      socket.destroy();
    }
    this.clients.clear();

    console.log('Sync server stopped');
  }

  /**
   * 处理新连接
   */
  private handleConnection(socket: net.Socket): void {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log('Client connected:', clientId);

    this.clients.set(clientId, socket);

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // 处理完整的消息（以换行符分隔）
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const message = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);

        if (message.trim()) {
          this.handleMessage(message, socket, clientId);
        }
      }
    });

    socket.on('close', () => {
      console.log('Client disconnected:', clientId);
      this.clients.delete(clientId);
      this.emit('client-disconnected', clientId);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.clients.delete(clientId);
    });
  }

  /**
   * 处理消息
   */
  private handleMessage(message: string, socket: net.Socket, clientId: string): void {
    try {
      const data: SyncMessage = JSON.parse(message);
      console.log('Message received:', data.type);

      switch (data.type) {
        case 'connect':
          this.handleConnectRequest(data, socket);
          break;
        case 'pairing-code':
          this.handlePairingCode(data, socket);
          break;
        case 'sync-request':
          this.handleSyncRequest(data, socket);
          break;
        case 'file':
          this.handleFileReceived(data, socket);
          break;
        case 'file-ack':
          this.handleFileAck(data);
          break;
        case 'sync-complete':
          this.handleSyncComplete(data);
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }

      // 触发事件，让主进程处理
      this.emit('message', data, socket, clientId);
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  /**
   * 处理连接请求
   */
  private handleConnectRequest(data: SyncMessage, socket: net.Socket): void {
    // 生成6位配对码
    this.currentPairingCode = this.generatePairingCode();
    this.pairingExpiry = Date.now() + 5 * 60 * 1000; // 5分钟过期

    console.log('Generated pairing code:', this.currentPairingCode);

    // 发送配对码要求
    this.sendMessage(socket, {
      type: 'pairing-required',
      code: this.currentPairingCode,
      expiresAt: this.pairingExpiry,
    });

    // 通知UI显示配对码
    this.emit('pairing-code-generated', {
      code: this.currentPairingCode,
      deviceName: data.deviceName,
      deviceId: data.deviceId,
    });
  }

  /**
   * 处理配对码验证
   */
  private handlePairingCode(data: SyncMessage, socket: net.Socket): void {
    const now = Date.now();

    if (!this.currentPairingCode || !this.pairingExpiry) {
      this.sendMessage(socket, {
        type: 'pairing-failed',
        reason: 'no-code-generated',
      });
      return;
    }

    if (now > this.pairingExpiry) {
      this.sendMessage(socket, {
        type: 'pairing-failed',
        reason: 'expired',
      });
      this.currentPairingCode = null;
      this.pairingExpiry = null;
      return;
    }

    if (data.code !== this.currentPairingCode) {
      this.sendMessage(socket, {
        type: 'pairing-failed',
        reason: 'invalid-code',
      });
      return;
    }

    // 配对成功
    this.sendMessage(socket, {
      type: 'pairing-success',
    });

    this.currentPairingCode = null;
    this.pairingExpiry = null;

    this.emit('pairing-success');
  }

  /**
   * 处理同步请求
   */
  private handleSyncRequest(data: SyncMessage, socket: net.Socket): void {
    // 触发事件，让SyncManager处理
    this.emit('sync-request', data, socket);
  }

  /**
   * 处理接收到的文件
   */
  private handleFileReceived(data: SyncMessage, socket: net.Socket): void {
    this.emit('file-received', data, socket);
  }

  /**
   * 处理文件确认
   */
  private handleFileAck(data: SyncMessage): void {
    this.emit('file-ack', data);
  }

  /**
   * 处理同步完成
   */
  private handleSyncComplete(data: SyncMessage): void {
    this.emit('sync-complete', data);
  }

  /**
   * 发送消息
   */
  sendMessage(socket: net.Socket, message: SyncMessage): void {
    try {
      const json = JSON.stringify(message);
      socket.write(json + '\n');
      console.log('Message sent:', message.type);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  /**
   * 生成6位配对码
   */
  private generatePairingCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 广播消息给所有客户端
   */
  broadcast(message: SyncMessage): void {
    for (const socket of this.clients.values()) {
      this.sendMessage(socket, message);
    }
  }

  /**
   * 检查服务器是否运行
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}
```

---

## 第三步：实现 DeviceDiscovery.ts

创建文件：`src/main/services/DeviceDiscovery.ts`

```typescript
/**
 * DeviceDiscovery - UDP多播设备发现
 */

import * as dgram from 'dgram';
import { EventEmitter } from 'events';

export class DeviceDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private readonly PORT = 53317;
  private readonly MULTICAST_ADDRESS = '239.255.42.99';
  private readonly BROADCAST_INTERVAL = 2000; // 每2秒广播一次

  private deviceInfo = {
    deviceId: '',
    deviceName: '',
    deviceType: 'desktop' as const,
    appVersion: '1.0.0',
    port: 53318,
  };

  /**
   * 初始化设备信息
   */
  initialize(deviceId: string, deviceName: string): void {
    this.deviceInfo.deviceId = deviceId;
    this.deviceInfo.deviceName = deviceName;
  }

  /**
   * 开始广播
   */
  async startBroadcasting(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', (error) => {
        console.error('UDP socket error:', error);
        this.stopBroadcasting();
        reject(error);
      });

      this.socket.bind(this.PORT, () => {
        if (!this.socket) return;

        this.socket.setBroadcast(true);
        this.socket.setMulticastTTL(128);
        this.socket.addMembership(this.MULTICAST_ADDRESS);

        console.log(`Broadcasting on ${this.MULTICAST_ADDRESS}:${this.PORT}`);

        // 开始定时广播
        this.broadcastInterval = setInterval(() => {
          this.broadcast();
        }, this.BROADCAST_INTERVAL);

        // 立即广播一次
        this.broadcast();

        resolve();
      });
    });
  }

  /**
   * 停止广播
   */
  stopBroadcasting(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    console.log('Stopped broadcasting');
  }

  /**
   * 广播设备信息
   */
  private broadcast(): void {
    if (!this.socket) return;

    const message = JSON.stringify({
      type: 'discover',
      ...this.deviceInfo,
      ip: this.getLocalIP(),
      timestamp: Date.now(),
    });

    const buffer = Buffer.from(message);

    this.socket.send(
      buffer,
      0,
      buffer.length,
      this.PORT,
      this.MULTICAST_ADDRESS,
      (error) => {
        if (error) {
          console.error('Failed to broadcast:', error);
        }
      }
    );
  }

  /**
   * 获取本机IP地址
   */
  private getLocalIP(): string {
    const os = require('os');
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }

    return '127.0.0.1';
  }

  /**
   * 检查是否正在广播
   */
  isBroadcasting(): boolean {
    return this.socket !== null && this.broadcastInterval !== null;
  }
}
```

---

## 第四步：实现 SyncManager.ts

创建文件：`src/main/services/SyncManager.ts`

```typescript
/**
 * SyncManager - 同步管理器，协调文件扫描和智能合并
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileStorageManager } from '../FileStorageManager';
import { MarkdownParser } from '../MarkdownParser';

export interface SyncMetadata {
  id: string;
  filename: string;
  hash: string;
  size: number;
  updatedAt: string;
}

export interface SyncPlan {
  toMobile: string[];
  toDesktop: string[];
  skip: string[];
  totalFiles: number;
}

export class SyncManager {
  private fileStorageManager: FileStorageManager;
  private syncCount = 0;
  private lastSyncTime: string | null = null;

  constructor(fileStorageManager: FileStorageManager) {
    this.fileStorageManager = fileStorageManager;
  }

  /**
   * 获取本地文件元数据
   */
  async getLocalMetadata(): Promise<SyncMetadata[]> {
    const todos = await this.fileStorageManager.getAllTodos();
    const metadata: SyncMetadata[] = [];

    for (const todo of todos) {
      const markdown = MarkdownParser.todoToMarkdown(todo);
      const hash = crypto.createHash('sha256').update(markdown).digest('hex');
      const filename = MarkdownParser.generateFilename(todo);

      metadata.push({
        id: todo.id,
        filename,
        hash,
        size: markdown.length,
        updatedAt: todo.updatedAt,
      });
    }

    return metadata;
  }

  /**
   * 生成同步计划
   */
  generateSyncPlan(
    localMetadata: SyncMetadata[],
    mobileMetadata: SyncMetadata[]
  ): SyncPlan {
    const plan: SyncPlan = {
      toMobile: [],
      toDesktop: [],
      skip: [],
      totalFiles: 0,
    };

    const localMap = new Map(localMetadata.map((m) => [m.id, m]));
    const mobileMap = new Map(mobileMetadata.map((m) => [m.id, m]));

    // 处理本地文件
    for (const local of localMetadata) {
      const mobile = mobileMap.get(local.id);

      if (!mobile) {
        plan.toMobile.push(local.id);
      } else if (local.hash === mobile.hash) {
        plan.skip.push(local.id);
      } else {
        const localTime = new Date(local.updatedAt).getTime();
        const mobileTime = new Date(mobile.updatedAt).getTime();

        if (localTime > mobileTime) {
          plan.toMobile.push(local.id);
        } else if (mobileTime > localTime) {
          plan.toDesktop.push(local.id);
        } else {
          console.warn('Timestamp conflict:', local.id);
          plan.skip.push(local.id);
        }
      }
    }

    // 处理移动端独有的文件
    for (const mobile of mobileMetadata) {
      if (!localMap.has(mobile.id)) {
        plan.toDesktop.push(mobile.id);
      }
    }

    plan.totalFiles = plan.toMobile.length + plan.toDesktop.length + plan.skip.length;

    console.log('Sync plan:', plan);
    return plan;
  }

  /**
   * 准备发送的文件
   */
  async prepareFileForSending(id: string): Promise<{
    id: string;
    filename: string;
    content: string;
    hash: string;
    updatedAt: string;
  } | null> {
    try {
      const todo = await this.fileStorageManager.getTodoById(id);
      if (!todo) return null;

      const markdown = MarkdownParser.todoToMarkdown(todo);
      const base64Content = Buffer.from(markdown).toString('base64');
      const hash = crypto.createHash('sha256').update(markdown).digest('hex');
      const filename = MarkdownParser.generateFilename(todo);

      // 更新syncedAt
      (todo as any).syncedAt = new Date().toISOString();
      await this.fileStorageManager.saveTodo(todo);

      return {
        id: todo.id,
        filename,
        content: base64Content,
        hash,
        updatedAt: todo.updatedAt,
      };
    } catch (error) {
      console.error('Failed to prepare file:', error);
      return null;
    }
  }

  /**
   * 应用接收到的文件
   */
  async applyReceivedFile(
    filename: string,
    base64Content: string,
    hash: string
  ): Promise<boolean> {
    try {
      const markdown = Buffer.from(base64Content, 'base64').toString('utf-8');
      const calculatedHash = crypto.createHash('sha256').update(markdown).digest('hex');

      if (calculatedHash !== hash) {
        console.error('Hash mismatch');
        return false;
      }

      const todo = MarkdownParser.markdownToTodo(markdown);
      if (!todo) return false;

      (todo as any).syncedAt = new Date().toISOString();
      await this.fileStorageManager.saveTodo(todo);

      return true;
    } catch (error) {
      console.error('Failed to apply received file:', error);
      return false;
    }
  }

  /**
   * 更新同步统计
   */
  updateSyncStats(): void {
    this.syncCount++;
    this.lastSyncTime = new Date().toISOString();
    console.log('Sync stats updated:', { syncCount: this.syncCount });
  }

  /**
   * 获取同步统计
   */
  getSyncStats(): { syncCount: number; lastSyncTime: string | null } {
    return {
      syncCount: this.syncCount,
      lastSyncTime: this.lastSyncTime,
    };
  }
}
```

---

## 第五步：添加IPC Handlers

修改文件：`src/main/preload.ts`

在 `contextBridge.exposeInMainWorld` 中添加以下API：

```typescript
  // 同步相关API
  syncStartServer: () => ipcRenderer.invoke('sync:start-server'),
  syncStopServer: () => ipcRenderer.invoke('sync:stop-server'),
  syncStartDiscovery: (deviceName: string) => 
    ipcRenderer.invoke('sync:start-discovery', deviceName),
  syncStopDiscovery: () => ipcRenderer.invoke('sync:stop-discovery'),
  syncGetStats: () => ipcRenderer.invoke('sync:get-stats'),

  // 监听同步事件
  onSyncPairingCodeGenerated: (callback: (data: any) => void) => 
    ipcRenderer.on('sync:pairing-code-generated', (_, data) => callback(data)),
  onSyncPairingSuccess: (callback: () => void) => 
    ipcRenderer.on('sync:pairing-success', () => callback()),
  onSyncProgress: (callback: (progress: any) => void) => 
    ipcRenderer.on('sync:progress', (_, progress) => callback(progress)),
  onSyncComplete: (callback: (stats: any) => void) => 
    ipcRenderer.on('sync:complete', (_, stats) => callback(stats)),
  onSyncError: (callback: (error: any) => void) => 
    ipcRenderer.on('sync:error', (_, error) => callback(error)),
```

---

## 第六步：主进程集成

修改文件：`src/main/main.ts`

```typescript
import { SyncServer } from './services/SyncServer';
import { DeviceDiscovery } from './services/DeviceDiscovery';
import { SyncManager } from './services/SyncManager';

// 创建服务实例
const syncServer = new SyncServer();
const deviceDiscovery = new DeviceDiscovery();
const syncManager = new SyncManager(fileStorageManager);

// 生成设备ID（首次启动时生成并保存）
const deviceId = `desktop-${Date.now()}`;

// IPC Handlers
ipcMain.handle('sync:start-server', async () => {
  try {
    await syncServer.start();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:stop-server', () => {
  syncServer.stop();
  return { success: true };
});

ipcMain.handle('sync:start-discovery', async (event, deviceName: string) => {
  try {
    deviceDiscovery.initialize(deviceId, deviceName);
    await deviceDiscovery.startBroadcasting();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync:stop-discovery', () => {
  deviceDiscovery.stopBroadcasting();
  return { success: true };
});

ipcMain.handle('sync:get-stats', () => {
  return syncManager.getSyncStats();
});

// 同步服务器事件监听
syncServer.on('pairing-code-generated', (data) => {
  mainWindow.webContents.send('sync:pairing-code-generated', data);
});

syncServer.on('pairing-success', () => {
  mainWindow.webContents.send('sync:pairing-success');
});

syncServer.on('sync-request', async (data, socket) => {
  // 获取本地元数据
  const localMetadata = await syncManager.getLocalMetadata();
  
  // 生成同步计划
  const plan = syncManager.generateSyncPlan(localMetadata, data.files);
  
  // 发送同步计划
  syncServer.sendMessage(socket, {
    type: 'sync-plan',
    ...plan,
  });
  
  // 发送文件
  for (let i = 0; i < plan.toMobile.length; i++) {
    const fileData = await syncManager.prepareFileForSending(plan.toMobile[i]);
    if (fileData) {
      syncServer.sendMessage(socket, {
        type: 'file',
        ...fileData,
        index: i + 1,
        total: plan.toMobile.length,
      });
      
      mainWindow.webContents.send('sync:progress', {
        phase: 'sending',
        current: i + 1,
        total: plan.toMobile.length,
      });
    }
  }
});

syncServer.on('file-received', async (data, socket) => {
  const success = await syncManager.applyReceivedFile(
    data.filename,
    data.content,
    data.hash
  );
  
  syncServer.sendMessage(socket, {
    type: 'file-ack',
    id: data.id,
    status: success ? 'success' : 'error',
  });
});

syncServer.on('sync-complete', (data) => {
  syncManager.updateSyncStats();
  mainWindow.webContents.send('sync:complete', data.stats);
});
```

---

## 第七步：UI组件（简化版）

创建文件：`src/renderer/components/SyncModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Progress } from 'antd';

export const SyncModal: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'waiting' | 'pairing' | 'syncing' | 'complete'>('waiting');

  useEffect(() => {
    if (!visible) return;

    // 启动服务器和发现
    window.electronAPI.syncStartServer();
    window.electronAPI.syncStartDiscovery('我的电脑');

    // 监听事件
    window.electronAPI.onSyncPairingCodeGenerated((data) => {
      setPairingCode(data.code);
      setPhase('pairing');
    });

    window.electronAPI.onSyncPairingSuccess(() => {
      setPhase('syncing');
    });

    window.electronAPI.onSyncProgress((prog) => {
      setProgress((prog.current / prog.total) * 100);
    });

    window.electronAPI.onSyncComplete((stats) => {
      setPhase('complete');
      setTimeout(() => {
        onClose();
      }, 2000);
    });

    return () => {
      window.electronAPI.syncStopServer();
      window.electronAPI.syncStopDiscovery();
    };
  }, [visible]);

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="局域网同步"
      footer={null}
    >
      {phase === 'waiting' && <p>等待移动端连接...</p>}
      
      {phase === 'pairing' && (
        <div style={{ textAlign: 'center' }}>
          <h2>配对码</h2>
          <div style={{ fontSize: 48, fontWeight: 'bold', margin: '20px 0' }}>
            {pairingCode}
          </div>
          <p>请在移动端输入此配对码</p>
        </div>
      )}
      
      {phase === 'syncing' && (
        <div>
          <p>正在同步...</p>
          <Progress percent={progress} />
        </div>
      )}
      
      {phase === 'complete' && (
        <div style={{ textAlign: 'center' }}>
          <h3>同步完成！</h3>
        </div>
      )}
    </Modal>
  );
};
```

---

## 测试清单

完成实现后，按照以下步骤测试：

1. **启动服务器测试**
   - [ ] 桌面端启动后，TCP服务器成功监听53318端口
   - [ ] UDP广播每2秒发送一次设备信息

2. **连接测试**
   - [ ] 移动端能发现桌面端设备
   - [ ] 点击连接后，桌面端显示6位配对码
   - [ ] 移动端输入正确配对码后，配对成功

3. **同步测试**
   - [ ] 桌面端10个文件 → 移动端0个 → 同步后移动端有10个
   - [ ] 移动端5个文件 → 桌面端8个 → 同步后都有13个（无重复）
   - [ ] 同一ID不同内容 → 较新版本覆盖较旧版本

4. **错误处理测试**
   - [ ] 输入错误配对码 → 显示错误提示
   - [ ] 同步中断网络 → 显示中断提示
   - [ ] 哈希校验失败 → 请求重传

---

## 注意事项

1. **WebSocket vs TCP**: 移动端使用WebSocket，所以桌面端也需要提供WebSocket服务器。建议使用 `ws` 库。

2. **防火墙**: Windows可能需要添加防火墙规则允许53317和53318端口。

3. **设备ID持久化**: 首次运行时生成deviceId，保存到settings中，后续使用同一个ID。

4. **错误日志**: 建议添加详细的日志记录，方便调试。

---

## 完整时间线

- **Day 1**: 实现SyncServer、DeviceDiscovery（4-6小时）
- **Day 2**: 实现SyncManager、IPC集成（4-6小时）
- **Day 3**: UI组件、事件监听（4-6小时）
- **Day 4**: 集成测试、Bug修复（4-6小时）

---

**祝开发顺利！有问题随时沟通。**
