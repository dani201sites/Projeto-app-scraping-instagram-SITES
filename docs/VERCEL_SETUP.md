# Deploy na Vercel

## Estado da estrutura

O projeto agora roda nos dois formatos:

- Local: `npm start`, usando `server.js`.
- Vercel: frontend em `public/` e rotas serverless em `api/`, usando `lib/app.js`.

O front estatico fica em:

- `public/index.html`
- `public/styles.css`
- `public/script.js`

As rotas de API na Vercel sao:

```text
/api/health
/api/database/summary
/api/serper/instagram-profiles
/api/apify/instagram-profiles
/api/serper/site-search
/api/trello/boards
/api/trello/lists
/api/trello/cards
```

## Variaveis de ambiente

No painel da Vercel, configure as mesmas variaveis do `.env` local:

```env
SERPER_API_KEY=
APIFY_TOKEN=
APIFY_INSTAGRAM_ACTOR_ID=apify~instagram-profile-scraper
APIFY_MAX_PROFILES_PER_RUN=30
APIFY_MAX_TOTAL_CHARGE_USD=0.25

DATABASE_URL=
NEON_PROJECT_ID=lingering-sunset-62223330
NEON_DATABASE_NAME=neondb

TRELLO_API_KEY=
TRELLO_TOKEN=
TRELLO_BOARD_ID=
TRELLO_LIST_ID=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.5-flash
ENABLE_AI_PROMPT_GENERATION=false
MAX_AI_PROMPTS_PER_RUN=5
MAX_AI_IMAGES_PER_PROMPT=4
PUBLIC_APP_URL=https://SEU-PROJETO.vercel.app

MAX_PROFILES_PER_DAY=30
MIN_INSTAGRAM_FOLLOWERS=500
MAX_INSTAGRAM_FOLLOWERS=8000
RECENT_POST_DAYS=90
GOOGLE_SITE_SEARCH_PAGES=2
DRY_RUN=true
```

Nao coloque `.env` no GitHub.

## Teste depois do deploy

Abra:

```text
https://SEU-PROJETO.vercel.app/api/health
```

O retorno esperado deve indicar:

```json
{
  "ok": true,
  "serperConfigured": true,
  "apifyConfigured": true,
  "neonConfigured": true,
  "trelloConfigured": true,
  "trelloTargetConfigured": true,
  "openRouterConfigured": true,
  "aiPromptGenerationEnabled": true,
  "databaseConnected": true
}
```

Depois abra:

```text
https://SEU-PROJETO.vercel.app
```

## Observacao sobre tempo de execucao

Algumas rotas chamam Serper, Apify, Neon e Trello na mesma execucao. Se uma busca grande estourar tempo na Vercel, o caminho correto sera dividir a execucao em etapas menores ou usar uma fila/background job.

Para o MVP, teste primeiro com 3 a 5 perfis.

## Proximo passo

Depois que o deploy estiver respondendo, implementar a segunda fase:

```text
lead sem site -> print temporario -> OpenRouter -> prompt final enriquecido -> Trello
```

Na fase atual, o OpenRouter gera o prompt final usando os dados publicos vindos da Apify: nome, bio, cidade, link da bio, WhatsApp, seguidores, recencia do post e URLs de imagens publicas retornadas pela Apify. O print literal da tela ainda nao e salvo nem enviado. Quando adicionarmos print, ele deve ser descartado depois da analise. O banco deve salvar apenas o prompt final e os metadados da IA.
