# Configuracao do Trello

## Variaveis necessarias

```env
TRELLO_API_KEY=
TRELLO_TOKEN=
TRELLO_BOARD_ID=
TRELLO_LIST_ID=
```

## Como pegar board e lista

Depois de preencher `TRELLO_API_KEY` e `TRELLO_TOKEN`, reinicie o servidor local e abra:

```text
http://127.0.0.1:3000/#settings
```

Na area `Destino Trello`, escolha o board e a lista. A interface mostra os valores exatos para preencher:

```env
TRELLO_BOARD_ID=...
TRELLO_LIST_ID=...
```

Depois de salvar o `.env`, reinicie o servidor novamente.

## Quando cria card

O card so e criado quando todos estes pontos forem verdadeiros:

- `Dry run` esta desligado na tela.
- `TRELLO_API_KEY`, `TRELLO_TOKEN` e `TRELLO_LIST_ID` estao configurados.
- O perfil passou na validacao da Apify.
- O perfil tem entre 500 e 8.000 seguidores.
- O ultimo post nao fixado tem ate 90 dias.
- A busca de site proprio terminou como `Nao encontrado`.

## Conteudo do card

O card inclui:

- Nome da barbearia.
- Cidade.
- Link do Instagram.
- Seguidores.
- Ultimo post nao fixado.
- WhatsApp, quando encontrado.
- Link da bio, quando encontrado.
- Observacao de que nao foi encontrado site proprio nas paginas analisadas.

## Neon

Quando o card e criado, o lead no Neon e atualizado para:

```text
sent_trello
```

E a URL do card fica salva em `lead_results.trello_card_url`.
