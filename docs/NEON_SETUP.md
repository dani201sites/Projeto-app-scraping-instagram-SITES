# Configuracao do Neon

Este projeto usa um banco Neon Postgres separado do projeto `projeto-inicial`.

## Projeto Neon deste app

- Nome: `scraping-leads-google`
- Project ID: `lingering-sunset-62223330`
- Branch: `main`
- Database: `neondb`

O projeto `projeto-inicial` nao deve ser usado por esta ferramenta.

## Variaveis de ambiente

No arquivo `.env`, vamos usar:

```text
DATABASE_URL=
NEON_PROJECT_ID=lingering-sunset-62223330
NEON_DATABASE_NAME=neondb
```

`DATABASE_URL` deve receber a connection string do Neon. Esse valor e segredo e nao deve ser colocado em arquivos versionados.

## Tabelas previstas

O schema inicial deve guardar:

- execucoes de scraping;
- perfis encontrados;
- resultados de verificacao do Instagram;
- buscas de site proprio;
- cards enviados ao Trello;
- screenshots opcionais.

## Tabelas criadas

- `scraping_runs`: historico de cada pesquisa executada.
- `instagram_profiles`: apenas perfis de Instagram qualificados pela Apify.
- `lead_results`: apenas leads qualificados dentro de uma execucao.
- `site_search_results`: resultados analisados na busca por site proprio.

## Endpoints locais

```text
GET /api/health
GET /api/database/summary
```

Quando `DATABASE_URL` estiver preenchido no `.env`, o endpoint do Serper passa a salvar automaticamente:

- uma linha em `scraping_runs`.

Os perfis do Serper ficam temporarios ate a Apify qualificar. Apenas perfis com status `instagram_qualified` sao gravados em `instagram_profiles` e `lead_results`.

## Regras

- Nao usar o banco de outro projeto.
- Nao commitar `DATABASE_URL`.
- Criar migrations locais antes de aplicar no Neon.
- Testar migrations em branch temporaria quando possivel.
