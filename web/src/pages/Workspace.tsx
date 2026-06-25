import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { WorkspaceDir, WorkspaceFile } from '../types'
import { RefreshCw, FolderOpen, FileText, ArrowLeft } from 'lucide-react'

export default function Workspace() {
  const [dirs, setDirs] = useState<WorkspaceDir[]>([])
  const [selectedDir, setSelectedDir] = useState<string | null>(null)
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<{ raw: string; isJson: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDirs = useCallback(async () => {
    try {
      const data = await api.getWorkspace()
      setDirs(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar workspace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDirs()
  }, [loadDirs])

  const selectDir = async (dir: string) => {
    setSelectedDir(dir)
    setSelectedFile(null)
    setFileContent(null)
    setLoadingFiles(true)
    try {
      const data = await api.getWorkspaceDir(dir)
      setFiles(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar diretório')
    } finally {
      setLoadingFiles(false)
    }
  }

  const selectFile = async (file: string) => {
    if (!selectedDir) return
    setSelectedFile(file)
    setFileContent(null)
    setLoadingContent(true)
    try {
      const data = await api.getWorkspaceFile(selectedDir, file)
      setFileContent({ raw: data.raw, isJson: data.isJson })
    } catch (e: unknown) {
      setFileContent({ raw: `Erro: ${e instanceof Error ? e.message : 'Unknown'}`, isJson: false })
    } finally {
      setLoadingContent(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, margin: 0, lineHeight: 1 }}>
            Workspace
          </h1>
          {/* Breadcrumb */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <button
              onClick={() => { setSelectedDir(null); setFiles([]); setSelectedFile(null); setFileContent(null) }}
              style={{
                background: 'none',
                border: 'none',
                color: '#0A84FF',
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
                transition: 'opacity 0.2s',
              }}
            >
              workspace
            </button>
            {selectedDir && (
              <>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>/</span>
                <button
                  onClick={() => { setSelectedFile(null); setFileContent(null) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0A84FF',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  {selectedDir}
                </button>
              </>
            )}
            {selectedFile && (
              <>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>/</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{selectedFile}</span>
              </>
            )}
          </nav>
        </div>
        <button
          onClick={loadDirs}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          title="Atualizar"
        >
          <RefreshCw size={14} strokeWidth={1.5} />
        </button>
      </div>

      {error && (
        <div
          className="flex-shrink-0"
          style={{
            background: 'rgba(255,69,58,0.1)',
            border: '1px solid rgba(255,69,58,0.25)',
            color: '#FF453A',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!selectedDir ? (
          loading ? (
            <div className="flex items-center justify-center h-full">
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando...</span>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10,
              }}
            >
              {dirs.map(d => (
                <button
                  key={d.name}
                  onClick={() => selectDir(d.name)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    padding: '16px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'rgba(255,255,255,0.07)'
                    el.style.borderColor = 'rgba(10,132,255,0.3)'
                    el.style.transform = 'translateY(-1px)'
                    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = 'rgba(255,255,255,0.04)'
                    el.style.borderColor = 'rgba(255,255,255,0.08)'
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'
                  }}
                >
                  <div style={{ marginBottom: 8, display: 'flex' }}>
                    <FolderOpen size={28} strokeWidth={1.5} style={{ color: '#0A84FF', opacity: 0.7 }} />
                  </div>
                  <p
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 500,
                      margin: '0 0 3px 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.name}
                  </p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 10, margin: 0 }}>
                    {d.count} item{d.count !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          )
        ) : !selectedFile ? (
          loadingFiles ? (
            <div className="flex items-center justify-center h-full">
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando...</span>
            </div>
          ) : files.length === 0 ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '48px 32px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13,
              }}
            >
              Diretório vazio
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}>
                    {['Nome', 'Tamanho', 'Modificado'].map(h => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          color: 'var(--text-tertiary)',
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          padding: '10px 16px',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {files.map((f, i) => (
                    <tr
                      key={f.name}
                      onClick={() => !f.isDir && selectFile(f.name)}
                      style={{
                        cursor: f.isDir ? 'default' : 'pointer',
                        borderBottom: i < files.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (!f.isDir) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.04)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            {f.isDir
                              ? <FolderOpen size={14} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
                              : <FileText size={14} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                            }
                          </span>
                          <span style={{ color: f.isDir ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 13 }}>
                            {f.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>
                        {f.isDir ? '—' : formatSize(f.size)}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>
                        {f.mtime ? new Date(f.mtime).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div
            className="flex flex-col overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              maxHeight: 'calc(100vh - 200px)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px 16px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{selectedFile}</span>
              <button
                onClick={() => { setSelectedFile(null); setFileContent(null) }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <ArrowLeft size={13} strokeWidth={1.5} /> Voltar
              </button>
            </div>
            <div className="flex-1 overflow-auto" style={{ padding: 16 }}>
              {loadingContent ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</p>
              ) : fileContent ? (
                <pre
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 11.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-words',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {fileContent.isJson
                    ? JSON.stringify(JSON.parse(fileContent.raw), null, 2)
                    : fileContent.raw}
                </pre>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
