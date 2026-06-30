# Ferramenta de scraping de leads no Google e Instagram

Este projeto vai criar uma ferramenta para encontrar barbearias ativas em uma cidade, validar se elas ainda movimentam o Instagram, verificar se possuem site proprio e enviar oportunidades para o Trello.

## Objetivo

Encontrar barbearias que provavelmente precisam de uma landing page ou site proprio.

A ferramenta deve:

1. Buscar no Google perfis de Instagram de barbearias em uma cidade.
2. Validar cada perfil no Instagram usando dados publicos via Apify.
3. Filtrar perfis com mais de 500 e menos de 8.000 seguidores.
4. Verificar se o ultimo post nao fixado tem ate 90 dias.
5. Procurar no Google se a barbearia tem site proprio.
6. Se nao tiver site proprio nas duas primeiras paginas do Google, criar um card no Trello.

## Exemplo de busca

```text
barbearias em curitiba site:instagram.com
```

## Principais integracoes

- Serper: busca no Google.
- Apify: leitura de dados publicos de perfis do Instagram.
- Trello: criacao dos cards de leads.
- Neon Postgres: controle de duplicados, historico de execucoes e limite diario.

## Configuracao local

O projeto usa variaveis de ambiente para guardar chaves de API e limites da ferramenta.

1. Copie `.env.example` para `.env`.
2. Preencha as chaves reais do Serper, Apify e Trello.
3. Mantenha `DRY_RUN=true` nos primeiros testes.

O arquivo `.env` esta protegido no `.gitignore` e nao deve ser enviado para GitHub.

## Regra de seguranca

Nao vamos usar login, senha ou cookies da conta pessoal do Instagram.

Se algum fluxo exigir uma sessao logada do Instagram, ele deve ser recusado ou substituido por outro Actor/API que trabalhe com dados publicos.

## Documentos do projeto

- [Pesquisa tecnica](docs/RESEARCH.md)
- [Especificacao do produto](docs/SPEC.md)
- [Plano de desenvolvimento](docs/PLAN.md)

## Front-end local

- [Interface local](public/index.html)
- [Estilos](public/styles.css)
- [Fluxo da pesquisa](public/script.js)
- [Backend local](server.js)

O front-end chama o backend local para buscar perfis reais pelo Serper, validar dados publicos via Apify, verificar site proprio, salvar leads qualificados no Neon e criar cards no Trello quando `DRY_RUN=false`.

## Rodar localmente

```bash
npm start
```

Depois acesse:

```text
http://127.0.0.1:3000
```

## Configuracao do Serper

Veja [Configuracao do Serper](docs/SERPER_SETUP.md).

## Configuracao do Neon

Veja [Configuracao do Neon](docs/NEON_SETUP.md).

## Configuracao da Apify

Veja [Configuracao da Apify](docs/APIFY_SETUP.md).

## Configuracao do Trello

Veja [Configuracao do Trello](docs/TRELLO_SETUP.md).

## Deploy na Vercel

Veja [Deploy na Vercel](docs/VERCEL_SETUP.md).
