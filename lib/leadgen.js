'use strict';
const fs = require('fs');
const path = require('path');

const CATALOGO = {
  'Saúde & Bem-estar': [
    'nutricionistas', 'dentistas', 'psicólogos', 'fisioterapeutas', 'clínicas de estética',
    'clínicas médicas', 'dermatologistas', 'quiropraxistas', 'fonoaudiólogos', 'terapeutas',
    'clínicas de vacinação', 'óticas', 'farmácias de manipulação', 'podólogos',
  ],
  'Beleza & Cuidados': [
    'cabeleireiros', 'barbearias', 'salões de beleza', 'manicures', 'designers de sobrancelha',
    'clínicas de depilação', 'studios de bronzeamento', 'maquiadores', 'lash designers', 'spas',
  ],
  'Fitness & Esporte': [
    'personal trainers', 'academias', 'studios de pilates', 'crossfit boxes', 'studios de yoga',
    'escolas de dança', 'escolas de natação', 'lojas de suplementos', 'artes marciais',
  ],
  'Alimentação': [
    'restaurantes', 'hamburguerias', 'pizzarias', 'cafeterias', 'confeitarias', 'padarias',
    'docerias', 'food trucks', 'açaiterias', 'hortifrutis', 'empórios', 'lanchonetes',
    'bares', 'sorveterias', 'marmitarias', 'comidas congeladas artesanais',
  ],
  'Serviços & Casa': [
    'marcenarias', 'eletricistas', 'encanadores', 'pintores', 'diaristas', 'jardineiros',
    'dedetizadoras', 'chaveiros', 'vidraçarias', 'serralherias', 'gesseiros',
    'empresas de mudança', 'lavanderias', 'costureiras', 'tapeçarias', 'reformas em geral',
  ],
  'Comércio local': [
    'mercados de bairro', 'lojas de roupas', 'boutiques', 'lojas de calçados', 'papelarias',
    'floriculturas', 'lojas de presentes', 'joalherias', 'óticas', 'lojas de móveis',
    'lojas de decoração', 'brechós', 'tabacarias', 'lojas de bebidas',
  ],
  'Pet': [
    'petshops', 'clínicas veterinárias', 'banho e tosa', 'adestradores', 'pet sitters',
    'creches para cães',
  ],
  'Educação': [
    'escolas de idiomas', 'reforços escolares', 'cursos profissionalizantes', 'autoescolas',
    'escolas de música', 'escolinhas infantis', 'professores particulares', 'escolas de informática',
  ],
  'Serviços profissionais': [
    'contadores', 'advogados', 'corretores de imóveis', 'corretores de seguros', 'arquitetos',
    'engenheiros', 'consultores financeiros', 'despachantes', 'agências de viagens', 'cartórios',
  ],
  'Automotivo': [
    'oficinas mecânicas', 'lava-rápidos', 'auto elétricas', 'funilarias', 'borracharias',
    'centros automotivos', 'películas automotivas', 'estéticas automotivas', 'lojas de autopeças',
  ],
  'Eventos & Foto': [
    'buffets', 'fotógrafos', 'cerimonialistas', 'locadoras de festa', 'confeitarias de bolo',
    'DJs', 'decoradores de festa', 'aluguel de brinquedos',
  ],
  'Construção': [
    'lojas de materiais de construção', 'marmorarias', 'vidraçarias', 'construtoras',
    'lojas de tintas', 'empresas de climatização', 'instaladores de energia solar',
  ],
};

const DEFAULT_NICHOS = Object.values(CATALOGO).flat();

const DEFAULTS = {
  cidade: '',
  quantidade: 8,
  rotacao: true,
  nichos: DEFAULT_NICHOS.slice(),
  auto: true,
  minNovos: 3,
  intervaloHoras: 6,
};

class Leadgen {
  constructor(workspaceDir) {
    this.dir = path.join(workspaceDir, 'config');
    this.file = path.join(this.dir, 'leadgen.json');
  }

  ensureDir() {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
  }

  load() {
    let cfg = {};
    if (fs.existsSync(this.file)) {
      try { cfg = JSON.parse(fs.readFileSync(this.file, 'utf8')) || {}; } catch { cfg = {}; }
    }
    const nichos = Array.isArray(cfg.nichos) && cfg.nichos.length
      ? [...new Set(cfg.nichos.map(n => String(n || '').trim()).filter(Boolean))]
      : DEFAULTS.nichos.slice();
    return {
      cidade: typeof cfg.cidade === 'string' ? cfg.cidade : DEFAULTS.cidade,
      quantidade: Math.max(1, Math.min(20, parseInt(cfg.quantidade, 10) || DEFAULTS.quantidade)),
      rotacao: cfg.rotacao !== false,
      nichos,
      auto: cfg.auto !== false,
      minNovos: Math.max(1, Math.min(20, parseInt(cfg.minNovos, 10) || DEFAULTS.minNovos)),
      intervaloHoras: Math.max(1, Math.min(72, parseInt(cfg.intervaloHoras, 10) || DEFAULTS.intervaloHoras)),
      ultimaCaptacao: typeof cfg.ultimaCaptacao === 'string' ? cfg.ultimaCaptacao : null,
    };
  }

