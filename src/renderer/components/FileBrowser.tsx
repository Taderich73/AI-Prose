import { useCallback, useEffect } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { useFileBrowser } from '../hooks/useFileBrowser'

interface TreeNodeProps {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
  depth: number
  isExpanded: boolean
  isLoading: boolean
  children: React.ReactNode
  onToggleFolder: (path: string) => void
  onOpenFile: (path: string) => void
}

function TreeNode({
  name,
  isDirectory,
  isMarkdown,
  depth,
  isExpanded,
  isLoading,
  children,
  path,
  onToggleFolder,
  onOpenFile,
}: TreeNodeProps) {
  const handleClick = () => {
    if (isDirectory) onToggleFolder(path)
  }

  const handleDoubleClick = () => {
    if (!isDirectory && isMarkdown) onOpenFile(path)
  }

  const arrow = isDirectory ? (isExpanded ? '▾' : '▸') : ' '
  const icon = isDirectory ? '📁' : '📄'
  const isDisabled = !isDirectory && !isMarkdown

  return (
    <div>
      <div
        className={`tree-node ${isDisabled ? 'tree-node-disabled' : ''} ${
          isDirectory ? 'tree-node-folder' : ''
        } ${!isDirectory && isMarkdown ? 'tree-node-markdown' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <span className="tree-arrow">{arrow}</span>
        <span className="tree-icon">{icon}</span>
        <span className="tree-name">{name}</span>
        {isLoading && <span className="tree-loading">…</span>}
      </div>
      {isDirectory && isExpanded && (
        <div className="tree-children">{children}</div>
      )}
    </div>
  )
}

interface FileBrowserProps {
  onOpenFile: (path: string) => void
}

export function FileBrowser({ onOpenFile }: FileBrowserProps) {
  const { rootDirectory, setRootDirectory } = useEditorStore()
  const { toggleFolder, isExpanded, isLoading, getContents, loadDirectory, reset } =
    useFileBrowser()

  const handleChooseFolder = useCallback(async () => {
    const dir = await window.api.chooseDirectory()
    if (dir) {
      reset()
      setRootDirectory(dir)
    }
  }, [reset, setRootDirectory])

  useEffect(() => {
    if (rootDirectory) {
      loadDirectory(rootDirectory)
    }
  }, [rootDirectory, loadDirectory])

  if (!rootDirectory) {
    return (
      <div className="file-browser">
        <div className="file-browser-empty">
          <button className="file-browser-choose" onClick={handleChooseFolder}>
            Choose Folder
          </button>
        </div>
      </div>
    )
  }

  const rootName = rootDirectory.split('/').pop() ?? rootDirectory

  function renderTree(dirPath: string, depth: number) {
    const contents = getContents(dirPath)
    return contents.map((entry) => (
      <TreeNode
        key={entry.path}
        name={entry.name}
        path={entry.path}
        isDirectory={entry.isDirectory}
        isMarkdown={entry.isMarkdown}
        depth={depth}
        isExpanded={isExpanded(entry.path)}
        isLoading={isLoading(entry.path)}
        onToggleFolder={toggleFolder}
        onOpenFile={onOpenFile}
      >
        {entry.isDirectory && isExpanded(entry.path)
          ? renderTree(entry.path, depth + 1)
          : null}
      </TreeNode>
    ))
  }

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <span className="file-browser-root-name" title={rootDirectory}>
          {rootName}
        </span>
        <button
          className="file-browser-change"
          onClick={handleChooseFolder}
          title="Change folder"
        >
          ···
        </button>
      </div>
      <div className="file-browser-tree">{renderTree(rootDirectory, 0)}</div>
    </div>
  )
}
