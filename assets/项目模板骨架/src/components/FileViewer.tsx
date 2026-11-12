import React, { useState } from "react";
import type { GlobalState } from "../types";

interface FileViewerProps {
  store: GlobalState;
}

export const FileViewer: React.FC<FileViewerProps> = ({ store }) => {
  const files = Object.values(store.virtualFileSystem.files);
  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path ?? null);

  const selectedFile = files.find(f => f.path === selectedPath);

  return (
    <div className="file-viewer">
      <aside className="file-list">
        <h4>📁 虚拟文件系统</h4>
        {files.length === 0 ? (
          <div className="empty-state">暂无文件</div>
        ) : (
          files.map(f => (
            <div
              key={f.path}
              className={`file-item ${f.path === selectedPath ? "active" : ""}`}
              onClick={() => setSelectedPath(f.path)}
              title={f.path}
            >
              {getIcon(f.path)} {f.path}
            </div>
          ))
        )}
      </aside>
      <main className="file-content">
        {selectedFile ? (
          selectedFile.type === "text" ? (
            <pre className="file-text">{selectedFile.content as string}</pre>
          ) : (
            <div className="binary-placeholder">二进制文件 ({selectedFile.size} bytes)</div>
          )
        ) : (
          <div className="empty-state">请从左侧选择文件</div>
        )}
      </main>
    </div>
  );
};

function getIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md": return "📝";
    case "csv": return "📊";
    case "json": return "📋";
    case "txt": return "📄";
    case "py": return "🐍";
    case "js":
    case "ts": return "💻";
    case "png":
    case "jpg":
    case "gif": return "🖼️";
    default: return "📄";
  }
}
