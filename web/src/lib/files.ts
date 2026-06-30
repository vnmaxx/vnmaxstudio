export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const DIR_LABELS: Record<string, string> = {
  leads: 'Leads', conteudo: 'Conteúdo', produtos: 'Produtos', paginas: 'Páginas',
  campanhas: 'Campanhas', emails: 'E-mails', clientes: 'Clientes', propostas: 'Propostas',
  reports: 'Relatórios', pipelines: 'Pipelines', aprovacoes: 'Aprovações',
  aprovadas: 'Aprovadas', pendentes: 'Pendentes', rejeitadas: 'Rejeitadas',
}

const FILE_LABELS: Record<string, string> = {
  criacao: 'Criação', leads: 'Leads', plano: 'Plano da semana', relatorio: 'Relatório',
  'dados-semana': 'Dados da semana', dados: 'Dados', trafego: 'Tráfego', 'trafego-evento': 'Tráfego (evento)',
  'criacao-evento': 'Criação (evento)', roteiros: 'Roteiros', pipeline: 'Pipeline', emails: 'E-mails',
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function humanName(name: string, isDir = false): string {
  if (!name) return name
  if (isDir) return DIR_LABELS[name.toLowerCase()] || cap(name)

  const base = name.replace(/\.[^.]+$/, '')

  const dm = base.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (dm) {
    const prefix = base.slice(0, dm.index).replace(/[-_]+$/, '').toLowerCase()
    const label = FILE_LABELS[prefix] || cap(prefix.replace(/[-_]/g, ' '))
    return `${label} · ${dm[3]}/${dm[2]}/${dm[1]}`
  }

  const pm = base.match(/^pipeline-(.+)$/i)
  if (pm) return `Pipeline · ${pm[1].slice(0, 8)}`

  const parts = base.split('-')
  if (parts.length > 1 && FILE_LABELS[parts[0].toLowerCase()]) {
    return `${FILE_LABELS[parts[0].toLowerCase()]} · ${parts.slice(1).join('-')}`
  }

  return cap(base.replace(/[-_]/g, ' '))
}
