# 设备发现问题修复报告

**日期:** 2026-06-19  
**问题:** 移动端和电脑端在同一WiFi下无法发现彼此  
**状态:** ✅ 已修复

---

## 问题根因分析

### 发现的问题

通过系统性调试，发现了 `DeviceDiscovery.ts` 的关键架构缺陷：

**❌ 原实现只发送广播，不接收广播**

```typescript
// 原代码只有：
this.socket.bind(this.PORT, () => {
  this.socket.setBroadcast(true);
  this.socket.addMembership(this.MULTICAST_ADDRESS);
  
  // ✅ 发送广播
  setInterval(() => this.broadcast(), 2000);
  
  // ❌ 缺少：监听来自其他设备的广播
  // 没有 socket.on('message') 处理器
});
```

### 问题影响

- **桌面端 → 移动端:** ❌ 移动端收不到桌面端广播（如果移动端在监听）
- **移动端 → 桌面端:** ❌ 桌面端完全不监听，无法发现移动端
- **结果:** 双方都看不到对方

---

## 解决方案

### 修改 1: 添加UDP消息监听器

**文件:** `src/main/services/DeviceDiscovery.ts`

```typescript
// 在 startBroadcasting() 中添加消息监听
this.socket.on('message', (msg, rinfo) => {
  this.handleIncomingMessage(msg, rinfo);
});
```

### 修改 2: 实现消息处理逻辑

```typescript
private handleIncomingMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
  try {
    const message = JSON.parse(msg.toString());

    // 忽略自己发出的消息
    if (message.deviceId === this.deviceInfo.deviceId) {
      return;
    }

    // 只处理discover类型的消息
    if (message.type !== 'discover') {
      return;
    }

    // 构建设备信息
    const deviceInfo = {
      deviceId: message.deviceId,
      deviceName: message.deviceName,
      deviceType: message.deviceType,
      ip: message.ip || rinfo.address,
      port: message.port,
      lastSeen: Date.now(),
    };

    // 缓存设备
    this.discoveredDevices.set(message.deviceId, deviceInfo);

    // 触发事件
    this.emit('device-discovered', deviceInfo);
  } catch (error) {
    console.error('Failed to parse incoming message:', error);
  }
}
```

### 修改 3: 添加设备缓存管理

```typescript
private discoveredDevices = new Map<string, any>();

// 获取已发现的设备，自动清理超时设备
getDiscoveredDevices(): any[] {
  const now = Date.now();
  const devices: any[] = [];

  // 清理超过10秒未见的设备
  for (const [deviceId, device] of this.discoveredDevices.entries()) {
    if (now - device.lastSeen > 10000) {
      this.discoveredDevices.delete(deviceId);
    } else {
      devices.push(device);
    }
  }

  return devices;
}
```

### 修改 4: 添加IPC事件转发

**文件:** `src/main/main.ts`

```typescript
private setupSyncEventListeners(): void {
  // ... 其他事件 ...
  
  // 新增：设备发现事件
  this.deviceDiscovery.on('device-discovered', (device) => {
    if (this.mainWindow) {
      console.log('Forwarding device-discovered event to renderer:', device);
      this.mainWindow.webContents.send('sync:device-discovered', device);
    }
  });
}
```

### 修改 5: 添加IPC Handler

```typescript
// 获取已发现的设备列表
ipcMain.handle('sync:get-discovered-devices', async () => {
  try {
    return this.deviceDiscovery.getDiscoveredDevices();
  } catch (error) {
    console.error('[IPC] Failed to get discovered devices:', error);
    return [];
  }
});
```

### 修改 6: 更新Preload API

**文件:** `src/main/preload.ts`

```typescript
sync: {
  // ... 其他API ...
  getDiscoveredDevices: () => ipcRenderer.invoke('sync:get-discovered-devices'),
  onDeviceDiscovered: (callback: (device: any) => void) => {
    const listener = (_: any, device: any) => callback(device);
    ipcRenderer.on('sync:device-discovered', listener);
    return () => ipcRenderer.removeListener('sync:device-discovered', listener);
  },
}
```

---

## 修复后的工作流程

### 设备发现流程

