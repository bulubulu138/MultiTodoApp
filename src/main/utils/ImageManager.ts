import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class ImageManager {
  private imagesDir: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.imagesDir = path.join(userDataPath, 'images');
    this.ensureImagesDirectory();
  }

  private ensureImagesDirectory(): void {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  public async saveImage(buffer: Buffer, originalName: string): Promise<string> {
    const timestamp = Date.now();
    const ext = path.extname(originalName);
    const filename = `${timestamp}_${path.basename(originalName, ext)}${ext}`;
    const filepath = path.join(this.imagesDir, filename);

    await fs.promises.writeFile(filepath, buffer);
    return filepath;
  }

  public async deleteImage(filepath: string): Promise<boolean> {
    try {
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  public getImagePath(filename: string): string {
    return path.join(this.imagesDir, filename);
  }

  public isValidImagePath(filepath: string): boolean {
    return filepath.startsWith(this.imagesDir) && fs.existsSync(filepath);
  }

  public getImagesDirectory(): string {
    return this.imagesDir;
  }
}
