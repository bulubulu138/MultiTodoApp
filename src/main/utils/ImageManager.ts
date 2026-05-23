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

  // ==================== Obsidian-style Image Management Utilities ====================

  /**
   * Find all images for a specific markdown file (Obsidian-style)
   * Looks for images with the same base name as the markdown file
   */
  public findImagesForMarkdownFile(markdownFileName: string, storagePath: string): string[] {
    const baseName = markdownFileName.replace(/\.md$/, '');
    const imageFiles: string[] = [];

    try {
      const files = fs.readdirSync(storagePath);
      // Match files like: basename_content_1.png, basename_content_2.jpg, etc.
      const imagePattern = new RegExp(`^${baseName}_content_\\d+\\.(png|jpg|jpeg|gif|webp)$`);

      for (const file of files) {
        if (imagePattern.test(file)) {
          imageFiles.push(`./${file}`);
        }
      }

      console.log(`[ImageManager] Found ${imageFiles.length} images for ${markdownFileName}:`, imageFiles);
    } catch (error) {
      console.error('[ImageManager] Error finding images for markdown file:', error);
    }

    return imageFiles;
  }

  /**
   * Clean up orphaned image files (images without corresponding markdown files)
   * This helps maintain a clean storage structure
   */
  public cleanupOrphanedImages(storagePath: string): { removed: number; errors: string[] } {
    const removed = 0;
    const errors: string[] = [];

    try {
      const files = fs.readdirSync(storagePath);
      const markdownFiles = new Set(
        files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
      );

      // Find orphaned images
      for (const file of files) {
        if (file.match(/_content_\d+\.(png|jpg|jpeg|gif|webp)$/)) {
          // Extract base name from image file
          const baseName = file.replace(/_content_\d+\.\w+$/, '');

          // If no corresponding markdown file exists, it's orphaned
          if (!markdownFiles.has(baseName)) {
            try {
              const filePath = path.join(storagePath, file);
              fs.unlinkSync(filePath);
              console.log(`[ImageManager] Removed orphaned image: ${file}`);
            } catch (error) {
              const errorMsg = `Failed to remove orphaned image ${file}: ${error}`;
              errors.push(errorMsg);
              console.error(`[ImageManager] ${errorMsg}`);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`Error during cleanup: ${error}`);
      console.error('[ImageManager] Error during orphaned image cleanup:', error);
    }

    return { removed, errors };
  }

  /**
   * Rename images when markdown file is renamed (Obsidian-style)
   * Ensures images stay associated with their markdown file
   */
  public renameImagesForMarkdownFile(
    oldFileName: string,
    newFileName: string,
    storagePath: string
  ): { renamed: number; errors: string[] } {
    let renamed = 0;
    const errors: string[] = [];

    const oldBaseName = oldFileName.replace(/\.md$/, '');
    const newBaseName = newFileName.replace(/\.md$/, '');

    try {
      const files = fs.readdirSync(storagePath);
      const imagePattern = new RegExp(`^${oldBaseName}_content_(\\d+)\\.(\\w+)$`);

      for (const file of files) {
        const match = file.match(imagePattern);
        if (match) {
          const index = match[1];
          const ext = match[2];
          const oldImagePath = path.join(storagePath, file);
          const newImageName = `${newBaseName}_content_${index}.${ext}`;
          const newImagePath = path.join(storagePath, newImageName);

          try {
            // Check if target file already exists
            if (fs.existsSync(newImagePath)) {
              const errorMsg = `Cannot rename ${file} to ${newImageName} - target already exists`;
              errors.push(errorMsg);
              console.warn(`[ImageManager] ${errorMsg}`);
            } else {
              fs.renameSync(oldImagePath, newImagePath);
              console.log(`[ImageManager] Renamed image: ${file} -> ${newImageName}`);
              renamed++;
            }
          } catch (error) {
            const errorMsg = `Failed to rename ${file}: ${error}`;
            errors.push(errorMsg);
            console.error(`[ImageManager] ${errorMsg}`);
          }
        }
      }
    } catch (error) {
      errors.push(`Error during image rename operation: ${error}`);
      console.error('[ImageManager] Error renaming images:', error);
    }

    return { renamed, errors };
  }

  /**
   * Validate image reference integrity
   * Check if all referenced images in a markdown file actually exist
   */
  public validateImageReferences(markdownContent: string, storagePath: string): {
    valid: boolean;
    missingImages: string[];
  } {
    const missingImages: string[] = [];

    // Extract image references from markdown content
    const imageRefPattern = /!\[([^\]]*)\]\(\.\/([^)]+)\)/g;
    let match;

    while ((match = imageRefPattern.exec(markdownContent)) !== null) {
      const imagePath = match[2];
      const fullPath = path.join(storagePath, imagePath);

      if (!fs.existsSync(fullPath)) {
        missingImages.push(imagePath);
        console.warn(`[ImageManager] Missing image reference: ${imagePath}`);
      }
    }

    return {
      valid: missingImages.length === 0,
      missingImages
    };
  }

  /**
   * Get storage path for a given markdown file
   */
  public getStoragePathForMarkdownFile(fileName: string, storagePath: string): string {
    return path.join(storagePath, fileName);
  }

  /**
   * Check if an image file exists
   */
  public imageExists(relativePath: string, storagePath: string): boolean {
    const fullPath = path.join(storagePath, relativePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Delete a specific image file by relative path
   */
  public deleteImageByRelativePath(relativePath: string, storagePath: string): boolean {
    try {
      const fullPath = path.join(storagePath, relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`[ImageManager] Deleted image: ${relativePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[ImageManager] Error deleting image ${relativePath}:`, error);
      return false;
    }
  }
}
