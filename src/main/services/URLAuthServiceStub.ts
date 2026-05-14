// 临时 URLAuth 服务存根
import { Session } from 'electron';

export class URLAuthService {
  private urlAuthorizationService: any;
  private fileStorageManager: any;
  private mainWindow: any;

  constructor() {
    // 简化构造函数
  }

  public setURLAuthorizationService(service: any, fileStorageManager: any) {
    this.urlAuthorizationService = service;
    this.fileStorageManager = fileStorageManager;
  }

  public getAuthSession(): Session {
    // 返回一个简化的 session 对象，这里返回 null 作为占位符
    return null as any;
  }

  public setMainWindow(window: any) {
    this.mainWindow = window;
  }

  public async authorizeUrl(url: string) {
    return { success: false, title: null, error: 'URL authorization service is disabled in Markdown mode' };
  }

  public async refreshUrlTitle(url: string) {
    return { success: false, title: null, error: 'URL authorization service is disabled in Markdown mode' };
  }
}