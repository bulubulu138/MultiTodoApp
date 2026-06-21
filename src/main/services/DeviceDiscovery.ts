/**
 * DeviceDiscovery - UDP多播设备发现
 */

import * as dgram from 'dgram';
import * as os from 'os';
import { EventEmitter } from 'events';

export class DeviceDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private readonly PORT = 53317;
  private readonly MULTICAST_ADDRESS = '239.255.42.99';
  private readonly BROADCAST_INTERVAL = 2000; // 每2秒广播一次
  private discoveredDevices = new Map<string, any>(); // 缓存发现的设备

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
      try {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (error) => {
          console.error('UDP socket error:', error);
          this.stopBroadcasting();
          reject(error);
        });

        this.socket.bind(this.PORT, () => {
          if (!this.socket) return;

          try {
            this.socket.setBroadcast(true);
            this.socket.setMulticastTTL(128);
            this.socket.addMembership(this.MULTICAST_ADDRESS);

            console.log(`Broadcasting on ${this.MULTICAST_ADDRESS}:${this.PORT}`);

            // 监听来自其他设备的广播消息
            this.socket.on('message', (msg, rinfo) => {
              this.handleIncomingMessage(msg, rinfo);
            });

            // 开始定时广播
            this.broadcastInterval = setInterval(() => {
              this.broadcast();
            }, this.BROADCAST_INTERVAL);

            // 立即广播一次
            this.broadcast();

            resolve();
          } catch (error) {
            console.error('Failed to configure socket:', error);
            reject(error);
          }
        });
      } catch (error) {
        console.error('Failed to create socket:', error);
        reject(error);
      }
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
      try {
        this.socket.close();
      } catch (error) {
        console.error('Error closing socket:', error);
      }
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
          this.emit('error', error);
        }
      }
    );
  }

  /**
   * 获取本机IP地址
   */
  private getLocalIP(): string {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;

      for (const details of iface) {
        if (details.family === 'IPv4' && !details.internal) {
          return details.address;
        }
      }
    }

    return '127.0.0.1';
  }

  /**
   * 处理接收到的UDP消息
   */
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

      console.log('Discovered device:', {
        deviceId: message.deviceId,
        deviceName: message.deviceName,
        deviceType: message.deviceType,
        ip: message.ip || rinfo.address,
        port: message.port,
      });

      // 构建设备信息
      const deviceInfo = {
        deviceId: message.deviceId,
        deviceName: message.deviceName,
        deviceType: message.deviceType,
        appVersion: message.appVersion,
        ip: message.ip || rinfo.address,
        port: message.port,
        lastSeen: Date.now(),
      };

      // 缓存设备信息
      this.discoveredDevices.set(message.deviceId, deviceInfo);

      // 触发设备发现事件
      this.emit('device-discovered', deviceInfo);
    } catch (error) {
      console.error('Failed to parse incoming message:', error);
    }
  }

  /**
   * 获取已发现的设备列表
   */
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

  /**
   * 检查是否正在广播
   */
  isBroadcasting(): boolean {
    return this.socket !== null && this.broadcastInterval !== null;
  }
}
