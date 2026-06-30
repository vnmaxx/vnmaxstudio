import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { CrmLead, Roteiro, RoteiroVariation, CalendarioItem, ConteudoPost, Blueprint, ConteudoPerfil, VideoJob } from '../types'
import { useContextMenu } from '../components/ContextMenu'
import {
  Wand2, Calendar, Megaphone, Lightbulb, Sparkles, Copy, Trash2, Plus, Loader2,
  Check, RefreshCw, Send, Eye, Heart, MessageCircle, Share2, Rocket, Film, Save,
  Download, X, Clapperboard, Upload, Server,
} from 'lucide-react'
import { hyperframesComposition, videoUseBrief, downloadText } from '../lib/videoStudio'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const TABS = [
  { id: 'roteiros', label: 'Roteiros', icon: <Film size={15} strokeWidth={1.7} /> },
  { id: 'calendario', label: 'Calendário', icon: <Calendar size={15} strokeWidth={1.7} /> },
  { id: 'publicacoes', label: 'Publicações', icon: <Megaphone size={15} strokeWidth={1.7} /> },
  { id: 'videos', label: 'Vídeos', icon: <Clapperboard size={15} strokeWidth={1.7} /> },
  { id: 'blueprint', label: 'Gerador de Prompt', icon: <Lightbulb size={15} strokeWidth={1.7} /> },
] as const
type TabId = typeof TABS[number]['id']

const STATUS_META: Record<string, { label: string; color: string }> = {
  planejado: { label: 'Planejado', color: '#64D2FF' },
  gravado: { label: 'Gravado', color: '#FF9F0A' },
  publicado: { label: 'Publicado', color: '#30D158' },
}

