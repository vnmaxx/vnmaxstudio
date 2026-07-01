import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { pushNotification } from '../components/NotificationBell'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import { useAuth } from '../contexts/AuthContext'
import type { Agent, SystemStatus, Stats } from '../types'
import CEO from './CEO'
import {
  Terminal, Globe, Pencil, BookOpen,
  Play, Loader2, X, Check, Save,
  Users, FileText, Megaphone, Mail, Package,
  AlertCircle, Activity, TrendingUp, Clock, Copy, CopyPlus,
  LayoutDashboard, Briefcase, GitBranch, Plus, Upload, Trash2, GripVertical, ExternalLink,
} from 'lucide-react'

type AgentsMap = Record<string, Agent>

const AGENT_MASCOT_IMG: Record<string, string> = {
  'code':            '/mascots/p4.png',   // fones + livro de código
  'design':          '/mascots/p17.png',  // rolos de tinta
  'research':        '/mascots/p11.png',  // detetive c/ lupa
  'general':         '/mascots/p16.png',  // professor (sabe de tudo)
  'studio-ceo':      '/mascots/p3.png',   // executivo c/ maleta
  'studio-growth':   '/mascots/p5.png',   // câmera (conteúdo/viral)
  'studio-clientes': '/mascots/p15.png',  // prancheta/atendimento
  'studio-trafego':  '/mascots/p12.png',  // guarda de trânsito
  'studio-dados':    '/mascots/p9.png',   // cientista (análise)
  'studio-criacao':  '/mascots/p24.png',  // mago (criação)
  'studio-sdr':      '/mascots/p19.png',  // entregador (abordagem)
}

const MASCOT_OPTIONS = Array.from({ length: 24 }, (_, i) => `/mascots/p${i + 1}.png`)

function AgentMascot({ name, size = 48, icon }: { name: string; size?: number; icon?: string }) {
  const src = icon || AGENT_MASCOT_IMG[name] || '/mascots/p16.png'
  return <img src={src} alt={name} width={size} height={size} style={{ flexShrink: 0, objectFit: 'contain' }} />
}

const MODEL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  opus:   { bg: 'rgba(255,159,10,0.15)',  color: '#FF9F0A', border: 'rgba(255,159,10,0.3)'  },
  sonnet: { bg: 'rgba(10,132,255,0.15)',  color: '#0A84FF', border: 'rgba(10,132,255,0.3)'  },
  haiku:  { bg: 'rgba(48,209,88,0.15)',   color: '#30D158', border: 'rgba(48,209,88,0.3)'   },
}

const TOOL_META: Record<string, { label: string }> = {
  shell: { label: 'Shell' },
  web:   { label: 'Web' },
  edit:  { label: 'Editar arquivos' },
  read:  { label: 'Ler arquivos' },
}

function classifyLog(line: string): string {
  if (line.includes('ERRO') || line.includes('error')) return 'var(--accent-red)'
  if (line.includes('AVISO') || line.includes('WARN'))  return 'var(--accent-yellow)'
  if (line.includes('=== CICLO') || line.includes('CICLO ')) return 'var(--accent)'
  if (line.includes('done') || line.includes('OK') || line.includes('sucesso')) return 'var(--accent-green)'
  return 'rgba(255,255,255,0.7)'
}

function ModelBadge({ model }: { model: string }) {
  const c = MODEL_COLORS[model] || { bg: 'var(--surface-3)', color: 'var(--text-secondary)', border: 'var(--border)' }
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 9, padding: '1px 6px', borderRadius: 5, fontWeight: 600, letterSpacing: '0.02em' }}>
      {model}
    </span>
  )
}