  save(input) {
    this.ensureDir();
    const cfg = this.load();
    const next = {
      cidade: typeof input.cidade === 'string' ? input.cidade.trim() : cfg.cidade,
      quantidade: input.quantidade != null ? Math.max(1, Math.min(20, parseInt(input.quantidade, 10) || cfg.quantidade)) : cfg.quantidade,
      rotacao: input.rotacao != null ? !!input.rotacao : cfg.rotacao,
      nichos: Array.isArray(input.nichos)
        ? [...new Set(input.nichos.map(n => String(n || '').trim()).filter(Boolean))]
        : cfg.nichos,
      auto: input.auto != null ? !!input.auto : cfg.auto,
      minNovos: input.minNovos != null ? Math.max(1, Math.min(20, parseInt(input.minNovos, 10) || cfg.minNovos)) : cfg.minNovos,
      intervaloHoras: input.intervaloHoras != null ? Math.max(1, Math.min(72, parseInt(input.intervaloHoras, 10) || cfg.intervaloHoras)) : cfg.intervaloHoras,
      ultimaCaptacao: cfg.ultimaCaptacao,
    };
    if (!next.nichos.length) next.nichos = DEFAULTS.nichos.slice();
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
    return next;
  }

  status() {
    return { ...this.load(), catalogo: CATALOGO };
  }

  pickNichos(n) {
    const cfg = this.load();
    const all = cfg.nichos.slice();
    if (!cfg.rotacao || all.length <= n) return all.slice(0, Math.max(n, all.length));
    const offset = (new Date().getDate() * 7) % all.length;
    const out = [];
    for (let i = 0; i < n; i++) out.push(all[(offset + i) % all.length]);
    return [...new Set(out)];
  }

  markCaptacao() {
    this.ensureDir();
    const cfg = this.load();
    cfg.ultimaCaptacao = new Date().toISOString();
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
    return cfg.ultimaCaptacao;
  }

  growthTask(opts = {}) {
    const cfg = this.load();
    const cidade = cfg.cidade || process.env.STUDIO_CIDADE || 'São Paulo';
    const qtd = opts.quantidade || cfg.quantidade || 8;
    let nichos = [];
    try { nichos = this.pickNichos(Math.min(14, Math.max(6, qtd + 4))); } catch {}
    if (!nichos.length) nichos = ['nutricionistas', 'dentistas', 'personal trainers', 'contadores', 'advogados', 'cabeleireiros', 'petshops', 'marcenarias', 'mercados de bairro'];
    const numSegmentos = Math.min(nichos.length, Math.max(3, Math.ceil(qtd / 2)));
    const evitar = Array.isArray(opts.evitar) && opts.evitar.length
      ? `\n\nNÃO repita negócios já captados (evite estes): ${opts.evitar.slice(0, 60).join('; ')}.`
      : '';
    const prioridade = opts.plano ? `\n\nPRIORIDADE:\n${String(opts.plano).slice(0, 600)}` : '';
    return `Use APENAS WebSearch (NÃO use WebFetch — é lento) para encontrar ${qtd} negócios locais reais em ${cidade} com boa reputação mas presença digital fraca.\n\nVarie os segmentos (escolha ${numSegmentos} entre: ${nichos.join(', ')}). Não repita o mesmo segmento em mais de 2 negócios. No máximo 2 buscas por negócio (1 para achar, 1 para o Instagram). Pare depois de encontrar os ${qtd} e retorne o JSON imediatamente.${evitar}\n\nRetorne:\n<<<LEADS>>>\n[{"nome":"...","segmento":"...","contato":"@handle / tel","observacao":"Nota X.X em [fonte] - [observação]"}]\n<<<FIM_LEADS>>>${opts.comRoteiros ? '\n<<<ROTEIROS>>>\n[2 roteiros virais]\n<<<FIM_ROTEIROS>>>' : ''}${prioridade}`;
  }
}

module.exports = { Leadgen, CATALOGO, DEFAULT_NICHOS, DEFAULTS };
