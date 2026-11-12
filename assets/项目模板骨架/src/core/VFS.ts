import type { GlobalState } from "../types";

/**
 * 虚拟文件系统 —— 跨 Agent 共享的内存文件系统
 * 路径格式统一为 "/workspace/..."
 */
export class VirtualFileSystem {
  private state: GlobalState;

  constructor(state: GlobalState) {
    this.state = state;
    // 确保根目录存在
    if (!this.state.virtualFileSystem.rootPath) {
      this.state.virtualFileSystem.rootPath = "/workspace";
    }
  }

  /** 写入/更新文件 */
  write(path: string, content: string | Uint8Array, type: "text" | "image" | "binary" = "text"): void {
    const normalizedPath = this.normalizePath(path);
    const contentStr = typeof content === "string" ? content : "";
    const size = typeof content === "string" ? content.length : content.length;
    this.state.virtualFileSystem.files[normalizedPath] = {
      path: normalizedPath,
      content,
      type,
      size,
      lastModified: Date.now(),
    };
    void contentStr; // 防止 ts unused
  }

  /** 读取文件 */
  read(path: string): string | Uint8Array | null {
    const file = this.state.virtualFileSystem.files[this.normalizePath(path)];
    return file ? file.content : null;
  }

  /** 文件是否存在 */
  exists(path: string): boolean {
    return !!this.state.virtualFileSystem.files[this.normalizePath(path)];
  }

  /** 删除文件 */
  remove(path: string): boolean {
    const key = this.normalizePath(path);
    if (this.state.virtualFileSystem.files[key]) {
      delete this.state.virtualFileSystem.files[key];
      return true;
    }
    return false;
  }

  /** 搜索文件 —— 简单 glob 支持 * ? */
  search(pattern: string): string[] {
    const files = this.state.virtualFileSystem.files;
    const regex = globToRegex(pattern);
    return Object.keys(files).filter(path => regex.test(path));
  }

  /** 列出目录下的文件 */
  list(dirPath: string = "/workspace"): string[] {
    const normalized = this.normalizePath(dirPath);
    return Object.keys(this.state.virtualFileSystem.files).filter(
      path => path.startsWith(normalized + "/") || path === normalized
    );
  }

  private normalizePath(path: string): string {
    if (!path.startsWith("/")) path = "/" + path;
    if (!path.startsWith("/workspace")) path = "/workspace" + path;
    return path.replace(/\/+/g, "/");
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp("^" + escaped + "$", "i");
}