function ToolIcon({ label, active }: { label: string; active: boolean }) {
  const icons: Record<string, React.ReactNode> = {
    shell: <Terminal size={12} strokeWidth={1.5} />,
    web:   <Globe size={12} strokeWidth={1.5} />,
    edit:  <Pencil size={12} strokeWidth={1.5} />,
    read:  <BookOpen size={12} strokeWidth={1.5} />,
  }
  return (
    <span style={{ opacity: active ? 1 : 0.18, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center' }} title={TOOL_META[label]?.label}>
      {icons[label]}
    </span>
  )
}

function AgentModal({ name, agent, onClose, onSaved }: { name: string; agent: Agent; onClose: () => void; onSaved: (updated: Agent) => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [form, setForm] = useState<Agent>({ ...agent })

  const toolIcons: Record<string, React.ReactNode> = {
    shell: <Terminal size={13} strokeWidth={1.5} />,
    web:   <Globe size={13} strokeWidth={1.5} />,
    edit:  <Pencil size={13} strokeWidth={1.5} />,
    read:  <BookOpen size={13} strokeWidth={1.5} />,
  }

  const startEdit = () => { setForm({ ...agent }); setSaveErr(''); setEditing(true) }
  const cancelEdit = () => { setEditing(false); setSaveErr('') }

  const handleSave = async () => {
    setSaving(true)
    setSaveErr('')
    try {
      await api.updateAgent(name, form)
      onSaved(form)
      setEditing(false)
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const viewAgent = editing ? form : agent
  const viewTools = viewAgent.tools || {}
  const activeTools = (['shell', 'web', 'edit', 'read'] as const).filter(t => !!(viewTools as Record<string, boolean>)[t])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="row--between" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="row" style={{ gap: 12 }}>
            <AgentMascot name={name} size={40} />
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px', textTransform: 'capitalize' }}>{name.replace('studio-', '')}</h2>
              <ModelBadge model={viewAgent.model} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {editing ? (
              <button onClick={cancelEdit} className="btn btn--sm btn--ghost">Cancelar</button>
            ) : (
              <button onClick={startEdit} className="btn btn--sm btn--accent-soft">
                <Pencil size={11} strokeWidth={2} /> Editar
              </button>
            )}
            <button onClick={onClose} className="btn-icon btn-icon--sm" style={{ borderRadius: '50%' }}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {editing ? (
            <>
              <div className="grid grid--2" style={{ gap: 12 }}>
                <div>
                  <label className="label">Modelo</label>
                  <select className="select" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value as Agent['model'] }))}>
                    <option value="opus">opus</option>
                    <option value="sonnet">sonnet</option>
                    <option value="haiku">haiku</option>
                  </select>
                </div>
                <div>
                  <label className="label">Max Turns</label>
                  <input className="input" type="number" min={1} max={200} value={form.maxTurns} onChange={e => setForm(f => ({ ...f, maxTurns: Number(e.target.value) }))} />
                </div>
              </div>

              <div>
                <label className="label">Capacidades</label>
                <div className="row wrap" style={{ gap: 8 }}>
                  {(['shell', 'web', 'edit', 'read'] as const).map(t => {
                    const on = !!(form.tools as Record<string, boolean>)[t]
                    return (
                      <button key={t} onClick={() => setForm(f => ({ ...f, tools: { ...f.tools, [t]: !on } }))}
                        className="chip" style={{ cursor: 'pointer', background: on ? 'var(--accent-soft)' : 'var(--surface)', borderColor: on ? 'var(--accent-line)' : 'var(--border)', color: on ? 'var(--accent-text)' : 'var(--text-tertiary)' }}>
                        <span style={{ display: 'flex' }}>{toolIcons[t]}</span>
                        {TOOL_META[t].label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label">System Prompt</label>
                <textarea className="textarea" value={form.system} onChange={e => setForm(f => ({ ...f, system: e.target.value }))} style={{ minHeight: 220, fontSize: 12 }} />
              </div>

              {saveErr && <p style={{ color: 'var(--accent-red)', fontSize: 12, margin: 0 }}>{saveErr}</p>}

              <button onClick={handleSave} disabled={saving} className="btn btn--success btn--lg" style={{ justifyContent: 'center' }}>
                {saving ? <Loader2 size={14} strokeWidth={2} className="spin" /> : <Save size={14} strokeWidth={2} />}
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </>
          ) : (
            <>
              <div className="grid grid--3" style={{ gap: 10 }}>
                {[
                  { value: agent.maxTurns, label: 'Max Turns' },
                  { value: activeTools.length, label: 'Ferramentas' },
                  { value: agent.model, label: 'Modelo', cap: true },
                ].map((s, i) => (
                  <div key={i} className="card card--pad" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, textTransform: s.cap ? 'capitalize' : undefined }}>{s.value}</div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="label">Capacidades</p>
                <div className="row wrap" style={{ gap: 8 }}>
                  {(['shell', 'web', 'edit', 'read'] as const).map(t => {
                    const on = !!(viewTools as Record<string, boolean>)[t]
                    return (
                      <span key={t} className="chip" style={{ background: on ? 'var(--surface-3)' : 'var(--surface)', color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        <span style={{ opacity: on ? 1 : 0.3, display: 'flex' }}>{toolIcons[t]}</span>
                        <span>{TOOL_META[t].label}</span>
                        <span style={{ color: on ? 'var(--accent-green)' : 'var(--text-tertiary)', display: 'flex' }}>{on ? <Check size={10} strokeWidth={2} /> : <X size={10} strokeWidth={2} />}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="label">System Prompt</p>
                <div className="mono" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {agent.system || '(sem system prompt)'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentCard({ name, agent, onClick, onChanged }: { name: string; agent: Agent; onClick: () => void; onChanged: () => void }) {
  const tools = agent.tools || {}
  const menu = useContextMenu()
  return (
    <button
      onClick={onClick}
      className="card card--hover card--pad"
      {...menu.bind((): CtxItem[] => [
        { header: name.replace('studio-', '') },
        { label: 'Editar agente', icon: <Pencil size={15} strokeWidth={1.8} />, onClick },
        { label: 'Duplicar agente', icon: <CopyPlus size={15} strokeWidth={1.8} />, onClick: async () => {
          try { await api.updateAgent(`${name}-copia`, { ...agent }); menu.flash('Agente duplicado'); onChanged() }
          catch (e: unknown) { menu.flash(e instanceof Error ? e.message : 'Erro ao duplicar') }
        } },
        { separator: true },
        { label: 'Copiar nome', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(name, 'Nome copiado') },
        { label: 'Copiar system prompt', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(agent.system || '', 'Prompt copiado'), disabled: !agent.system },
      ])}
      style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 7, padding: 12 }}
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        <AgentMascot name={name} size={38} icon={agent.icon} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row--between" style={{ marginBottom: 3 }}>
            <h3 className="truncate" style={{ fontWeight: 600, fontSize: 12.5, textTransform: 'capitalize', margin: 0 }}>{name.replace('studio-', '')}</h3>
            <ModelBadge model={agent.model} />
          </div>
          <p className="muted clamp-2" style={{ fontSize: 10.5, margin: 0, lineHeight: 1.45 }}>
            {agent.system?.slice(0, 80) || 'Sem descrição'}
          </p>
        </div>
      </div>
      <div className="row--between" style={{ borderTop: '1px solid var(--border)', paddingTop: 7 }}>
        <div className="row" style={{ gap: 6 }}>
          {(['shell', 'web', 'edit', 'read'] as const).map(t => (
            <ToolIcon key={t} label={t} active={!!(tools as Record<string, boolean>)[t]} />
          ))}
        </div>
        <span className="dim" style={{ fontSize: 10 }}>{agent.maxTurns}t</span>
      </div>
    </button>
  )
}

const KPI_DEFS = [
  { key: 'leads',    label: 'Leads',      icon: <Users size={16} strokeWidth={1.5} />,      color: '#0A84FF', to: '/workspace?p=leads' },
  { key: 'conteudo', label: 'Conteúdos',  icon: <FileText size={16} strokeWidth={1.5} />,   color: '#30D158', to: '/workspace?p=conteudo' },
  { key: 'campanhas',label: 'Campanhas',  icon: <Megaphone size={16} strokeWidth={1.5} />,  color: '#FF9F0A', to: '/workspace?p=campanhas' },
  { key: 'emails',   label: 'Emails',     icon: <Mail size={16} strokeWidth={1.5} />,        color: '#BF5AF2', to: '/workspace?p=emails' },
  { key: 'produtos', label: 'Produtos',   icon: <Package size={16} strokeWidth={1.5} />,    color: '#FF453A', to: '/workspace?p=produtos' },
  { key: 'reports',  label: 'Relatórios', icon: <TrendingUp size={16} strokeWidth={1.5} />, color: '#64D2FF', to: '/relatorios' },
]

function PendenciasCard() {
  const [itens, setItens] = useState<import('../types').Pendencia[]>([])
  const menu = useContextMenu()
  const load = useCallback(() => { api.getPendencias().then(r => setItens(r.itens)).catch(() => {}) }, [])
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [load])

  const resolver = async (id: string) => {
    try { await api.resolvePendencia(id); setItens(prev => prev.filter(i => i.id !== id)); menu.toast('Marcado como resolvido') }
    catch { menu.toast('Erro', 'error') }
  }
  if (itens.length === 0) return null
  const cor = (p: string) => p === 'alta' ? 'var(--accent-red)' : p === 'media' ? 'var(--accent-yellow)' : 'var(--text-tertiary)'

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title row" style={{ gap: 8 }}><AlertCircle size={14} style={{ color: 'var(--accent-yellow)' }} /> Ajustes pendentes <span className="dim" style={{ fontWeight: 400 }}>({itens.length})</span></span>
      </div>
      <div className="panel-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itens.slice(0, 12).map(p => (
          <div key={p.id} className="card card--pad row--between" style={{ gap: 10, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 7 }}>
                <span className="dot" style={{ background: cor(p.prioridade), width: 7, height: 7, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.titulo}</span>
              </div>
              {p.detalhe && <p className="dim" style={{ margin: '4px 0 0 14px', fontSize: 11.5, lineHeight: 1.45 }}>{p.detalhe}</p>}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => resolver(p.id)} style={{ flexShrink: 0 }}><Check size={12} /> Resolver</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {MASCOT_OPTIONS.map(m => (
        <button key={m} type="button" onClick={() => onChange(m)}
          style={{ padding: 4, borderRadius: 10, background: value === m ? 'var(--accent-soft)' : 'var(--surface-2)', border: `1.5px solid ${value === m ? 'var(--accent-line)' : 'transparent'}`, cursor: 'pointer' }}>
          <img src={m} alt="" width={34} height={34} style={{ objectFit: 'contain', display: 'block' }} />
        </button>
      ))}
    </div>
  )
}

function ToolToggle({ id, active, onClick }: { id: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={'btn btn--sm' + (active ? ' btn--accent-soft' : '')} style={{ opacity: active ? 1 : 0.65 }}>
      <ToolIcon label={id} active={active} /> {TOOL_META[id]?.label}
    </button>
  )
}

function NewAgentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const menu = useContextMenu()
  const [nome, setNome] = useState('')
  const [model, setModel] = useState<'opus' | 'sonnet' | 'haiku'>('sonnet')
  const [maxTurns, setMaxTurns] = useState(40)
  const [tools, setTools] = useState<Record<string, boolean>>({ shell: false, web: true, edit: false, read: false })
  const [system, setSystem] = useState('')
  const [icon, setIcon] = useState('/mascots/p16.png')
  const [saving, setSaving] = useState(false)

  const id = nome.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const onFile = async (f?: File) => {
    if (!f) return
    const txt = await f.text()
    setSystem(txt)
    if (!nome.trim()) setNome(f.name.replace(/\.(md|txt)$/i, ''))
  }
  const salvar = async () => {
    if (!id) { menu.toast('Dê um nome ao agente', 'error'); return }
    if (!system.trim()) { menu.toast('Envie o .md ou escreva como o agente se comporta', 'error'); return }
    setSaving(true)
    try { await api.updateAgent(id, { model, maxTurns, tools: tools as never, system, icon }); onSaved() }
    catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro ao criar', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="row--between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="row" style={{ gap: 10 }}><AgentMascot name="" size={30} icon={icon} /><h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Novo agente</h2></div>
          <button onClick={onClose} className="btn-icon btn-icon--sm" style={{ borderRadius: '50%' }}><X size={14} strokeWidth={2} /></button>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid grid--2" style={{ gap: 12 }}>
            <div><label className="label">Nome do agente</label><input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Copywriter" />{id && <p className="dim" style={{ fontSize: 10.5, margin: '4px 0 0' }}>id: {id}</p>}</div>
            <div><label className="label">Modelo</label><select className="select" value={model} onChange={e => setModel(e.target.value as 'opus' | 'sonnet' | 'haiku')}><option value="opus">opus</option><option value="sonnet">sonnet</option><option value="haiku">haiku</option></select></div>
          </div>
          <div><label className="label">Máx. turns</label><input className="input" type="number" min={1} max={200} value={maxTurns} onChange={e => setMaxTurns(Math.max(1, Math.min(200, Number(e.target.value) || 40)))} style={{ maxWidth: 130 }} /></div>
          <div>
            <label className="label">Comportamento (system prompt)</label>
            <label className="btn btn--ghost btn--sm" style={{ marginBottom: 8, cursor: 'pointer' }}>
              <Upload size={13} /> Enviar arquivo .md
              <input type="file" accept=".md,.txt,text/markdown,text/plain" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
            </label>
            <textarea className="textarea" style={{ minHeight: 150, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 }} value={system} onChange={e => setSystem(e.target.value)} placeholder="Cole o markdown de como o agente deve se comportar, ou envie o .md acima." />
          </div>
          <div><label className="label">Capacidades</label><div className="row wrap" style={{ gap: 7 }}>{(['shell', 'web', 'edit', 'read'] as const).map(t => <ToolToggle key={t} id={t} active={!!tools[t]} onClick={() => setTools(s => ({ ...s, [t]: !s[t] }))} />)}</div></div>
          <div><label className="label">Ícone</label><IconPicker value={icon} onChange={setIcon} /></div>
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={salvar} disabled={saving}>{saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Criar agente</button>
        </div>
      </div>
    </div>
  )
}

function AddStepForm({ cicloId, agentNames, onAdded }: { cicloId: string; agentNames: string[]; onAdded: () => void }) {
  const menu = useContextMenu()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [agente, setAgente] = useState(agentNames[0] || 'general')
  const [prompt, setPrompt] = useState('')
  const [timeoutMin, setTimeoutMin] = useState(8)
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!name.trim() || !prompt.trim()) { menu.toast('Preencha nome e instrução do passo', 'error'); return }
    setSaving(true)
    try { await api.addCicloStep(cicloId, { name, agente, prompt, timeoutMin }); setName(''); setPrompt(''); setOpen(false); onAdded(); menu.toast('Passo adicionado') }
    catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro', 'error') }
    finally { setSaving(false) }
  }
  if (!open) return <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}><Plus size={12} /> Adicionar passo (agente)</button>
  return (
    <div className="card card--pad col" style={{ gap: 8, background: 'var(--surface-2)' }}>
      <div className="grid grid--2" style={{ gap: 8 }}>
        <div><label className="label">Nome do passo</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Análise de concorrência" /></div>
        <div><label className="label">Agente</label><select className="select" value={agente} onChange={e => setAgente(e.target.value)}>{agentNames.map(n => <option key={n} value={n}>{n.replace('studio-', '')}</option>)}</select></div>
      </div>
      <div><label className="label">Instrução (use {'{{plano}}'}, {'{{dadosSemana}}'} p/ reaproveitar resultados anteriores)</label><textarea className="textarea" style={{ minHeight: 70, resize: 'vertical', fontSize: 12.5 }} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="O que esse agente deve fazer neste ciclo…" /></div>
      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <div><label className="label">Timeout (min)</label><input className="input" type="number" min={1} max={20} value={timeoutMin} onChange={e => setTimeoutMin(Math.max(1, Math.min(20, Number(e.target.value) || 8)))} style={{ maxWidth: 90 }} /></div>
        <button className="btn btn--primary btn--sm" onClick={add} disabled={saving}>{saving ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Adicionar</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </div>
  )
}

function CicloCard({ ciclo, agentNames, onChange }: { ciclo: import('../types').Ciclo; agentNames: string[]; onChange: () => void }) {
  const menu = useContextMenu()
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState(ciclo.steps)
  const [over, setOver] = useState<number | null>(null)
  const dragIdx = useRef<number | null>(null)
  const custom = !ciclo.builtin

  useEffect(() => { setSteps(ciclo.steps) }, [ciclo])

  const rodar = async () => {
    setRunning(true)
    try { await api.runCycle(ciclo.id); menu.toast(`Ciclo "${ciclo.nome}" iniciado`) }
    catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro ao rodar', 'error') }
    finally { setTimeout(() => setRunning(false), 1500) }
  }
  const removerPasso = async (stepId?: string) => { if (!stepId) return; try { await api.removeCicloStep(ciclo.id, stepId); onChange() } catch { menu.toast('Erro', 'error') } }
  const removerCiclo = async () => { const ok = await menu.confirm({ title: 'Excluir ciclo', message: `Remover o ciclo "${ciclo.nome}"?`, danger: true, confirmLabel: 'Excluir' }); if (!ok) return; try { await api.removeCiclo(ciclo.id); onChange() } catch { menu.toast('Erro', 'error') } }

  const soltar = async (to: number) => {
    const from = dragIdx.current
    dragIdx.current = null; setOver(null)
    if (from == null || from === to) return
    const next = [...steps]
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    setSteps(next)
    try { await api.reorderCicloSteps(ciclo.id, next.map(s => s.id || '')); menu.toast('Ordem salva') }
    catch { menu.toast('Erro ao salvar ordem', 'error'); onChange() }
  }

  return (
    <div className="card card--pad col" style={{ gap: 10 }}>
      <div className="row--between wrap" style={{ gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{ciclo.nome}</span>
            {ciclo.builtin ? <span className="badge" style={{ background: 'var(--surface-3)' }}>{ciclo.horario}</span> : <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-purple) 16%, transparent)', color: 'var(--accent-purple)' }}>seu ciclo</span>}
          </div>
          {ciclo.descricao && <p className="dim" style={{ fontSize: 11.5, margin: '3px 0 0' }}>{ciclo.descricao}</p>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn--ghost btn--sm" onClick={rodar} disabled={running}>{running ? <Loader2 size={12} className="spin" /> : <Play size={12} />} Rodar</button>
          {custom && <button className="btn-icon btn-icon--sm" title="Excluir ciclo" onClick={removerCiclo} style={{ color: 'var(--accent-red)' }}><Trash2 size={13} /></button>}
        </div>
      </div>
      <p className="dim" style={{ fontSize: 10.5, margin: 0 }}>Arraste pelos <GripVertical size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> para reordenar.</p>
      <div className="col" style={{ gap: 6 }}>
        {steps.map((s, i) => (
          <div
            key={s.id || i}
            draggable
            onDragStart={() => { dragIdx.current = i }}
            onDragOver={e => { e.preventDefault(); if (over !== i) setOver(i) }}
            onDragEnd={() => { dragIdx.current = null; setOver(null) }}
            onDrop={e => { e.preventDefault(); soltar(i) }}
            className="row"
            style={{ gap: 8, fontSize: 12.5, padding: '8px 10px', borderRadius: 8, cursor: 'grab',
              background: over === i ? 'var(--accent-soft)' : 'var(--surface-2)',
              border: `1px solid ${over === i ? 'var(--accent-line)' : 'transparent'}`, transition: 'background .12s' }}
          >
            <GripVertical size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span className="dim" style={{ width: 14, flexShrink: 0 }}>{i + 1}</span>
            <span className="truncate" style={{ fontWeight: 600, minWidth: 0 }}>{s.name}</span>
            <span className="badge" style={{ background: s.base ? 'var(--surface-3)' : 'color-mix(in srgb, var(--accent) 14%, transparent)', color: s.base ? 'var(--text-secondary)' : 'var(--accent-text)', flexShrink: 0 }}>{s.agente.replace('studio-', '')}</span>
            {!s.base && s.id
              ? <button className="btn-icon btn-icon--sm" title="Remover passo" onClick={() => removerPasso(s.id)} style={{ marginLeft: 'auto', color: 'var(--accent-red)', flexShrink: 0 }}><Trash2 size={12} /></button>
              : <span className="dim" style={{ marginLeft: 'auto', fontSize: 9.5, flexShrink: 0 }}>fixo</span>}
          </div>
        ))}
      </div>
      <AddStepForm cicloId={ciclo.id} agentNames={agentNames} onAdded={onChange} />
    </div>
  )
}

function PipelineModal({ agentNames, onClose }: { agentNames: string[]; onClose: () => void }) {
  const menu = useContextMenu()
  const [data, setData] = useState<import('../types').CiclosStatus | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)

  const load = useCallback(() => { api.getCiclos().then(setData).catch(() => menu.toast('Erro ao carregar pipeline', 'error')) }, [menu])
  useEffect(() => { load() }, [load])

  const criar = async () => {
    if (!novoNome.trim()) { menu.toast('Dê um nome ao ciclo', 'error'); return }
    setCriando(true)
    try { await api.addCiclo({ nome: novoNome.trim(), steps: [] }); setNovoNome(''); load(); menu.toast('Ciclo criado — adicione passos') }
    catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro', 'error') }
    finally { setCriando(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div className="row--between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="row" style={{ gap: 10 }}><GitBranch size={18} style={{ color: 'var(--accent)' }} /><h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Pipeline de produção</h2></div>
          <button onClick={onClose} className="btn-icon btn-icon--sm" style={{ borderRadius: '50%' }}><X size={14} strokeWidth={2} /></button>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="dim" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>Cada ciclo é uma sequência de passos que rodam agentes em ordem. Você pode <b>adicionar passos</b> aos ciclos existentes e <b>criar novos ciclos</b> do zero.</p>
          {!data ? <div className="empty"><Loader2 size={24} className="spin" /></div> : (
            <>
              {data.builtin.map(c => <CicloCard key={c.id} ciclo={c} agentNames={agentNames} onChange={load} />)}
              {data.custom.map(c => <CicloCard key={c.id} ciclo={c} agentNames={agentNames} onChange={load} />)}
              <div className="card card--pad row wrap" style={{ gap: 8, alignItems: 'flex-end', borderStyle: 'dashed' }}>
                <div style={{ flex: 1, minWidth: 180 }}><label className="label">Novo ciclo</label><input className="input" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome do ciclo (ex.: Pós-venda)" /></div>
                <button className="btn btn--primary" onClick={criar} disabled={criando}>{criando ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Criar ciclo</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const STAGE_ORD = ['NOVO', 'CONTATADO', 'RESPONDEU', 'QUALIFICADO', 'PROPOSTA', 'FECHADO']
const STAGE_LBL: Record<string, string> = { NOVO: 'Novo', CONTATADO: 'Contatado', RESPONDEU: 'Respondeu', QUALIFICADO: 'Qualificado', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido' }
const STAGE_COLOR: Record<string, string> = { NOVO: '#0A84FF', CONTATADO: '#64D2FF', RESPONDEU: '#5E5CE6', QUALIFICADO: '#BF5AF2', PROPOSTA: '#FF9F0A', FECHADO: '#30D158' }

function fmtMsShort(ms?: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function Ring({ pct, size = 66, stroke = 8, color = 'var(--accent)' }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(1, (pct || 0) / 100)))
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s var(--ease)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>{Math.round(pct || 0)}%</div>
    </div>
  )
}

function FunilLeads({ leads }: { leads: import('../types').CrmLead[] }) {
  const counts: Record<string, number> = {}
  for (const l of leads) counts[l.stage] = (counts[l.stage] || 0) + 1
  const total = leads.length
  const conv = total ? Math.round(((counts['FECHADO'] || 0) / total) * 100) : 0
  const max = Math.max(1, ...STAGE_ORD.map(s => counts[s] || 0))
  return (
    <div className="card col" style={{ gap: 7, padding: 14 }}>
      <div className="row--between">
        <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 700 }}><Users size={15} style={{ color: '#0A84FF' }} /> Funil de leads</span>
        <span className="dim" style={{ fontSize: 12 }}>{total} no total</span>
      </div>
      <div className="col" style={{ gap: 4 }}>
        {STAGE_ORD.map(s => {
          const n = counts[s] || 0
          return (
            <div key={s} className="row" style={{ gap: 9, alignItems: 'center' }}>
              <span className="dim" style={{ fontSize: 10.5, width: 74, flexShrink: 0 }}>{STAGE_LBL[s]}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: STAGE_COLOR[s], borderRadius: 5, transition: 'width .5s var(--ease)' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, width: 16, textAlign: 'right' }}>{n}</span>
            </div>
          )
        })}
      </div>
      <div className="row--between" style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 1 }}>
        <span className="dim" style={{ fontSize: 12 }}>Taxa de conversão</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-green)' }}>{conv}%</span>
      </div>
    </div>
  )
}

function AutomacaoCard({ metrics, lastCycle }: { metrics: import('../types').PipelineMetrics | null; lastCycle: string }) {
  const sr = metrics?.successRate ?? 0
  const cor = sr >= 70 ? 'var(--accent-green)' : sr >= 40 ? 'var(--accent-yellow)' : 'var(--accent-red)'
  return (
    <div className="card col" style={{ gap: 10, padding: 14 }}>
      <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 700 }}><Activity size={15} style={{ color: 'var(--accent)' }} /> Automação</span>
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        <Ring pct={sr} color={cor} />
        <div className="col" style={{ gap: 8, flex: 1, minWidth: 0 }}>
          <div className="row--between"><span className="dim" style={{ fontSize: 12 }}>Ciclos OK</span><b style={{ fontSize: 14 }}>{metrics?.completed ?? 0}/{metrics?.total ?? 0}</b></div>
          <div className="row--between"><span className="dim" style={{ fontSize: 12 }}>Tempo médio</span><b style={{ fontSize: 14 }}>{fmtMsShort(metrics?.avgDurationMs)}</b></div>
        </div>
      </div>
      <div className="dim truncate" style={{ fontSize: 11, borderTop: '1px solid var(--border)', paddingTop: 9 }}><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />{lastCycle}</div>
    </div>
  )
}

function SituacaoCard({ stats, pend, onNav }: { stats: Stats | null; pend: number; onNav: (to: string) => void }) {
  const tiles = [
    { label: 'Aprovações', v: stats?.counts.pendentes ?? 0, color: (stats?.counts.pendentes ?? 0) > 0 ? 'var(--accent-yellow)' : 'var(--text-tertiary)', icon: <AlertCircle size={13} />, to: '/aprovacoes' },
    { label: 'Ajustes', v: pend, color: pend > 0 ? 'var(--accent-red)' : 'var(--text-tertiary)', icon: <AlertCircle size={13} />, to: '' },
    { label: 'Produtos', v: stats?.counts.produtos ?? 0, color: '#FF453A', icon: <Package size={13} />, to: '/workspace?p=produtos' },
    { label: 'Conteúdos', v: stats?.counts.conteudo ?? 0, color: '#30D158', icon: <FileText size={13} />, to: '/workspace?p=conteudo' },
  ]
  return (
    <div className="card col" style={{ gap: 10, padding: 14 }}>
      <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 700 }}><TrendingUp size={15} style={{ color: 'var(--accent-cyan)' }} /> Situação</span>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {tiles.map(t => (
          <button key={t.label} onClick={() => t.to && onNav(t.to)} className="card" style={{ textAlign: 'left', cursor: t.to ? 'pointer' : 'default', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface-2)' }}>
            <span className="row" style={{ gap: 6, fontSize: 10.5, color: t.color }}>{t.icon} <span className="dim">{t.label}</span></span>
            <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{t.v}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SitesCard({ data }: { data: { total: number; sites: { clienteId: string; url: string; nome: string; firebase: boolean }[] } }) {
  return (
    <div className="card col" style={{ gap: 9, padding: 14 }}>
      <div className="row--between">
        <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 700 }}><Globe size={15} style={{ color: 'var(--accent-green)' }} /> Sites no ar</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-green)' }}>{data.total}</span>
      </div>
      {data.total === 0 ? (
        <p className="dim" style={{ fontSize: 12, margin: 0 }}>Nenhum site publicado ainda. Gere uma Landing/App e clique em <b>Publicar</b>.</p>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          {data.sites.slice(0, 4).map(s => (
            <a key={s.clienteId} href={s.url} target="_blank" rel="noopener noreferrer" className="row--between" style={{ gap: 8, textDecoration: 'none', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>{s.nome}</span>
              <span className="row" style={{ gap: 6, flexShrink: 0 }}>
                {s.firebase && <span className="dot" style={{ background: 'var(--accent-green)', width: 6, height: 6 }} title="Firebase ligado" />}
                <ExternalLink size={12} style={{ color: 'var(--accent)' }} />
              </span>
            </a>
          ))}
          {data.total > 4 && <span className="dim" style={{ fontSize: 11 }}>+{data.total - 4} outros</span>}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [agents,        setAgents]        = useState<AgentsMap>({})
  const [status,        setStatus]        = useState<SystemStatus | null>(null)
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [logLines,      setLogLines]      = useState<string[]>([])
  const [loading,       setLoading]       = useState(true)
  const [cycleLoading,  setCycleLoading]  = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<{ name: string; agent: Agent } | null>(null)
  const [newAgentOpen, setNewAgentOpen] = useState(false)
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [crmLeads, setCrmLeads] = useState<import('../types').CrmLead[]>([])
  const [pipeMetrics, setPipeMetrics] = useState<import('../types').PipelineMetrics | null>(null)
  const [pendCount, setPendCount] = useState(0)
  const [sites, setSites] = useState<{ total: number; sites: { clienteId: string; url: string; nome: string; firebase: boolean }[] }>({ total: 0, sites: [] })
  const menu = useContextMenu()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [view, setView] = useState<'op' | 'ceo'>('op')

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => menu.toast(msg, type)

  const loadData = useCallback(async () => {
    try {
      const [agentsData, statusData, statsData, logsData] = await Promise.all([
        api.getAgents(),
        api.getStatus(),
        api.getStats(),
        api.getLogs(),
      ])
      setAgents(agentsData)
      setStatus(statusData)
      setStats(statsData)
      setLogLines(logsData.lines.slice(-30))
    } catch {
      showToast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
    api.getCrm().then(r => setCrmLeads(r.leads)).catch(() => {})
    api.getPipelineMetrics().then(setPipeMetrics).catch(() => {})
    api.getPendencias().then(r => setPendCount(r.itens.length)).catch(() => {})
    api.getClientesSites().then(setSites).catch(() => {})
  }, [])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 5000)
    return () => clearInterval(iv)
  }, [loadData])

  const runCycle = async (cycle: 'segunda' | 'diario' | 'sexta') => {
    setCycleLoading(cycle)
    try {
      const res = await api.runCycle(cycle)
      showToast(`Ciclo ${cycle} iniciado (PID ${res.pid})`)
      pushNotification({ type: 'success', title: `Ciclo ${cycle} iniciado`, body: `PID ${res.pid}` })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar ciclo'
      showToast(msg, 'error')
      pushNotification({ type: 'error', title: 'Erro ao iniciar ciclo', body: msg })
    } finally {
      setCycleLoading(null)
    }
  }

  const agentEntries = Object.entries(agents)
  const isOnline = !status?.disabled

  if (loading) {
    return (
      <div className="center" style={{ flex: 1, minHeight: '50vh' }}>
        <Loader2 size={22} strokeWidth={1.5} className="spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    )
  }

  const lastCycleLabel = stats?.lastCycle
    ? stats.lastCycle.replace(/^\[.*?\]\s*=== /, '').replace(' ===', '')
    : 'Nenhum ciclo ainda'

  return (
    <div className="page page--flush page--fit" style={{ gap: 12 }}>
      {selectedAgent && (
        <AgentModal
          name={selectedAgent.name}
          agent={selectedAgent.agent}
          onClose={() => setSelectedAgent(null)}
          onSaved={updated => {
            setAgents(prev => ({ ...prev, [selectedAgent.name]: updated }))
            setSelectedAgent(prev => prev ? { ...prev, agent: updated } : null)
            showToast('Agente atualizado com sucesso')
          }}
        />
      )}
      {newAgentOpen && <NewAgentModal onClose={() => setNewAgentOpen(false)} onSaved={() => { setNewAgentOpen(false); loadData(); showToast('Agente criado') }} />}
      {pipelineOpen && <PipelineModal agentNames={agentEntries.map(([n]) => n)} onClose={() => setPipelineOpen(false)} />}

      <div className="page-head">
        <div>
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-sub">
            {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="page-head-actions">
          {user?.isAdmin && (
            <div className="row" style={{ gap: 4, padding: 3, background: 'var(--surface-2)', borderRadius: 999 }}>
              <button className={'btn btn--pill btn--sm' + (view === 'op' ? ' btn--accent-soft' : '')} onClick={() => setView('op')} style={{ border: 'none' }}>
                <LayoutDashboard size={13} /> Operação
              </button>
              <button className={'btn btn--pill btn--sm' + (view === 'ceo' ? ' btn--accent-soft' : '')} onClick={() => setView('ceo')} style={{ border: 'none' }}>
                <Briefcase size={13} /> Executivo
              </button>
            </div>
          )}
          {stats && stats.totalErrors > 0 && (
            <span className="chip" style={{ background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-red) 24%, transparent)', color: 'var(--accent-red)' }}>
              <AlertCircle size={12} strokeWidth={1.5} /> {stats.totalErrors} erros
            </span>
          )}
          <span className="chip hide-xs">
            <Clock size={11} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} /> {lastCycleLabel}
          </span>
          <span className="chip" style={{ color: isOnline ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
            <span className="dot" style={{ background: isOnline ? 'var(--accent-green)' : 'var(--accent-red)', boxShadow: `0 0 6px ${isOnline ? 'var(--accent-green)' : 'var(--accent-red)'}` }} />
            {isOnline ? 'ATIVO' : 'PAUSADO'}
          </span>
        </div>
      </div>

      {view === 'ceo' && user?.isAdmin ? <CEO embedded /> : <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <FunilLeads leads={crmLeads} />
        <AutomacaoCard metrics={pipeMetrics} lastCycle={lastCycleLabel} />
        <SituacaoCard stats={stats} pend={pendCount} onNav={navigate} />
        <SitesCard data={sites} />
      </div>

      <div className="grid grid--kpi" style={{ flexShrink: 0 }}>
        {KPI_DEFS.map(kpi => {
          const val = stats?.counts[kpi.key as keyof typeof stats.counts] ?? 0
          return (
            <Link
              key={kpi.key}
              to={kpi.to}
              className="card card--hover"
              {...menu.bind((): CtxItem[] => [
                { header: kpi.label },
                { label: 'Abrir', icon: kpi.icon, onClick: () => navigate(kpi.to) },
                { label: 'Atualizar', icon: <Activity size={15} strokeWidth={1.8} />, onClick: loadData },
              ])}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 13px', textDecoration: 'none', color: 'inherit' }}
            >
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                <span style={{ color: kpi.color, opacity: 0.85, display: 'flex' }}>{kpi.icon}</span>
                <span className="dim truncate" style={{ fontSize: 11.5, fontWeight: 500 }}>{kpi.label}</span>
              </span>
              <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{val}</span>
            </Link>
          )
        })}
      </div>

      <div className="split" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel" style={{ minHeight: 0 }}>
          <div className="panel-head">
            <span className="panel-title">Agentes <span className="dim" style={{ fontWeight: 400 }}>({agentEntries.length})</span></span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setPipelineOpen(true)}><GitBranch size={13} /> Pipeline</button>
              <button className="btn btn--accent-soft btn--sm" onClick={() => setNewAgentOpen(true)}><Plus size={13} /> Novo agente</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 12 }}>
            <div className="grid grid--cards">
              {agentEntries.map(([name, agent]) => (
                <AgentCard key={name} name={name} agent={agent} onClick={() => setSelectedAgent({ name, agent })} onChanged={loadData} />
              ))}
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 12, minHeight: 0 }}>
          <div className="panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="panel-head">
              <span className="panel-title">Atividade recente</span>
              <span className="dot dot--live" />
            </div>
            <div className="panel-body" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {logLines.length === 0 ? (
                <p className="dim mono" style={{ fontSize: 12 }}>Sem atividade ainda</p>
              ) : (
                logLines.slice().reverse().map((line, i) => (
                  <div
                    key={i}
                    className="mono"
                    {...menu.bind((): CtxItem[] => [
                      { label: 'Copiar linha', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(line, 'Linha copiada') },
                      { label: 'Copiar tudo', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(logLines.join('\n'), 'Logs copiados') },
                      { separator: true },
                      { label: 'Ver todos os logs', icon: <Activity size={15} strokeWidth={1.8} />, onClick: () => navigate('/logs') },
                    ])}
                    style={{ fontSize: 12, lineHeight: 1.7, color: classifyLog(line), wordBreak: 'break-word', padding: '1px 0' }}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card card--pad" style={{ flexShrink: 0 }}>
            <p className="label">Ciclos manuais</p>
            <div className="col" style={{ gap: 7 }}>
              {(['segunda', 'diario', 'sexta'] as const).map(cycle => {
                const labels: Record<string, string> = { segunda: 'Segunda — Plano + Leads', diario: 'Diário — Tráfego + Clientes', sexta: 'Sexta — Dados + Relatório' }
                return (
                  <button key={cycle} onClick={() => runCycle(cycle)} disabled={cycleLoading !== null}
                    className="btn btn--ghost" style={{ justifyContent: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: cycleLoading !== null && cycleLoading !== cycle ? 0.4 : 1 }}>
                    {cycleLoading === cycle
                      ? <Loader2 size={12} strokeWidth={2} className="spin" style={{ flexShrink: 0 }} />
                      : <Play size={12} strokeWidth={1.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    {labels[cycle]}
                  </button>
                )
              })}
              <Link to="/aprovacoes" className="btn" style={{ justifyContent: 'flex-start', textDecoration: 'none', background: (stats?.counts.pendentes ?? 0) > 0 ? 'color-mix(in srgb, var(--accent-yellow) 10%, transparent)' : 'var(--surface-2)', borderColor: (stats?.counts.pendentes ?? 0) > 0 ? 'color-mix(in srgb, var(--accent-yellow) 24%, transparent)' : 'var(--border)', color: (stats?.counts.pendentes ?? 0) > 0 ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>
                <AlertCircle size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                Aprovações pendentes
                {(stats?.counts.pendentes ?? 0) > 0 && (
                  <span style={{ background: 'var(--accent-red)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>
                    {stats!.counts.pendentes}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
      </>}
    </div>
  )
}
