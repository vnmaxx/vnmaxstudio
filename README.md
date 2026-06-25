# Studio IA

Um negócio digital semi-autônomo que roda no seu servidor Ubuntu. Seis agentes de IA (CEO, Growth, Criação, Tráfego, Clientes, Dados) trabalham juntos para prospectar clientes, criar produtos e páginas, rodar tráfego e medir resultados — enquanto **você só lê o relatório de sexta e aprova ou rejeita o que vai para clientes reais.**

Nada é enviado a um cliente sem a sua aprovação explícita.

## O que o sistema faz, em linguagem simples

- **Segunda 08:00** — o CEO lê tudo, define 3 prioridades e distribui tarefas. Growth gera 30 leads + 3 roteiros de vídeo. Criação desenvolve um produto ou página.
- **Terça a quinta 09:00** — Tráfego analisa campanhas e recomenda ajustes. Clientes rascunha emails de prospecção e os coloca na **fila de aprovação** (não envia).
- **Sexta 17:00** — Dados compila as métricas da semana. O CEO escreve um relatório de 1 página com no máximo 3 perguntas binárias e mostra no terminal.

Você entra em apenas dois momentos: **aprovar/rejeitar pendentes** e **ler o relatório de sexta**.

## Instalação (1 comando)

Copie a pasta `studio-ia` para `/home/v/studio-ia/` no servidor e rode:

```bash
bash /home/v/studio-ia/install.sh
```

O instalador é idempotente (pode rodar de novo sem quebrar nada). Ele cria os diretórios, faz backup do `agents.js` original, instala os novos agentes, gera uma chave `nxsC_` para o Studio (guardando só o SHA-256 no nxs-agents e a chave em texto no `.env` com `chmod 600`), reinicia o `ld_nxs-agents` e configura o cron.

## Como você interage (dia a dia)

```bash
# Ver o que precisa da sua aprovação:
node /home/v/studio-ia/studio-scheduler.js --pendentes

# Aprovar um email/ação específica (exibe o conteúdo para você usar):
node /home/v/studio-ia/studio-scheduler.js --aprovar=<id>

# Rejeitar com motivo:
node /home/v/studio-ia/studio-scheduler.js --rejeitar=<id> --motivo="Muito genérico, refaça"

# Aprovar todos de uma vez (use com cuidado):
node /home/v/studio-ia/studio-scheduler.js --aprovar-todos

# Ler o relatório mais recente:
node /home/v/studio-ia/studio-scheduler.js --relatorio

# Rodar um agente sob demanda:
node /home/v/studio-ia/studio-scheduler.js --agent=studio-growth --task="Gere 10 leads de dentistas em Curitiba"
```

Quando você aprova um email, o sistema o move para `aprovadas/` e mostra o conteúdo para você enviar pelo canal que preferir. **O envio real é sempre seu.**

## Parar tudo temporariamente

```bash
touch /home/v/studio-ia/DISABLED   # pausa os ciclos automáticos
rm /home/v/studio-ia/DISABLED      # religa
```

A CLI de aprovações e relatórios continua funcionando mesmo com o sistema pausado.

## Estrutura do workspace

```
/home/v/studio-ia/
├── agents.js              # definição dos 10 agentes (copiado p/ nxs-agents)
├── studio-scheduler.js    # orquestrador (Node puro, zero deps)
├── lib/aprovacoes.js      # fila de aprovação
├── install.sh             # instalador idempotente
├── .env                   # chave do Studio (chmod 600)
├── DISABLED               # (opcional) pausa os ciclos
├── logs/                  # scheduler.log, cron.log
└── workspace/
    ├── leads/             # leads qualificados (JSON)
    ├── conteudo/          # roteiros de vídeo viral
    ├── paginas/           # landing pages
    ├── produtos/          # info produtos / funis
    ├── campanhas/         # análises de tráfego
    ├── clientes/          # pipeline.json
    ├── propostas/ emails/ # rascunhos
    ├── reports/           # plano-*, dados-semana-*, relatorio-*
    └── aprovacoes/
        ├── pendentes/     # aguardando você
        ├── aprovadas/
        └── rejeitadas/
```

## Limites de segurança (embutidos)

- Nenhum agente tem acesso a shell.
- Nenhum contato externo (email/mensagem/proposta) é enviado sem aprovação.
- O CEO nunca, sem você: gasta > R$50, assina contrato, escala campanha > R$100/dia ou muda preços.
- A chave do Studio fica só no `.env` (600); o nxs-agents guarda apenas o hash.
