/**
 * SyncServer - WebSocket服务器，处理移动端连接和同步请求
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface SyncMessage {
  type: string;
  [key: string]: any;
}

export class SyncServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, WebSocket>();
  private currentPairingCode: string | null = null;
  private pairingExpiry: number | null = null;
  private readonly PORT = 53318;
  private readonly PAIRING_CODE_TTL = 5 * 60 * 1000; // 5分钟

  /**
   * 启动WebSocket服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.PORT, host: '0.0.0.0' });

        this.wss.on('error', (error) => {
          console.error('WebSocket server error:', error);
          this.emit('error', error);
          reject(error);
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
          this.handleConnection(ws, req);
        });

        this.wss.on('listening', () => {
          console.log(`WebSocket server listening on port ${this.PORT}`);
          resolve();
        });
      } catch (error) {
        console.error('Failed to start WebSocket server:', error);
        reject(error);
      }
    });
  }

  /**
   * 停止服务器
   */
  stop(): void {
    if (this.wss) {
      // 关闭所有客户端连接
      for (const ws of this.clients.values()) {
        ws.close();
      }
      this.clients.clear();

      // 关闭服务器
      this.wss.close(() => {
        console.log('WebSocket server stopped');
      });
      this.wss = null;
    }

    // 清除配对码
    this.currentPairingCode = null;
    this.pairingExpiry = null;
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    console.log('Client connected:', clientId);

    this.clients.set(clientId, ws);

    let buffer = '';

    ws.on('message', (data: Buffer) => {
      buffer += data.toString();

      // 处理完整的消息（以换行符分隔）
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const message = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);

        if (message.trim()) {
          this.handleMessage(message, ws, clientId);
        }
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected:', clientId);
      this.clients.delete(clientId);
      this.emit('client-disconnected', clientId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.clients.delete(clientId);
    });
  }

  /**
   * 处理消息
   */
  private handleMessage(message: string, ws: WebSocket, clientId: string): void {
    try {
      const data: SyncMessage = JSON.parse(message);
      console.log('[SYNC DEBUG] Message received:', data.type, 'from', clientId);

      switch (data.type) {
        case 'connect':
          this.handleConnectRequest(data, ws);
          break;
        case 'pairing-code':
          this.handlePairingCode(data, ws);
          break;
        case 'sync-request':
          this.handleSyncRequest(data, ws);
          break;
        case 'file':
          console.log('[SYNC DEBUG] Received file message, emitting file-received event');
          this.handleFileReceived(data, ws);
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
      this.emit('message', data, ws, clientId);
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.emit('error', error);
    }
  }

  /**
   * 处理连接请求
   */
  private handleConnectRequest(data: SyncMessage, ws: WebSocket): void {
    // 生成6位配对码
    this.currentPairingCode = this.generatePairingCode();
    this.pairingExpiry = Date.now() + this.PAIRING_CODE_TTL;

    console.log('Generated pairing code:', this.currentPairingCode);

    // 发送配对码要求
    this.sendMessage(ws, {
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
  private handlePairingCode(data: SyncMessage, ws: WebSocket): void {
    const now = Date.now();

    if (!this.currentPairingCode || !this.pairingExpiry) {
      this.sendMessage(ws, {
        type: 'pairing-failed',
        reason: 'no-code-generated',
      });
      return;
    }

    if (now > this.pairingExpiry) {
      this.sendMessage(ws, {
        type: 'pairing-failed',
        reason: 'expired',
      });
      this.currentPairingCode = null;
      this.pairingExpiry = null;
      return;
    }

    if (data.code !== this.currentPairingCode) {
      this.sendMessage(ws, {
        type: 'pairing-failed',
        reason: 'invalid-code',
      });
      return;
    }

    // 配对成功
    this.sendMessage(ws, {
      type: 'pairing-success',
    });

    this.currentPairingCode = null;
    this.pairingExpiry = null;

    this.emit('pairing-success');
  }

  /**
   * 处理同步请求
   */
  private handleSyncRequest(data: SyncMessage, ws: WebSocket): void {
    // 触发事件，让SyncManager处理
    this.emit('sync-request', data, ws);
  }

  /**
   * 处理接收到的文件
   */
  private handleFileReceived(data: SyncMessage, ws: WebSocket): void {
    console.log('[SYNC DEBUG] handleFileReceived called, emitting event...');
    this.emit('file-received', data, ws);
    console.log('[SYNC DEBUG] file-received event emitted');
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
  sendMessage(ws: WebSocket, message: SyncMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        const json = JSON.stringify(message);
        ws.send(json + '\n');
        console.log('Message sent:', message.type);
      } else {
        console.warn('WebSocket not open, cannot send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.emit('error', error);
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
    for (const ws of this.clients.values()) {
      this.sendMessage(ws, message);
    }
  }

  /**
   * 检查服务器是否运行
   */
  isRunning(): boolean {
    return this.wss !== null;
  }
}