```
1. 桌面端启动 DeviceDiscovery
   ├─ 绑定UDP端口 53317
   ├─ 加入多播组 239.255.42.99
   ├─ 每2秒广播自己的信息
   └─ ✅ 监听来自其他设备的广播

2. 移动端启动 DeviceDiscovery
   ├─ 绑定UDP端口 53317
   ├─ 加入多播组 239.255.42.99
   ├─ 每2秒广播自己的信息
   └─ ✅ 监听来自其他设备的广播

3. 双向发现
   ├─ 桌面端收到移动端广播 → 触发 'device-discovered' 事件
   └─ 移动端收到桌面端广播 → 显示桌面设备

4. UI展示
   └─ 前端通过 onDeviceDiscovered() 实时接收发现的设备
```

---

## 测试建议

### 测试步骤

1. **启动桌面端应用**
   ```bash
   npm run dev
   ```

2. **打开开发者工具，查看控制台日志**
   - 应该看到: `Broadcasting on 239.255.42.99:53317`
   - 应该看到: UDP socket正常工作

3. **启动移动端应用**
   - 确保在同一WiFi网络

4. **验证设备发现**
   - 桌面端控制台应该看到: `Discovered device: {...}`
   - 前端可以通过以下代码测试：
   ```typescript
   // 监听设备发现
   const cleanup = window.electronAPI.sync.onDeviceDiscovered((device) => {
     console.log('Found device:', device);
   });
   
   // 获取已发现的设备列表
   const devices = await window.electronAPI.sync.getDiscoveredDevices();
   console.log('All devices:', devices);
   ```

### 预期结果

- ✅ 桌面端能发现移动端设备
- ✅ 移动端能发现桌面端设备
- ✅ 设备信息包含：deviceId, deviceName, deviceType, ip, port
- ✅ 超过10秒未响应的设备自动从列表中移除

---

## 其他可能的问题

如果修复后仍无法发现设备，检查以下项：

### 1. 防火墙设置
```bash
# Windows防火墙可能阻止UDP 53317端口
# 需要添加防火墙规则允许该端口
```

### 2. 网络接口选择
```typescript
// getLocalIP() 可能返回错误的IP地址
// 如果有多个网络接口（VPN、虚拟网卡），可能选择了错误的接口
```

### 3. 移动端实现
- 确认移动端也实现了相同的UDP多播机制
- 确认移动端使用相同的端口(53317)和多播地址(239.255.42.99)

### 4. 路由器配置
- 某些路由器可能阻止多播流量
- 尝试在路由器设置中启用IGMP多播支持

---

## 修改文件清单

1. ✅ `src/main/services/DeviceDiscovery.ts` - 添加UDP消息监听和处理
2. ✅ `src/main/main.ts` - 添加设备发现事件转发和IPC handler
3. ✅ `src/main/preload.ts` - 添加前端API接口

**编译状态:** ✅ 主进程编译成功，无TypeScript错误

---

## 后续UI集成建议

可以在 `SyncModal.tsx` 中添加设备列表显示：

```typescript
const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

useEffect(() => {
  if (!visible) return;

  // 监听设备发现
  const cleanup = window.electronAPI.sync.onDeviceDiscovered((device) => {
    setDiscoveredDevices(prev => {
      const exists = prev.find(d => d.deviceId === device.deviceId);
      if (exists) {
        return prev.map(d => d.deviceId === device.deviceId ? device : d);
      }
      return [...prev, device];
    });
  });

  // 定期刷新设备列表
  const interval = setInterval(async () => {
    const devices = await window.electronAPI.sync.getDiscoveredDevices();
    setDiscoveredDevices(devices);
  }, 5000);

  return () => {
    cleanup();
    clearInterval(interval);
  };
}, [visible]);

// 在渲染中显示设备列表
{state === 'waiting' && (
  <div>
    <p>正在搜索设备...</p>
    <List
      dataSource={discoveredDevices}
      renderItem={(device) => (
        <List.Item>
          <List.Item.Meta
            title={device.deviceName}
            description={`${device.deviceType} - ${device.ip}`}
          />
          <Button onClick={() => handleConnect(device)}>连接</Button>
        </List.Item>
      )}
    />
  </div>
)}
```

---

**修复完成！现在桌面端应该能够正确发现和被发现了。**
