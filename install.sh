#!/usr/bin/env bash
#
# install.sh — instalador idempotente do VNMAX Studio.
# Pode rodar várias vezes sem quebrar nada.
#
set -euo pipefail

STUDIO="/home/v/studio-ia"
NXS="/home/v/nxs-agents"
NXS_AGENTS_FILE="$NXS/lib/agents.js"
NXS_KEYS_FILE="$NXS/keys.json"
HOJE="$(date +%Y%m%d)"

echo "==> VNMAX Studio — instalação"

# ---------------------------------------------------------------------------
# 1. Estrutura de diretórios
# ---------------------------------------------------------------------------
echo "==> Criando estrutura de diretórios"
mkdir -p "$STUDIO/logs"
mkdir -p "$STUDIO/lib"
mkdir -p "$STUDIO/workspace"/{leads,conteudo,propostas,paginas,produtos,campanhas,emails,clientes,reports}
mkdir -p "$STUDIO/workspace/aprovacoes"/{pendentes,aprovadas,rejeitadas}

# ---------------------------------------------------------------------------
# 2. Backup do agents.js original (antes de qualquer substituição)
# ---------------------------------------------------------------------------
if [ -f "$NXS_AGENTS_FILE" ]; then
  BAK="$NXS_AGENTS_FILE.bak-$HOJE"
  if [ ! -f "$BAK" ]; then
    cp "$NXS_AGENTS_FILE" "$BAK"
    echo "==> Backup criado: $BAK"
  else
    echo "==> Backup de hoje já existe: $BAK (mantido)"
  fi
else
  echo "==> AVISO: $NXS_AGENTS_FILE não existe — pulando backup."
fi

# ---------------------------------------------------------------------------
# 3. Copiar novo agents.js
# ---------------------------------------------------------------------------
if [ -f "$STUDIO/agents.js" ]; then
  mkdir -p "$NXS/lib"
  cp "$STUDIO/agents.js" "$NXS_AGENTS_FILE"
  echo "==> agents.js atualizado em $NXS_AGENTS_FILE"
else
  echo "==> ERRO: $STUDIO/agents.js não encontrado." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Gerar chave nxsC_ e registrar (SHA-256) no keys.json + salvar .env
# ---------------------------------------------------------------------------
ENV_FILE="$STUDIO/.env"

if [ -f "$ENV_FILE" ] && grep -q "NXS_STUDIO_KEY=" "$ENV_FILE"; then
  echo "==> .env já tem NXS_STUDIO_KEY — mantendo chave existente (idempotente)."
  STUDIO_KEY="$(grep '^NXS_STUDIO_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
else
  RAND="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  STUDIO_KEY="nxsC_${RAND}"
  KEY_HASH="$(printf '%s' "$STUDIO_KEY" | sha256sum | cut -d' ' -f1)"

  # keys.json: array de objetos {name, hash}. Cria se não existir.
  if [ ! -f "$NXS_KEYS_FILE" ]; then
    echo "[]" > "$NXS_KEYS_FILE"
  fi

  # Adiciona via node (evita dependência de jq), sem duplicar o nome.
  node -e '
    const fs = require("fs");
    const f = process.argv[1], hash = process.argv[2];
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(f, "utf8")); } catch (_) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    if (!arr.some(k => k && k.name === "studio")) {
      arr.push({ name: "studio", hash });
      fs.writeFileSync(f, JSON.stringify(arr, null, 2));
      console.log("chave studio registrada em keys.json");
    } else {
      console.log("entrada studio já existe em keys.json (mantida)");
    }
  ' "$NXS_KEYS_FILE" "$KEY_HASH"

  # Salva a chave em texto SOMENTE no .env do Studio (chmod 600).
  {
    echo "# VNMAX Studio — gerado pelo install.sh em $(date -Iseconds)"
    echo "NXS_STUDIO_KEY=$STUDIO_KEY"
    echo "NXS_HOST=127.0.0.1"
    echo "NXS_PORT=8006"
    echo "STUDIO_ROOT=$STUDIO"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "==> Chave gerada e salva em $ENV_FILE (chmod 600)"
fi

# ---------------------------------------------------------------------------
# 5. Reiniciar ld_nxs-agents via PM2
# ---------------------------------------------------------------------------
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart ld_nxs-agents >/dev/null 2>&1 && \
    echo "==> ld_nxs-agents reiniciado" || \
    echo "==> AVISO: não foi possível reiniciar ld_nxs-agents (verifique PM2)."
else
  echo "==> AVISO: pm2 não encontrado no PATH — reinicie o nxs-agents manualmente."
fi

# ---------------------------------------------------------------------------
# 6. Configurar cron (idempotente — remove linhas antigas do Studio antes)
# ---------------------------------------------------------------------------
echo "==> Configurando cron"
SCHED="node $STUDIO/studio-scheduler.js"
CRON_TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "studio-scheduler.js" > "$CRON_TMP" || true
cat >> "$CRON_TMP" <<EOF
# VNMAX Studio (gerado pelo install.sh)
0 8 * * 1 $SCHED --cycle=segunda >> $STUDIO/logs/cron.log 2>&1
0 9 * * 2,3,4 $SCHED --cycle=diario >> $STUDIO/logs/cron.log 2>&1
0 17 * * 5 $SCHED --cycle=sexta >> $STUDIO/logs/cron.log 2>&1
EOF
crontab "$CRON_TMP"
rm -f "$CRON_TMP"
echo "==> Cron configurado (seg 08h, ter-qui 09h, sex 17h)"

# ---------------------------------------------------------------------------
# 7. Resumo final
# ---------------------------------------------------------------------------
cat <<EOF

============================================================
 STUDIO IA INSTALADO ✅
============================================================
 Chave do Studio (guardada em $ENV_FILE):
   ${STUDIO_KEY}

 Comandos úteis:
   node $STUDIO/studio-scheduler.js --pendentes
   node $STUDIO/studio-scheduler.js --aprovar=<id>
   node $STUDIO/studio-scheduler.js --rejeitar=<id> --motivo="..."
   node $STUDIO/studio-scheduler.js --relatorio
   node $STUDIO/studio-scheduler.js --agent=studio-growth --task="..."

 Ciclos automáticos:
   Segunda 08:00  → plano + leads + criação
   Ter-Qui 09:00  → tráfego + rascunhos de email (vão p/ aprovação)
   Sexta   17:00  → dados + relatório do fundador

 Pausar tudo:   touch $STUDIO/DISABLED
 Religar:       rm $STUDIO/DISABLED

 Ver o que precisa da sua aprovação agora:
   node $STUDIO/studio-scheduler.js --pendentes
============================================================
EOF
