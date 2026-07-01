# Plano simples de desenvolvimento

## Etapa 1: Base do projeto

Criar a estrutura tecnica inicial:

- Aplicacao local.
- `.env.example`.
- Banco local para cache e historico.
- Scripts de execucao.
- Logs simples por etapa.

Resultado esperado:

- Projeto roda localmente sem chamar APIs reais.
- Configuracoes ficam documentadas.

## Etapa 2: Busca no Google com Serper

Implementar:

- Campo de cidade.
- Campo de quantidade maxima.
- Busca `barbearias em {cidade} site:instagram.com`.
- Extracao e normalizacao de perfis do Instagram.
- Remocao de duplicados.

Resultado esperado:

- A ferramenta retorna uma lista limpa de perfis do Instagram.

## Etapa 3: Validacao de Instagram com Apify

Implementar:

- Consulta de perfis em lote.
- Leitura de seguidores.
- Leitura de bio e links.
- Leitura de posts recentes.
- Regra de ultimo post nao fixado.

Resultado esperado:

- A ferramenta aprova apenas perfis entre 500 e 8.000 seguidores com post nao fixado recente.

## Etapa 4: Busca de site proprio

Implementar:

- Busca por nome da barbearia e cidade.
- Analise das duas primeiras paginas.
- Blacklist de dominios que nao contam como site proprio.
- Marcacao de `tem_site_proprio` ou `sem_site_proprio`.

Resultado esperado:

- A ferramenta separa leads que ja tem site proprio de leads que parecem nao ter.

## Etapa 5: Integracao Trello

Implementar:

- Criacao de card.
- Template de descricao.
- Controle para nao criar card duplicado.

Resultado esperado:

- Leads qualificados aparecem automaticamente na lista correta do Trello.

## Etapa 6: Front-end local

Criar uma interface com:

- Campo de cidade.
- Campo de quantidade maxima de perfis.
- Botao de iniciar scraping.
- Progresso da execucao.
- Lista de perfis encontrados.
- Status por perfil.
- Quantidade de cards criados.

Resultado esperado:

- O usuario consegue rodar uma busca sem mexer no terminal.

## Etapa 7: Modo de teste e controle de custo

Implementar:

- `dry run`, sem criar cards no Trello.
- Limite diario.
- Cache local.
- Relatorio de chamadas feitas por API.

Resultado esperado:

- A ferramenta pode ser testada sem gastar desnecessariamente e sem poluir o Trello.

## Etapa 8: Prompt automatico com IA

Implementar:

- OpenRouter como provedor de IA.
- Geracao de prompt apenas para leads qualificados sem site proprio.
- Uso dos dados publicos vindos da Apify: nome, bio, cidade, link da bio, WhatsApp e dados de atividade.
- Uso de imagens publicas retornadas pela Apify para extrair paleta e estilo visual.
- Limite por execucao para controlar custo.
- Limite de imagens por prompt para controlar custo.
- Inclusao do prompt final dentro do card do Trello.
- Persistencia do prompt e metadados no Neon.

Resultado esperado:

- Cada card qualificado pode chegar no Trello com um prompt pronto para criar o site da barbearia.
- Prints do Instagram continuam fora do banco; quando implementados, devem ser temporarios.
- O fluxo fica preparado para depois trocar ou complementar as imagens da Apify por um servico de screenshot real.

## Primeiro MVP recomendado

O primeiro MVP deve fazer apenas:

1. Receber cidade e quantidade maxima.
2. Buscar perfis no Serper.
3. Mostrar perfis encontrados.
4. Validar dados do Instagram via Apify.
5. Aplicar filtros de seguidores e post recente.
6. Buscar site proprio.
7. Criar card no Trello em modo real ou simulado.

Depois disso, refinamos classificacao, visual e automacoes.
