# Pesquisa tecnica

Pesquisa feita para orientar a criacao da ferramenta de scraping de leads.

## Resumo da arquitetura recomendada

A ferramenta deve usar APIs externas em vez de tentar automatizar diretamente o navegador do usuario.

Fluxo recomendado:

1. Serper pesquisa no Google por perfis de Instagram.
2. A aplicacao normaliza e remove duplicados.
3. Apify consulta dados publicos dos perfis do Instagram.
4. A aplicacao aplica filtros de seguidores e atividade.
5. Serper pesquisa se a barbearia tem site proprio.
6. A aplicacao rejeita resultados de marketplaces, apps de agenda e diretorios.
7. Trello recebe apenas os leads aprovados.

## Serper

Uso previsto:

- Buscar perfis de Instagram no Google.
- Buscar site proprio de cada barbearia.
- Analisar as duas primeiras paginas de resultados.

Exemplo de consulta inicial:

```text
barbearias em curitiba site:instagram.com
```

Exemplo de consulta por barbearia:

```text
"Barbearia Exemplo" "Curitiba"
```

Observacoes:

- O free tier do Serper e suficiente para validar um MVP pequeno.
- Em escala de 30 perfis por dia, o custo tende a ser baixo.
- A ferramenta deve contar quantas chamadas fez por execucao.

Fonte: https://serper.dev/

## Apify

Uso previsto:

- Ler dados publicos de perfis do Instagram.
- Capturar quantidade de seguidores.
- Capturar bio, links externos e posts recentes.
- Identificar posts fixados quando o Actor retornar esse campo.

Campos importantes encontrados na documentacao/paginas dos Actors:

- `followersCount`
- `externalUrl`
- `externalUrls`
- `latestPosts`
- `isPinned`

Regras importantes:

- Nao usar login pessoal do Instagram.
- Nao usar cookies pessoais do Instagram.
- Preferir Actors que trabalham com dados publicos.
- Rodar em lote quando possivel, para reduzir custo.
- Salvar perfis ja analisados para evitar chamadas repetidas.

Fonte do Instagram Profile Scraper: https://apify.com/apify/instagram-profile-scraper

Fonte do Instagram Scraper: https://apify.com/apify/instagram-scraper

Fonte de precos da Apify: https://apify.com/pricing

## Trello

Uso previsto:

- Criar um card para cada lead aprovado.
- Incluir nome, cidade, Instagram, seguidores, data do ultimo post nao fixado, WhatsApp e observacao sobre site proprio.

Os limites de API do Trello sao altos para este caso de uso. Criar ate 30 cards por dia nao deve ser um problema.

Fonte de limite de API: https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/

Fonte de cards da API: https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

## Riscos tecnicos

### Instagram

O Instagram muda com frequencia. Mesmo usando Apify, alguns perfis podem falhar, ficar incompletos ou exigir retry.

Mitigacao:

- Aceitar falhas parciais.
- Registrar status por perfil.
- Nao depender de uma unica execucao.
- Nao usar conta pessoal.

### Classificacao de site proprio

A parte mais sensivel e decidir se um resultado e realmente site proprio ou apenas pagina de app/diretorio.

Mitigacao:

- Criar uma blacklist de dominios.
- Rejeitar Instagram, Facebook, Google Maps, Linktree e apps de agendamento.
- Aceitar dominios com nome parecido com a barbearia.
- Comecar sem IA; usar IA apenas depois, se houver muitos casos ambiguos.

### Custo

O Serper tende a ser barato nesse volume. A Apify e o ponto principal de controle de custo.

Mitigacao:

- Limite diario de perfis.
- Cache local.
- Rodar Apify em lote.
- Buscar site proprio apenas para perfis que passaram pelos filtros do Instagram.

## Estimativa simples de uso

Para 30 perfis por dia:

- 1 chamada Serper para achar perfis iniciais.
- Ate 30 validacoes de Instagram via Apify, idealmente em lote.
- Ate 30 chamadas Serper para buscar site proprio.
- Ate 30 cards no Trello, normalmente menos que isso.

Na pratica, o numero de cards criados deve ser menor que o numero de perfis encontrados, porque varios serao descartados por seguidores, atividade ou site proprio existente.

