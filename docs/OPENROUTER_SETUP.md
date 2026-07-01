# Configuracao do OpenRouter

## Objetivo

O OpenRouter gera automaticamente um prompt de criacao de site para cada lead qualificado sem site proprio.

No fluxo atual, a IA usa os dados publicos ja coletados pela Apify:

- Nome do perfil.
- Bio.
- Cidade.
- Link da bio.
- WhatsApp, quando encontrado.
- Seguidores.
- Data do ultimo post nao fixado.
- Foto de perfil e imagens publicas de posts recentes, quando a Apify retornar essas URLs.

O print literal da tela do Instagram fica para uma etapa mais robusta. Por enquanto nenhum print e salvo.

## Variaveis

Configure na Vercel:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-2.5-flash
ENABLE_AI_PROMPT_GENERATION=true
MAX_AI_PROMPTS_PER_RUN=5
MAX_AI_IMAGES_PER_PROMPT=4
PUBLIC_APP_URL=https://SEU-PROJETO.vercel.app
```

Para testar sem gastar, deixe:

```env
ENABLE_AI_PROMPT_GENERATION=false
```

Quando quiser criar cards reais com prompt, use:

```env
ENABLE_AI_PROMPT_GENERATION=true
```

## Quando a IA roda

A IA so roda quando o card do Trello seria criado de verdade:

1. Perfil aprovado pela Apify.
2. Perfil entre 500 e 8.000 seguidores.
3. Ultimo post nao fixado recente.
4. Site proprio nao encontrado.
5. `Dry run` desligado.
6. `ENABLE_AI_PROMPT_GENERATION=true`.
7. `OPENROUTER_API_KEY` configurada.

## Limite de custo

`MAX_AI_PROMPTS_PER_RUN=5` limita quantos prompts podem ser gerados por execucao.

Se uma busca criar 12 cards e o limite estiver em 5, os 5 primeiros recebem prompt da IA e os outros cards sao criados com uma observacao dizendo que o limite foi atingido.

`MAX_AI_IMAGES_PER_PROMPT=4` limita quantas imagens publicas da Apify vao para a IA em cada prompt. Use 0 para desativar leitura visual sem desligar a geracao textual.

## Resultado no Trello

O card recebe:

- Dados do lead.
- Status de lead sem site proprio.
- Prompt completo para criacao do site.

Se a IA falhar, o card ainda e criado, mas a descricao informa o erro.

## Caminho robusto futuro

Se as imagens retornadas pela Apify nao forem suficientes, a proxima camada sera criar um provedor de screenshot temporario.

Opcoes previstas:

- `apify_images`: fluxo atual, sem navegador proprio.
- `screenshot_service`: Browserless ou servico equivalente para print da primeira dobra.
- `apify_screenshot_actor`: actor dedicado da Apify para screenshot.

O contrato deve continuar o mesmo: retornar URLs ou base64 temporario para a IA, descartar a imagem e salvar apenas prompt/metadados.
