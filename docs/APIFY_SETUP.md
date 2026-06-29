# Configuracao da Apify

A Apify sera usada para validar e enriquecer os perfis encontrados pelo Serper.

## Resposta curta sobre conta

Voce cria/usa uma conta da Apify e fornece `APIFY_TOKEN`.

Isso nao significa usar sua conta pessoal do Instagram. A ferramenta nao deve receber login, senha ou cookie do Instagram.

## Variaveis

No `.env`:

```text
APIFY_TOKEN=
APIFY_INSTAGRAM_ACTOR_ID=apify~instagram-profile-scraper
APIFY_MAX_PROFILES_PER_RUN=30
APIFY_MAX_TOTAL_CHARGE_USD=0.25
```

## Endpoint local

```text
POST /api/apify/instagram-profiles
```

Corpo:

```json
{
  "runId": 1,
  "handles": ["barbeariajohnsix", "studiodabarba"]
}
```

## O que a validacao salva no Neon

Na tabela `instagram_profiles`, a ferramenta salva apenas perfis qualificados:

- seguidores;
- link externo;
- WhatsApp, se detectado;
- data do ultimo post nao fixado;
- data da ultima checagem.

Na tabela `lead_results`, a ferramenta salva apenas:

- `instagram_qualified`;

Os perfis descartados pela Apify aparecem na tela da execucao, mas nao ficam gravados no banco.

## Controle de custo

A ferramenta limita a Apify por:

- no maximo 30 perfis por rodada;
- `APIFY_MAX_TOTAL_CHARGE_USD=0.25` por execucao;
- chamada em lote, nao uma execucao por perfil.

## Fonte

- API Apify: https://docs.apify.com/api/v2
- Instagram Profile Scraper: https://apify.com/apify/instagram-profile-scraper
