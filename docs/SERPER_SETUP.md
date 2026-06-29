# Configuracao do Serper

O Serper sera a primeira API real da ferramenta. Ele vai buscar no Google os perfis de Instagram e, depois, verificar se cada barbearia tem site proprio.

## Por que usar backend local

A chave `SERPER_API_KEY` nao deve ficar no JavaScript do navegador, porque qualquer pessoa poderia inspecionar a pagina e copiar a chave.

Por isso, o fluxo correto e:

1. Front-end envia cidade, palavra-chave e quantidade para o backend local.
2. Backend le a chave no `.env`.
3. Backend chama o Serper.
4. Backend devolve ao front-end apenas os resultados filtrados.

## Variavel necessaria

No arquivo `.env`:

```text
SERPER_API_KEY=sua_chave_aqui
```

## Endpoint local criado

```text
GET /api/serper/instagram-profiles?city=Curitiba&keyword=barbearias&limit=30
```

Esse endpoint:

- monta a busca `barbearias em Curitiba site:instagram.com`;
- chama o Serper;
- analisa os resultados organicos;
- extrai apenas URLs de perfis do Instagram;
- remove posts, reels, hashtags e duplicados;
- limita a quantidade maxima a 30 perfis.

## Como rodar

```bash
npm start
```

Depois acesse:

```text
http://127.0.0.1:3000
```

## Como testar a API local

Com o servidor rodando:

```text
http://127.0.0.1:3000/api/health
```

E depois:

```text
http://127.0.0.1:3000/api/serper/instagram-profiles?city=Curitiba&keyword=barbearias&limit=30
```

## Fonte

Documentacao e produto Serper: https://serper.dev/