function ScoreBar({ label, value }: { label: string; value?: number }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const color = v >= 75 ? 'var(--accent-green)' : v >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)'
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div className="row--between" style={{ fontSize: 10.5, marginBottom: 3 }}>
        <span className="dim">{label}</span><span style={{ color, fontWeight: 700 }}>{v}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-2)' }}>
        <div style={{ width: `${v}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
    </div>
  )
}

function VariationCard({ v, onSalvar, onAgendar, onPublicar, onVideo }: {
  v: RoteiroVariation; onSalvar: () => void; onAgendar: () => void; onPublicar: () => void; onVideo: () => void
}) {
  const menu = useContextMenu()
  return (
    <div className="card card--pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row wrap" style={{ gap: 6 }}>
        {v.hook_formula && <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{v.hook_formula}</span>}
        {v.visual_hook && <span className="badge" style={{ background: 'var(--surface-2)' }}>{v.visual_hook}</span>}
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{v.hook}</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{v.script}</p>
      {!!(v.keywords && v.keywords.length) && (
        <div className="row wrap" style={{ gap: 5 }}>
          {v.keywords!.map((k, i) => <span key={i} className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }}>{k}</span>)}
        </div>
      )}
      <div className="row" style={{ gap: 12 }}>
        <ScoreBar label="Retenção 3s" value={v.retencao_3s} />
        <ScoreBar label="Completion" value={v.completion_estimada} />
        <ScoreBar label="Viral" value={v.viral_score ?? v.estimated_retention} />
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 'auto' }}>
        <button className="btn btn--primary btn--sm" onClick={onSalvar}><Save size={12} /> Salvar</button>
        <button className="btn btn--ghost btn--sm" onClick={onVideo}><Clapperboard size={12} /> Vídeo</button>
        <button className="btn btn--ghost btn--sm" onClick={onAgendar}><Calendar size={12} /> Agendar</button>
        <button className="btn btn--ghost btn--sm" onClick={onPublicar}><Megaphone size={12} /> Publicar</button>
        <button className="btn btn--ghost btn--sm" onClick={() => menu.copy(v.script || '', 'Roteiro copiado')}><Copy size={12} /> Copiar</button>
      </div>
    </div>
  )
}

function VideoStudioModal({ v, cliente, clienteId, onClose }: { v: RoteiroVariation; cliente: string | null; clienteId: string; onClose: () => void }) {
  const menu = useContextMenu()
  const [tab, setTab] = useState<'servidor' | 'grafismo' | 'edicao'>('servidor')
  const comp = hyperframesComposition(v, { cliente: cliente || undefined })
  const brief = videoUseBrief(v, cliente || undefined)

  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [job, setJob] = useState<VideoJob | null>(null)
  const [storage, setStorage] = useState<{ dir: string; freeGB: number } | null>(null)
  useEffect(() => { api.getVideoStorage().then(setStorage).catch(() => {}) }, [])

  const enviar = async () => {
    if (!files.length) { menu.toast('Selecione ao menos um vídeo', 'error'); return }
    setUploading(true); setJob({ id: '', state: 'queued', step: 'enviando…' })
    try {
      const { jobId } = await api.uploadVideoJob(files, v, clienteId || undefined)
      for (let i = 0; i < 240; i++) {
        await sleep(3000)
        let st: VideoJob
        try { st = await api.getVideoJob(jobId) } catch { continue }
        setJob(st)
        if (st.state === 'done' || st.state === 'error') break
      }
    } catch (e: unknown) {
      menu.toast(e instanceof Error ? e.message : 'Erro no upload', 'error'); setJob(null)
    } finally { setUploading(false) }
  }

  const publicar = async () => {
    try { await api.publicarPost({ clienteId: clienteId || null, plataforma: 'instagram', legenda: v.title || v.hook || '', retencao: v.retencao_3s, viralScore: v.viral_score }); menu.toast('Publicação registrada') }
    catch { menu.toast('Erro', 'error') }
  }

  const fmtMB = (n?: number) => n ? `${(n / 1048576).toFixed(1)} MB` : ''
  const done = job?.state === 'done'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="row--between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="row" style={{ gap: 9 }}>
            <Clapperboard size={18} style={{ color: 'var(--accent-purple)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Estúdio de Vídeo</h2>
          </div>
          <button onClick={onClose} className="btn-icon btn-icon--sm" style={{ borderRadius: '50%' }}><X size={14} strokeWidth={2} /></button>
        </div>

        <div className="row wrap" style={{ gap: 6, padding: '12px 20px 0' }}>
          <button className={'btn btn--pill btn--sm' + (tab === 'servidor' ? ' btn--accent-soft' : '')} onClick={() => setTab('servidor')}><Server size={13} /> Editar no servidor</button>
          <button className={'btn btn--pill btn--sm' + (tab === 'grafismo' ? ' btn--accent-soft' : '')} onClick={() => setTab('grafismo')}><Film size={13} /> Grafismo (HyperFrames)</button>
          <button className={'btn btn--pill btn--sm' + (tab === 'edicao' ? ' btn--accent-soft' : '')} onClick={() => setTab('edicao')}><Wand2 size={13} /> Edição (video-use)</button>
        </div>

        <div className="scroll" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'servidor' && (
            <>
              <p className="dim" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                Suba o material bruto — o servidor corta pra <b>9:16</b>, normaliza o áudio e <b>queima as legendas deste roteiro</b>, devolvendo o <b>final.mp4</b>. (Sem avatar; ideal pra clipes curtos.)
              </p>
              {storage && storage.freeGB > 0 && (
                <p className="dim" style={{ fontSize: 11, margin: '-4px 0 0' }}>Armazenamento: <code>{storage.dir}</code> · {storage.freeGB} GB livres</p>
              )}
              {!done && (
                <>
                  <label className="card card--pad" style={{ cursor: 'pointer', textAlign: 'center', borderStyle: 'dashed' }}>
                    <input type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files || []))} />
                    <Upload size={22} style={{ color: 'var(--text-tertiary)' }} />
                    <p style={{ margin: '6px 0 0', fontSize: 12.5 }}>{files.length ? `${files.length} arquivo(s): ${files.map(f => f.name).join(', ').slice(0, 60)}` : 'Clique para escolher os vídeos (até 8, 200MB cada)'}</p>
                  </label>
                  <button className="btn btn--primary" onClick={enviar} disabled={uploading || !files.length} style={{ justifyContent: 'center' }}>
                    {uploading ? <Loader2 size={15} className="spin" /> : <Server size={15} />}
                    {uploading ? (job?.step || 'Processando…') : 'Enviar e editar'}
                  </button>
                </>
              )}
              {job && job.state !== 'done' && job.state !== 'error' && (
                <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}><Loader2 size={14} className="spin" /> {job.step || job.state}…</div>
              )}
              {job?.state === 'error' && (
                <div className="card card--pad" style={{ background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)', color: 'var(--accent-red)', fontSize: 12.5 }}>Falhou: {job.error}</div>
              )}
              {done && (
                <>
                  <video src={api.videoFinalUrl(job!.id)} controls playsInline style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000' }} />
                  <div className="row wrap" style={{ gap: 7 }}>
                    <a className="btn btn--primary btn--sm" href={api.videoFinalUrl(job!.id)} download={`${job!.id}.mp4`}><Download size={13} /> Baixar {fmtMB(job!.size)}</a>
                    <button className="btn btn--ghost btn--sm" onClick={publicar}><Megaphone size={13} /> Registrar publicação</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setJob(null); setFiles([]) }}><Upload size={13} /> Editar outro</button>
                  </div>
                </>
              )}
            </>
          )}
          {tab === 'grafismo' && (
            <>
              <p className="dim" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                Composição 9:16 gerada do roteiro (intro + legendas animadas via GSAP). Baixe o <b>.html</b>, jogue num projeto HyperFrames e renderize: <code>npx hyperframes render</code>.
              </p>
              <div className="card card--pad" style={{ background: 'var(--surface-2)', maxHeight: 320, overflow: 'auto' }}>
                <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace' }}>{comp.html}</pre>
              </div>
              <div className="row wrap" style={{ gap: 7 }}>
                <button className="btn btn--primary btn--sm" onClick={() => downloadText(comp.filename, comp.html, 'text/html')}><Download size={13} /> Baixar {comp.filename}</button>
                <button className="btn btn--ghost btn--sm" onClick={() => menu.copy(comp.html, 'HTML copiado')}><Copy size={13} /> Copiar HTML</button>
              </div>
            </>
          )}
          {tab === 'edicao' && (
            <>
              <p className="dim" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                Briefing pronto para o <b>video-use</b> (skill do Claude Code). Salve o <b>project.md</b> na pasta dos vídeos brutos e rode os comandos abaixo.
              </p>
              <div>
                <label className="label">project.md</label>
                <div className="card card--pad" style={{ background: 'var(--surface-2)', maxHeight: 220, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{brief.projectMd}</pre>
                </div>
                <div className="row wrap" style={{ gap: 7, marginTop: 8 }}>
                  <button className="btn btn--primary btn--sm" onClick={() => downloadText('project.md', brief.projectMd, 'text/markdown')}><Download size={13} /> Baixar project.md</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => menu.copy(brief.projectMd, 'Briefing copiado')}><Copy size={13} /> Copiar</button>
                </div>
              </div>
              <div>
                <label className="label">Comandos (instalar + editar)</label>
                <div className="card card--pad" style={{ background: 'var(--surface-2)', maxHeight: 200, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace' }}>{brief.comandos}</pre>
                </div>
                <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => menu.copy(brief.comandos, 'Comandos copiados')}><Copy size={13} /> Copiar comandos</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RoteirosTab({ clienteId, cliente }: { clienteId: string; cliente: CrmLead | null }) {
  const menu = useContextMenu()
  const [theme, setTheme] = useState('')
  const [count, setCount] = useState(3)
  const [gerando, setGerando] = useState(false)
  const [variations, setVariations] = useState<RoteiroVariation[]>([])
  const [salvos, setSalvos] = useState<Roteiro[]>([])
  const [perfil, setPerfil] = useState<ConteudoPerfil>({})
  const [videoFor, setVideoFor] = useState<RoteiroVariation | null>(null)

  const loadSalvos = useCallback(() => {
    api.getRoteiros(clienteId || undefined).then(r => setSalvos(r.roteiros)).catch(() => {})
  }, [clienteId])

  useEffect(() => {
    loadSalvos()
    setVariations([])
    if (clienteId) api.getPerfilConteudo(clienteId).then(setPerfil).catch(() => setPerfil({}))
    else setPerfil({})
  }, [clienteId, loadSalvos])

  const salvarPerfil = async () => {
    if (!clienteId) return
    try { await api.setPerfilConteudo(clienteId, perfil); menu.toast('Perfil salvo') } catch { menu.toast('Erro ao salvar perfil', 'error') }
  }

  const gerar = async () => {
    if (!theme.trim()) { menu.toast('Informe o tema do vídeo', 'error'); return }
    setGerando(true); setVariations([])
    try {
      const c = { nome: cliente?.nome, segmento: cliente?.segmento, ...perfil }
      const { jobId } = await api.gerarRoteiros({ cliente: c, theme: theme.trim(), count })
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2500))
        const r = await api.getRoteiroJob(jobId)
        if (r.status === 'done') { setVariations(r.variations || []); if (!r.variations?.length) menu.toast('Sem roteiros — tente outro tema', 'info'); break }
        if (r.status === 'error') { menu.toast(r.error || 'Erro ao gerar', 'error'); break }
      }
    } catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro', 'error') }
    finally { setGerando(false) }
  }

  const salvar = async (v: RoteiroVariation) => {
    try { await api.saveRoteiro(clienteId || null, theme, v); loadSalvos(); menu.toast('Roteiro salvo') } catch { menu.toast('Erro ao salvar', 'error') }
  }
  const agendar = async (v: RoteiroVariation) => {
    try { await api.addCalendario({ clienteId: clienteId || null, theme: v.title || theme, status: 'planejado' }); menu.toast('Adicionado ao calendário') } catch { menu.toast('Erro', 'error') }
  }
  const publicar = async (v: RoteiroVariation) => {
    try { await api.publicarPost({ clienteId: clienteId || null, plataforma: 'instagram', legenda: v.title || v.hook || '', retencao: v.retencao_3s, viralScore: v.viral_score }); menu.toast('Publicação registrada (veja em Publicações)') } catch { menu.toast('Erro', 'error') }
  }
  const excluir = async (id: string) => {
    try { await api.deleteRoteiro(id); setSalvos(prev => prev.filter(r => r.id !== id)); menu.toast('Roteiro removido') } catch { menu.toast('Erro', 'error') }
  }

  return (
    <div className="col gap-6">
      {videoFor && <VideoStudioModal v={videoFor} cliente={cliente?.nome || null} clienteId={clienteId} onClose={() => setVideoFor(null)} />}
      <div className="card card--pad col" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label className="label">Tema do vídeo</label>
            <input className="input" value={theme} onChange={e => setTheme(e.target.value)} placeholder='Ex.: "o erro que trava o resultado no seu nicho"' onKeyDown={e => e.key === 'Enter' && gerar()} />
          </div>
          <div style={{ width: 90 }}>
            <label className="label">Variações</label>
            <select className="select" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn btn--primary" onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
            {gerando ? 'Gerando…' : 'Gerar roteiros'}
          </button>
        </div>
        {clienteId && (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)' }}>Perfil do cliente (melhora os roteiros)</summary>
            <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
              <input className="input" style={{ flex: 1, minWidth: 150 }} value={perfil.tom || ''} onChange={e => setPerfil(p => ({ ...p, tom: e.target.value }))} placeholder="Tom de voz" />
              <input className="input" style={{ flex: 1, minWidth: 150 }} value={perfil.publico || ''} onChange={e => setPerfil(p => ({ ...p, publico: e.target.value }))} placeholder="Público" />
              <input className="input" style={{ flex: 1, minWidth: 150 }} value={perfil.objetivo || ''} onChange={e => setPerfil(p => ({ ...p, objetivo: e.target.value }))} placeholder="Objetivo do conteúdo" />
              <button className="btn btn--ghost btn--sm" onClick={salvarPerfil}><Save size={13} /> Salvar perfil</button>
            </div>
          </details>
        )}
      </div>

      {gerando && variations.length === 0 && (
        <p className="dim" style={{ fontSize: 13, margin: 0 }}>O roteirista está escrevendo {count} variação(ões) com hooks de retenção… (~15–40s)</p>
      )}

      {variations.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, alignItems: 'stretch' }}>
          {variations.map((v, i) => <VariationCard key={i} v={v} onSalvar={() => salvar(v)} onAgendar={() => agendar(v)} onPublicar={() => publicar(v)} onVideo={() => setVideoFor(v)} />)}
        </div>
      )}

      <div>
        <label className="label">Roteiros salvos ({salvos.length})</label>
        {salvos.length === 0 ? (
          <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>Nenhum roteiro salvo ainda.</p>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {salvos.map(r => (
              <div key={r.id} className="card card--pad row--between" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{r.hook || r.title || r.theme}</p>
                  <p className="dim truncate" style={{ margin: '2px 0 0', fontSize: 11 }}>{r.theme} · viral {r.viral_score ?? r.estimated_retention ?? '—'}%</p>
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <button className="btn-icon btn-icon--sm" title="Estúdio de Vídeo" onClick={() => setVideoFor(r)}><Clapperboard size={13} /></button>
                  <button className="btn-icon btn-icon--sm" title="Copiar" onClick={() => menu.copy(r.script || '', 'Copiado')}><Copy size={13} /></button>
                  <button className="btn-icon btn-icon--sm" title="Excluir" onClick={() => excluir(r.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CalendarioTab({ clienteId }: { clienteId: string }) {
  const menu = useContextMenu()
  const [items, setItems] = useState<CalendarioItem[]>([])
  const [count, setCount] = useState(20)

  const load = useCallback(() => { api.getCalendario(clienteId || undefined).then(r => setItems(r.calendario)).catch(() => {}) }, [clienteId])
  useEffect(() => { load() }, [load])

  const plan = async () => {
    if (!clienteId) { menu.toast('Selecione um cliente para gerar o plano', 'error'); return }
    try { await api.planCalendario(clienteId, { count, perWeek: 5 }); load(); menu.toast(`${count} datas adicionadas`) } catch { menu.toast('Erro', 'error') }
  }
  const addManual = async () => {
    const theme = await menu.prompt({ title: 'Novo item', message: 'Tema do post', confirmLabel: 'Adicionar' })
    if (!theme) return
    try { await api.addCalendario({ clienteId: clienteId || null, theme }); load() } catch { menu.toast('Erro', 'error') }
  }
  const cycleStatus = async (it: CalendarioItem) => {
    const order = ['planejado', 'gravado', 'publicado']
    const next = order[(order.indexOf(it.status) + 1) % order.length]
    try { const u = await api.updateCalendario(it.id, { status: next }); setItems(prev => prev.map(x => x.id === it.id ? u : x)) } catch { menu.toast('Erro', 'error') }
  }
  const excluir = async (id: string) => {
    try { await api.deleteCalendario(id); setItems(prev => prev.filter(x => x.id !== id)) } catch { menu.toast('Erro', 'error') }
  }

  return (
    <div className="col gap-4">
      <div className="card card--pad row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
        <div style={{ width: 110 }}>
          <label className="label">Qtd. de datas</label>
          <select className="select" value={count} onChange={e => setCount(Number(e.target.value))}>
            {[10, 20, 30, 60].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button className="btn btn--primary" onClick={plan}><Sparkles size={15} /> Gerar plano (seg–sex)</button>
        <button className="btn btn--ghost" onClick={addManual}><Plus size={15} /> Adicionar manual</button>
        <div style={{ flex: 1 }} />
        <button className="btn-icon" onClick={load} title="Atualizar"><RefreshCw size={15} strokeWidth={1.7} /></button>
      </div>

      {items.length === 0 ? (
        <div className="empty"><Calendar size={40} strokeWidth={1} /><p className="muted">Nenhuma data planejada. Gere um plano para começar.</p></div>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          {items.map(it => {
            const m = STATUS_META[it.status] || STATUS_META.planejado
            return (
              <div key={it.id} className="card card--pad row--between" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 12, minWidth: 0 }}>
                  <span className="badge" style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{new Date(it.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  <span className="truncate" style={{ fontSize: 13 }}>{it.theme}</span>
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <button className="badge" onClick={() => cycleStatus(it)} title="Mudar status"
                    style={{ cursor: 'pointer', background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color, border: 'none' }}>
                    {m.label}
                  </button>
                  <button className="btn-icon btn-icon--sm" title="Excluir" onClick={() => excluir(it.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PublicacoesTab({ clienteId }: { clienteId: string }) {
  const menu = useContextMenu()
  const [posts, setPosts] = useState<ConteudoPost[]>([])

  const load = useCallback(() => { api.getPosts(clienteId || undefined).then(r => setPosts(r.posts)).catch(() => {}) }, [clienteId])
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv) }, [load])

  const totals = posts.reduce((t, p) => ({
    views: t.views + (p.metrics?.views || 0), likes: t.likes + (p.metrics?.likes || 0),
    comments: t.comments + (p.metrics?.comments || 0), shares: t.shares + (p.metrics?.shares || 0),
  }), { views: 0, likes: 0, comments: 0, shares: 0 })

  const excluir = async (id: string) => {
    try { await api.deletePost(id); setPosts(prev => prev.filter(p => p.id !== id)) } catch { menu.toast('Erro', 'error') }
  }
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div className="col gap-4">
      <div className="grid grid--4" style={{ gap: 10 }}>
        {[
          { icon: <Eye size={16} />, label: 'Views', v: totals.views },
          { icon: <Heart size={16} />, label: 'Likes', v: totals.likes },
          { icon: <MessageCircle size={16} />, label: 'Comentários', v: totals.comments },
          { icon: <Share2 size={16} />, label: 'Shares', v: totals.shares },
        ].map((k, i) => (
          <div key={i} className="card card--pad col" style={{ gap: 4 }}>
            <span className="row dim" style={{ gap: 6, fontSize: 11.5 }}>{k.icon} {k.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{fmt(k.v)}</span>
          </div>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="empty"><Megaphone size={40} strokeWidth={1} /><p className="muted">Nenhuma publicação ainda. Publique um roteiro na aba Roteiros.</p></div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {posts.map(p => (
            <div key={p.id} className="card card--pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row--between" style={{ gap: 10 }}>
                <span className="truncate" style={{ fontSize: 13, fontWeight: 600, minWidth: 0 }}>{p.legenda || '(sem legenda)'}</span>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <span className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }}>{p.plataforma}</span>
                  <button className="btn-icon btn-icon--sm" title="Excluir" onClick={() => excluir(p.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="row wrap" style={{ gap: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span className="row" style={{ gap: 5 }}><Eye size={13} /> {fmt(p.metrics?.views || 0)}</span>
                <span className="row" style={{ gap: 5 }}><Heart size={13} /> {fmt(p.metrics?.likes || 0)}</span>
                <span className="row" style={{ gap: 5 }}><MessageCircle size={13} /> {fmt(p.metrics?.comments || 0)}</span>
                <span className="row" style={{ gap: 5 }}><Share2 size={13} /> {fmt(p.metrics?.shares || 0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VideosTab({ clienteId }: { clienteId: string }) {
  const menu = useContextMenu()
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [storage, setStorage] = useState<{ dir: string; freeGB: number } | null>(null)

  const load = useCallback(() => { api.getVideoJobs(clienteId || undefined).then(r => setJobs(r.jobs)).catch(() => {}) }, [clienteId])
  useEffect(() => {
    load(); api.getVideoStorage().then(setStorage).catch(() => {})
    const iv = setInterval(load, 8000); return () => clearInterval(iv)
  }, [load])

  const excluir = async (id: string) => {
    const ok = await menu.confirm({ title: 'Excluir vídeo', message: 'Remover este vídeo do servidor?', danger: true, confirmLabel: 'Excluir' })
    if (!ok) return
    try { await api.deleteVideoJob(id); setJobs(prev => prev.filter(j => j.id !== id)) } catch { menu.toast('Erro', 'error') }
  }
  const fmtMB = (n?: number) => n ? `${(n / 1048576).toFixed(1)} MB` : ''

  return (
    <div className="col gap-4">
      <div className="row--between" style={{ gap: 12 }}>
        <p className="dim" style={{ fontSize: 13, margin: 0 }}>
          {jobs.length} vídeo{jobs.length === 1 ? '' : 's'}{storage && storage.freeGB > 0 ? ` · ${storage.freeGB} GB livres em ${storage.dir}` : ''}
        </p>
        <button className="btn-icon" onClick={load} title="Atualizar"><RefreshCw size={15} strokeWidth={1.7} /></button>
      </div>

      {jobs.length === 0 ? (
        <div className="empty"><Clapperboard size={40} strokeWidth={1} /><p className="muted">Nenhum vídeo editado ainda. Gere um roteiro e use “Vídeo → Editar no servidor”.</p></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignItems: 'stretch' }}>
          {jobs.map(j => (
            <div key={j.id} className="card card--pad col" style={{ gap: 10 }}>
              {j.state === 'done' ? (
                <video src={api.videoFinalUrl(j.id)} controls playsInline style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 360 }} />
              ) : j.state === 'error' ? (
                <div className="card card--pad" style={{ background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)', color: 'var(--accent-red)', fontSize: 12 }}>Falhou: {j.error}</div>
              ) : (
                <div className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', padding: '20px 4px' }}><Loader2 size={15} className="spin" /> {j.step || j.state}…</div>
              )}
              <div className="row--between" style={{ gap: 8 }}>
                <span className="row" style={{ gap: 6, minWidth: 0 }}>
                  <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>{j.titulo || j.id}</span>
                  {j.legendas === 'sincronizada' && <span className="badge" style={{ flexShrink: 0, background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)', color: 'var(--accent-green)' }}>sinc.</span>}
                </span>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  {j.state === 'done' && <a className="btn-icon btn-icon--sm" title={`Baixar ${fmtMB(j.size)}`} href={api.videoFinalUrl(j.id)} download={`${j.id}.mp4`}><Download size={13} /></a>}
                  <button className="btn-icon btn-icon--sm" title="Excluir" onClick={() => excluir(j.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TIPO_META: Record<string, { label: string; color: string }> = {
  landing: { label: 'Landing Page', color: '#0A84FF' },
  crm: { label: 'CRM', color: '#BF5AF2' },
  app: { label: 'Aplicativo', color: '#30D158' },
}

function BlueprintTab({ clienteId, cliente }: { clienteId: string; cliente: CrmLead | null }) {
  const menu = useContextMenu()
  const [gerando, setGerando] = useState(false)
  const [bp, setBp] = useState<Blueprint | null>(null)
  const [salvos, setSalvos] = useState<Blueprint[]>([])

  const load = useCallback(() => { api.getBlueprints(clienteId || undefined).then(r => setSalvos(r.blueprints)).catch(() => {}) }, [clienteId])
  useEffect(() => { load(); setBp(null) }, [load])

  const gerar = async () => {
    if (!cliente) { menu.toast('Selecione um cliente', 'error'); return }
    setGerando(true); setBp(null)
    try {
      const { jobId } = await api.gerarBlueprint({ nome: cliente.nome, segmento: cliente.segmento, contato: cliente.contato, observacao: cliente.observacao })
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2500))
        const r = await api.getBlueprintJob(jobId)
        if (r.status === 'done') { if (r.blueprint) setBp(r.blueprint); else menu.toast('Não consegui montar — tente de novo', 'info'); break }
        if (r.status === 'error') { menu.toast(r.error || 'Erro', 'error'); break }
      }
    } catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro', 'error') }
    finally { setGerando(false) }
  }

  const salvar = async () => {
    if (!bp) return
    try { await api.saveBlueprint(clienteId || null, bp); load(); menu.toast('Blueprint salvo') } catch { menu.toast('Erro', 'error') }
  }
  const excluir = async (id?: string) => {
    if (!id) return
    try { await api.deleteBlueprint(id); setSalvos(prev => prev.filter(b => b.id !== id)) } catch { menu.toast('Erro', 'error') }
  }

  const render = (b: Blueprint, saved: boolean) => {
    const tm = TIPO_META[b.tipo_recomendado] || { label: b.tipo_recomendado, color: 'var(--accent)' }
    return (
      <div className="card card--pad col" style={{ gap: 12 }}>
        <div className="row--between" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            <span className="badge" style={{ background: `color-mix(in srgb, ${tm.color} 16%, transparent)`, color: tm.color }}><Rocket size={11} /> {tm.label}</span>
            <span className="truncate" style={{ fontSize: 14, fontWeight: 700 }}>{b.nome_projeto}</span>
          </div>
          <div className="row" style={{ gap: 6, flexShrink: 0 }}>
            <button className="btn-icon btn-icon--sm" title="Copiar prompt" onClick={() => menu.copy(b.prompt, 'Prompt copiado')}><Copy size={13} /></button>
            {saved ? <button className="btn-icon btn-icon--sm" title="Excluir" onClick={() => excluir(b.id)}><Trash2 size={13} /></button>
              : <button className="btn-icon btn-icon--sm" title="Salvar" onClick={salvar}><Save size={13} /></button>}
          </div>
        </div>
        {b.justificativa && <p className="dim" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{b.justificativa}</p>}
        {!!(b.funcionalidades && b.funcionalidades.length) && (
          <div className="row wrap" style={{ gap: 5 }}>
            {b.funcionalidades!.map((f, i) => <span key={i} className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }}>{f}</span>)}
          </div>
        )}
        <div>
          <label className="label">Prompt pronto para colar (v0 / Lovable / Claude)</label>
          <div className="card card--pad" style={{ background: 'var(--surface-2)', maxHeight: 260, overflow: 'auto' }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{b.prompt}</p>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 14, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          {b.stack_sugerida && <span>Stack: {b.stack_sugerida}</span>}
          {b.primeiro_passo && <span>1º passo: {b.primeiro_passo}</span>}
        </div>
        <button className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => menu.copy(b.prompt, 'Prompt copiado')}><Copy size={13} /> Copiar prompt</button>
      </div>
    )
  }

  return (
    <div className="col gap-6">
      <div className="card card--pad row--between wrap" style={{ gap: 10 }}>
        <p className="dim" style={{ margin: 0, fontSize: 13 }}>
          {cliente ? <>A IA analisa <b style={{ color: 'var(--text-primary)' }}>{cliente.nome}</b> e gera o prompt ideal (landing, CRM ou app).</> : 'Selecione um cliente acima para gerar o blueprint.'}
        </p>
        <button className="btn btn--primary" onClick={gerar} disabled={gerando || !cliente}>
          {gerando ? <Loader2 size={15} className="spin" /> : <Lightbulb size={15} />}
          {gerando ? 'Analisando…' : 'Gerar prompt ideal'}
        </button>
      </div>

      {gerando && !bp && <p className="dim" style={{ fontSize: 13, margin: 0 }}>Analisando o negócio e montando o spec… (~15–40s)</p>}
      {bp && render(bp, false)}

      {salvos.length > 0 && (
        <div className="col gap-4">
          <label className="label">Blueprints salvos ({salvos.length})</label>
          {salvos.map(b => <div key={b.id}>{render(b, true)}</div>)}
        </div>
      )}
    </div>
  )
}

export default function Conteudo() {
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [clienteId, setClienteId] = useState('')
  const [tab, setTab] = useState<TabId>('roteiros')

  useEffect(() => { api.getCrm().then(r => setLeads(r.leads)).catch(() => {}) }, [])
  const cliente = leads.find(l => l.id === clienteId) || null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Conteúdo</h1>
          <p className="page-sub">Roteiros virais, calendário e publicações por cliente</p>
        </div>
        <div className="page-head-actions">
          <select className="select" value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Sem cliente (genérico)</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="row scroll" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={'btn btn--pill' + (tab === t.id ? ' btn--accent-soft' : '')} style={{ flexShrink: 0 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="anim-fade" key={tab + clienteId}>
        {tab === 'roteiros' && <RoteirosTab clienteId={clienteId} cliente={cliente} />}
        {tab === 'calendario' && <CalendarioTab clienteId={clienteId} />}
        {tab === 'publicacoes' && <PublicacoesTab clienteId={clienteId} />}
        {tab === 'videos' && <VideosTab clienteId={clienteId} />}
        {tab === 'blueprint' && <BlueprintTab clienteId={clienteId} cliente={cliente} />}
      </div>
    </div>
  )
}
