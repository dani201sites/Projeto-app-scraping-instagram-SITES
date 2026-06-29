# Especificacao do produto

## Produto

Ferramenta para encontrar leads de barbearias por cidade e enviar oportunidades qualificadas para o Trello.

## Usuario principal

Prestador de servico que quer encontrar barbearias ativas no Instagram, mas sem site proprio, para oferecer criacao de landing page ou site.

## Entrada do usuario

Na interface inicial, o usuario deve informar:

- Cidade.
- Quantidade maxima de perfis desejados.
- Palavra-chave base, inicialmente `barbearias`.

Exemplo:

```text
Cidade: Curitiba
Quantidade maxima: 30
Palavra-chave: barbearias
```

## Acao principal

Botao:

```text
Iniciar scraping
```

Ao clicar, a ferramenta inicia a busca, mostra progresso e para quando:

- Encontrar a quantidade maxima de perfis configurada.
- Nao houver mais perfis diferentes para analisar.
- Atingir limite diario.
- Ocorrer erro critico de API.

## Regras de busca

Consulta inicial:

```text
{palavra-chave} em {cidade} site:instagram.com
```

Exemplo:

```text
barbearias em curitiba site:instagram.com
```

## Regras de perfil do Instagram

Um perfil so pode seguir no funil se:

- For um perfil valido do Instagram.
- Representar uma barbearia ou negocio muito proximo.
- Tiver pelo menos 500 seguidores.
- Tiver no maximo 8.000 seguidores.
- Tiver ultimo post nao fixado nos ultimos 90 dias.

## Regra de post recente

A ferramenta deve ignorar posts fixados.

Logica:

1. Buscar posts recentes do perfil.
2. Ignorar posts com `isPinned = true`, quando esse campo estiver disponivel.
3. Encontrar o post nao fixado mais recente.
4. Aprovar apenas se esse post tiver ate 90 dias.

Se nao for possivel determinar a data do ultimo post nao fixado, o perfil deve ficar com status de revisao ou ser descartado no MVP.

## Regras de site proprio

Para cada perfil aprovado no Instagram, a ferramenta deve pesquisar no Google:

```text
"{nome da barbearia}" "{cidade}"
```

Tambem pode testar variacoes:

```text
"{nome da barbearia}" "{cidade}" site oficial
"{usuario_instagram}" "{cidade}"
```

A ferramenta deve analisar ate as duas primeiras paginas do Google.

## O que conta como site proprio

Aceitar:

- Dominio proprio da barbearia.
- Landing page propria.
- Site institucional simples com marca, endereco, servicos ou contato.

Rejeitar:

- Instagram.
- Facebook.
- Google Maps.
- Linktree ou agregadores de links.
- Apps de agendamento.
- Marketplaces.
- Diretorios.
- Paginas genericas de avaliacao.

Exemplos de dominios a rejeitar inicialmente:

- instagram.com
- facebook.com
- maps.google.com
- google.com/maps
- linktr.ee
- wa.me
- api.whatsapp.com
- trinks.com
- booksy.com
- appbarber.com
- getinapp.com.br
- avec.app

## Regras do Trello

Criar card apenas se:

- Perfil passou nos filtros de Instagram.
- Nao foi encontrado site proprio nas duas primeiras paginas do Google.
- `Dry run` esta desligado.
- `TRELLO_LIST_ID` esta configurado.

Campos do card:

- Nome da barbearia.
- Cidade.
- Instagram.
- Quantidade de seguidores.
- Data do ultimo post nao fixado.
- WhatsApp, se encontrado.
- Link da bio, se encontrado.
- Evidencia de que nao achou site proprio.
- Data da execucao.

## Estados possiveis do lead

- `instagram_qualified`
- `qualified_no_site`
- `sent_trello`
- `discarded_low_followers`
- `discarded_high_followers`
- `discarded_no_recent_post`
- `discarded_has_own_site`
- `manual_review`

## Requisitos de seguranca

- Nao usar conta pessoal do Instagram.
- Nao armazenar senha do Instagram.
- Nao armazenar cookie pessoal do Instagram.
- Guardar chaves de API somente em `.env`.
- Nunca commitar `.env`.

## Variaveis de ambiente previstas

```text
SERPER_API_KEY=
APIFY_TOKEN=
APIFY_INSTAGRAM_ACTOR_ID=
TRELLO_API_KEY=
TRELLO_TOKEN=
TRELLO_BOARD_ID=
TRELLO_LIST_ID=
MAX_PROFILES_PER_DAY=30
```
