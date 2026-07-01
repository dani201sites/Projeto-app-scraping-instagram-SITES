import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createScrapingRun,
  finishScrapingRun,
  getDatabaseSummary,
  isDatabaseConfigured,
  pingDatabase,
  saveAiPromptGenerated,
  saveQualifiedInstagramProfile,
  saveSiteSearchOutcome,
  saveTrelloCardCreated
} from "../db.js";

const rootDir = resolve(fileURLToPath(new URL("../", import.meta.url)));
const publicDir = join(rootDir, "public");

await loadEnvFile();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const invalidInstagramSegments = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "direct",
  "about",
  "developer",
  "privacy",
  "terms",
  "hashtags"
]);

const rejectedSiteDomains = [
  "instagram.com",
  "facebook.com",
  "m.facebook.com",
  "maps.google.com",
  "google.com",
  "linktr.ee",
  "wa.me",
  "api.whatsapp.com",
  "whatsapp.com",
  "trinks.com",
  "booksy.com",
  "appbarber.com",
  "getinapp.com.br",
  "avec.app",
  "marketplace",
  "guiamais.com.br",
  "solutudo.com.br"
];

export async function handleRequest(request, response) {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (requestUrl.pathname === "/api/health") {
      const databaseConnected = isDatabaseConfigured() ? await pingDatabase() : false;

      sendJson(response, 200, {
        ok: true,
        serperConfigured: Boolean(process.env.SERPER_API_KEY),
        apifyConfigured: Boolean(process.env.APIFY_TOKEN),
        neonConfigured: isDatabaseConfigured(),
        trelloConfigured: isTrelloConfigured(),
        trelloTargetConfigured: Boolean(process.env.TRELLO_BOARD_ID && process.env.TRELLO_LIST_ID),
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        aiPromptGenerationEnabled: isAiPromptGenerationEnabled(),
        databaseConnected
      });
      return;
    }

    if (requestUrl.pathname === "/api/database/summary") {
      sendJson(response, 200, await getDatabaseSummary());
      return;
    }

    if (requestUrl.pathname === "/api/serper/instagram-profiles") {
      await handleInstagramProfileSearch(requestUrl, response);
      return;
    }

    if (requestUrl.pathname === "/api/apify/instagram-profiles") {
      await handleApifyInstagramProfiles(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/serper/site-search") {
      await handleSiteSearch(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/trello/boards") {
      await handleTrelloBoards(response);
      return;
    }

    if (requestUrl.pathname === "/api/trello/lists") {
      await handleTrelloLists(requestUrl, response);
      return;
    }

    if (requestUrl.pathname === "/api/trello/cards") {
      await handleCreateTrelloCards(request, response);
      return;
    }

    await serveStaticFile(requestUrl.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: "internal_error",
      message: error.message
    });
  }
}

async function handleTrelloBoards(response) {
  if (!isTrelloConfigured()) {
    sendJson(response, 503, {
      error: "trello_not_configured",
      message: "Preencha TRELLO_API_KEY e TRELLO_TOKEN no arquivo .env."
    });
    return;
  }

  const boards = await fetchTrello("/members/me/boards", {
    filter: "open",
    fields: "name,url,closed,dateLastActivity"
  });

  sendJson(response, 200, {
    selectedBoardId: process.env.TRELLO_BOARD_ID || null,
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      url: board.url,
      closed: board.closed,
      dateLastActivity: board.dateLastActivity
    }))
  });
}

async function handleTrelloLists(requestUrl, response) {
  if (!isTrelloConfigured()) {
    sendJson(response, 503, {
      error: "trello_not_configured",
      message: "Preencha TRELLO_API_KEY e TRELLO_TOKEN no arquivo .env."
    });
    return;
  }

  const boardId = cleanText(requestUrl.searchParams.get("boardId") || process.env.TRELLO_BOARD_ID || "");

  if (!boardId) {
    sendJson(response, 400, {
      error: "missing_board_id",
      message: "Escolha um board do Trello para carregar as listas."
    });
    return;
  }

  const lists = await fetchTrello(`/boards/${encodeURIComponent(boardId)}/lists`, {
    filter: "open",
    fields: "name,closed,pos"
  });

  sendJson(response, 200, {
    boardId,
    selectedListId: process.env.TRELLO_LIST_ID || null,
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      closed: list.closed,
      pos: list.pos
    }))
  });
}

async function handleCreateTrelloCards(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, {
      error: "method_not_allowed",
      message: "Use POST para criar cards no Trello."
    });
    return;
  }

  if (!isTrelloConfigured()) {
    sendJson(response, 503, {
      error: "trello_not_configured",
      message: "Preencha TRELLO_API_KEY e TRELLO_TOKEN no arquivo .env."
    });
    return;
  }

  const listId = cleanText(process.env.TRELLO_LIST_ID || "");

  if (!listId) {
    sendJson(response, 503, {
      error: "trello_list_not_configured",
      message: "Preencha TRELLO_LIST_ID no arquivo .env."
    });
    return;
  }

  const body = await readJsonBody(request);
  const dryRun = body.dryRun !== false;
  const runId = body.runId || null;
  const city = cleanText(body.city || "");
  const profiles = Array.isArray(body.profiles) ? body.profiles : [];
  const leads = profiles.filter(isTrelloLeadCandidate);

  if (dryRun) {
    sendJson(response, 200, {
      dryRun: true,
      requested: profiles.length,
      created: 0,
      cards: leads.map((profile) => ({
        handle: profile.handle,
        name: buildTrelloCardName(profile, city),
        dryRun: true
      }))
    });
    return;
  }

  const cards = [];
  let aiPromptsGenerated = 0;
  const maxAiPrompts = clamp(Number(process.env.MAX_AI_PROMPTS_PER_RUN || 5), 0, 30);

  for (const profile of leads) {
    const aiResult = aiPromptsGenerated < maxAiPrompts
      ? await generateAiPromptForProfile({ profile, city })
      : { enabled: isAiPromptGenerationEnabled(), prompt: null, error: "Limite de prompts da IA atingido nesta execucao." };

    if (aiResult.prompt) {
      aiPromptsGenerated += 1;
      await saveAiPromptGenerated({
        runId,
        handle: profile.handle,
        aiResult
      });
    }

    const card = await createTrelloCard({
      listId,
      name: buildTrelloCardName(profile, city),
      desc: buildTrelloCardDescription(profile, city, aiResult)
    });

    const normalizedCard = {
      handle: profile.handle,
      id: card.id,
      name: card.name,
      url: card.shortUrl || card.url
    };

    cards.push(normalizedCard);
    await saveTrelloCardCreated({
      runId,
      handle: profile.handle,
      cardUrl: normalizedCard.url
    });
  }

  sendJson(response, 200, {
    dryRun: false,
    requested: profiles.length,
    created: cards.length,
    aiPromptsGenerated,
    cards
  });
}

async function handleInstagramProfileSearch(requestUrl, response) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    sendJson(response, 503, {
      error: "serper_not_configured",
      message: "Preencha SERPER_API_KEY no arquivo .env para usar a busca real."
    });
    return;
  }

  const city = cleanText(requestUrl.searchParams.get("city") || "");
  const keyword = cleanText(requestUrl.searchParams.get("keyword") || "barbearias");
  const limit = clamp(Number(requestUrl.searchParams.get("limit") || 30), 1, 30);
  const dryRun = requestUrl.searchParams.get("dryRun") !== "false";

  if (!city) {
    sendJson(response, 400, {
      error: "missing_city",
      message: "Informe uma cidade para pesquisar."
    });
    return;
  }

  const query = `${keyword} em ${city} site:instagram.com`;
  const profiles = [];
  const seenHandles = new Set();
  let calls = 0;
  let runId = null;

  runId = await createScrapingRun({
    city,
    keyword,
    requestedLimit: limit,
    dryRun
  });

  try {
    for (let page = 1; page <= 4 && profiles.length < limit; page += 1) {
      const result = await searchSerper(apiKey, {
        q: query,
        gl: "br",
        hl: "pt-br",
        num: 10,
        page
      });

      calls += 1;

      for (const item of result.organic || []) {
        const candidates = extractInstagramCandidates(item);

        for (const candidate of candidates) {
          if (seenHandles.has(candidate.handle)) {
            continue;
          }

          seenHandles.add(candidate.handle);
          profiles.push(candidate);

          if (profiles.length >= limit) {
            break;
          }
        }

        if (profiles.length >= limit) {
          break;
        }
      }
    }

    await finishScrapingRun({
      runId,
      status: "completed",
      serperCalls: calls
    });
  } catch (error) {
    await finishScrapingRun({
      runId,
      status: "error",
      serperCalls: calls
    });

    throw error;
  }

  sendJson(response, 200, {
    runId,
    persisted: Boolean(runId),
    query,
    city,
    keyword,
    limit,
    calls,
    profiles
  });
}

async function handleSiteSearch(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, {
      error: "method_not_allowed",
      message: "Use POST para buscar site proprio."
    });
    return;
  }

  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    sendJson(response, 503, {
      error: "serper_not_configured",
      message: "Preencha SERPER_API_KEY no arquivo .env para buscar site proprio."
    });
    return;
  }

  const body = await readJsonBody(request);
  const runId = body.runId || null;
  const city = cleanText(body.city || "");
  const profiles = Array.isArray(body.profiles) ? body.profiles : [];
  const pages = clamp(Number(body.pages || process.env.GOOGLE_SITE_SEARCH_PAGES || 2), 1, 2);
  const outcomes = [];
  let calls = 0;

  for (const profile of profiles) {
    if (profile.apifyStatus !== "instagram_qualified") {
      continue;
    }

    const outcome = await searchOwnSiteForProfile({ apiKey, profile, city, pages });
    calls += outcome.calls;
    outcomes.push(outcome);
    await saveSiteSearchOutcome({ runId, profile, outcome });
  }

  sendJson(response, 200, {
    runId,
    requested: profiles.length,
    searched: outcomes.length,
    calls,
    outcomes
  });
}

async function handleApifyInstagramProfiles(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, {
      error: "method_not_allowed",
      message: "Use POST para validar perfis na Apify."
    });
    return;
  }

  const token = process.env.APIFY_TOKEN;

  if (!token) {
    sendJson(response, 503, {
      error: "apify_not_configured",
      message: "Preencha APIFY_TOKEN no arquivo .env para validar perfis do Instagram."
    });
    return;
  }

  const body = await readJsonBody(request);
  const runId = body.runId || null;
  const candidates = Array.isArray(body.profiles) ? body.profiles : [];
  const candidateByHandle = new Map(
    candidates
      .map((candidate) => [cleanInstagramHandle(candidate.handle), candidate])
      .filter(([handle]) => Boolean(handle))
  );
  const handles = [...new Set([
    ...(body.handles || []).map(cleanInstagramHandle).filter(Boolean),
    ...candidateByHandle.keys()
  ])];
  const maxProfiles = clamp(Number(process.env.APIFY_MAX_PROFILES_PER_RUN || 30), 1, 30);
  const limitedHandles = handles.slice(0, maxProfiles);

  if (limitedHandles.length === 0) {
    sendJson(response, 400, {
      error: "missing_handles",
      message: "Envie ao menos um handle do Instagram."
    });
    return;
  }

  const actorItems = await runApifyInstagramProfileScraper({
    token,
    handles: limitedHandles
  });
  const profiles = actorItems
    .map((item) => normalizeApifyProfile(item, candidateByHandle))
    .filter(Boolean);
  let savedQualified = 0;

  for (const profile of profiles) {
    const savedProfileId = await saveQualifiedInstagramProfile({ runId, profile });

    if (savedProfileId) {
      savedQualified += 1;
    }
  }

  sendJson(response, 200, {
    runId,
    requested: limitedHandles.length,
    returned: profiles.length,
    savedQualified,
    profiles
  });
}

async function searchSerper(apiKey, body) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Serper retornou HTTP ${response.status}`);
  }

  return payload;
}

async function createTrelloCard({ listId, name, desc }) {
  return fetchTrello("/cards", {
    idList: listId,
    name,
    desc,
    pos: "top"
  }, {
    method: "POST"
  });
}

async function fetchTrello(pathname, params = {}, options = {}) {
  const url = new URL(`https://api.trello.com/1${pathname}`);
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_TOKEN);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Accept": "application/json"
    }
  });
  const text = await response.text();
  const payload = text ? parseJson(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || text || `Trello retornou HTTP ${response.status}`);
  }

  return payload;
}

function isTrelloLeadCandidate(profile) {
  return profile?.apifyStatus === "instagram_qualified" && profile?.siteStatus === "not_found";
}

function buildTrelloCardName(profile, city) {
  const name = cleanBusinessName(profile.name || profile.displayName || profile.handle);
  const location = cleanText(profile.city || city || "");

  return location ? `${name} - ${location}` : name;
}

function buildTrelloCardDescription(profile, city, aiResult = {}) {
  const lines = [
    `Instagram: ${profile.instagramUrl || `https://www.instagram.com/${profile.handle}/`}`,
    `Cidade: ${profile.city || city || "-"}`,
    `Seguidores: ${formatNumber(profile.followers)}`,
    `Ultimo post nao fixado: ${formatLastPost(profile)}`,
    `WhatsApp: ${profile.whatsappUrl || "-"}`,
    `Link da bio: ${profile.externalUrl || "-"}`,
    "",
    "Status: lead qualificado sem site proprio encontrado nas paginas analisadas."
  ];

  if (aiResult.prompt) {
    lines.push(
      "",
      "Prompt para criar site:",
      aiResult.prompt
    );
  }

  if (aiResult.error) {
    lines.push(
      "",
      `IA: prompt nao gerado. Motivo: ${aiResult.error}`
    );
  }

  return lines.join("\n");
}

async function generateAiPromptForProfile({ profile, city }) {
  if (!isAiPromptGenerationEnabled()) {
    return { enabled: false, prompt: null };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      enabled: true,
      prompt: null,
      error: "OPENROUTER_API_KEY nao configurada."
    };
  }

  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const payload = buildOpenRouterPayload({ model, profile, city });

  try {
    const result = await requestOpenRouterCompletion({ apiKey, payload });

    if (!result.ok && shouldRetryOpenRouterWithoutImages(result.error)) {
      const textOnlyPayload = buildOpenRouterPayload({ model, profile, city, forceTextOnly: true });
      const textOnlyResult = await requestOpenRouterCompletion({ apiKey, payload: textOnlyPayload });

      if (textOnlyResult.ok) {
        const content = normalizeAiContent(textOnlyResult.payload.choices?.[0]?.message?.content);
        const analysis = parseAiAnalysis(content);
        const fallbackAnalysis = {
          ...analysis,
          visualFallbackReason: result.error
        };
        const prompt = buildWebsitePrompt({
          profile: {
            ...profile,
            visualImageUrls: []
          },
          city,
          analysis: fallbackAnalysis
        });

        return {
          enabled: true,
          model,
          analysis: fallbackAnalysis,
          prompt
        };
      }

      return {
        enabled: true,
        model,
        prompt: null,
        error: textOnlyResult.error
      };
    }

    if (!result.ok) {
      return {
        enabled: true,
        model,
        prompt: null,
        error: result.error
      };
    }

    const content = normalizeAiContent(result.payload.choices?.[0]?.message?.content);
    const analysis = parseAiAnalysis(content);
    const prompt = buildWebsitePrompt({ profile, city, analysis });

    return {
      enabled: true,
      model,
      analysis,
      prompt
    };
  } catch (error) {
    return {
      enabled: true,
      model,
      prompt: null,
      error: error.message
    };
  }
}

async function requestOpenRouterCompletion({ apiKey, payload }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": getPublicAppUrl(),
      "X-Title": "LeadScrape Barber"
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      payload: result,
      error: result.error?.message || result.message || `OpenRouter retornou HTTP ${response.status}`
    };
  }

  return {
    ok: true,
    payload: result,
    error: null
  };
}

function shouldRetryOpenRouterWithoutImages(error) {
  return /image|image_url|URL did not return an image|received text\/error content/i.test(String(error || ""));
}

function buildOpenRouterPayload({ model, profile, city, forceTextOnly = false }) {
  const imageUrls = forceTextOnly ? [] : getProfileVisualUrls(profile);

  return {
    model,
    temperature: 0.25,
    max_tokens: 1400,
    messages: [
      {
        role: "system",
        content: [
          "Voce transforma dados publicos de Instagram de barbearias em briefing objetivo para criacao de landing pages.",
          "Quando imagens forem enviadas, use-as para identificar paleta de cores, estilo visual, aparencia do logo/feed e clima da marca.",
          "Responda apenas JSON valido, sem markdown.",
          "Nao invente telefones, enderecos ou precos. Quando nao houver dado, use null ou uma sugestao generica marcada como inferida."
        ].join(" ")
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              task: "Analise os dados e as imagens publicas da barbearia para montar um prompt de site.",
              imageInstructions: imageUrls.length > 0
                ? "Use as imagens anexadas para inferir cores predominantes, estilo visual, materiais, tom de marca e direcao estetica. Nao descreva pessoas especificas."
                : "Nenhuma imagem foi encontrada pela Apify. Use apenas os dados textuais e marque a paleta como inferida.",
              expectedJson: {
                businessName: "nome comercial mais provavel",
                city: "cidade",
                palette: ["cor principal observada", "cor secundaria observada", "cor de apoio observada"],
                visualIdentity: {
                  dominantColors: ["cores percebidas nas imagens"],
                  mood: "clima visual da marca",
                  logoOrFeedNotes: "observacoes sobre logo/feed sem inventar detalhes"
                },
                styleNotes: ["notas visuais e de posicionamento"],
                contentFacts: ["informacoes concretas vistas nos dados"],
                callToAction: "CTA recomendado",
                address: "endereco se aparecer",
                warnings: ["dados importantes que faltam ou foram inferidos"]
              },
              profile: {
                handle: profile.handle,
                displayName: profile.name || profile.displayName || profile.handle,
                bio: profile.bio || null,
                city: profile.city || city || null,
                instagramUrl: profile.instagramUrl || `https://www.instagram.com/${profile.handle}/`,
                externalUrl: profile.externalUrl || null,
                whatsappUrl: profile.whatsappUrl || null,
                followers: profile.followers || profile.followersCount || null,
                daysSincePost: profile.daysSincePost || null,
                imageCount: imageUrls.length
              }
            })
          },
          ...imageUrls.map((url) => ({
            type: "image_url",
            image_url: { url }
          }))
        ]
      }
    ]
  };
}

function normalizeAiContent(content) {
  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || part?.content || "")
      .join("\n")
      .trim();
  }

  return String(content || "").trim();
}

function parseAiAnalysis(content) {
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return {};
  }

  return parseJson(cleaned.slice(start, end + 1)) || {};
}

function buildWebsitePrompt({ profile, city, analysis }) {
  const businessName = cleanBusinessName(
    analysis.businessName ||
    profile.name ||
    profile.displayName ||
    profile.handle
  );
  const palette = normalizeList(analysis.palette);
  const contentFacts = normalizeList(analysis.contentFacts);
  const styleNotes = normalizeList(analysis.styleNotes);
  const warnings = [
    ...normalizeList(analysis.warnings),
    analysis.visualFallbackReason ? `Analise visual ignorada: ${cleanText(String(analysis.visualFallbackReason))}` : null
  ].filter(Boolean);
  const visualIdentity = analysis.visualIdentity && typeof analysis.visualIdentity === "object" ? analysis.visualIdentity : {};
  const dominantColors = normalizeList(visualIdentity.dominantColors);
  const visualNotes = [
    visualIdentity.mood ? `Clima visual: ${cleanText(String(visualIdentity.mood))}` : null,
    visualIdentity.logoOrFeedNotes ? `Logo/feed: ${cleanText(String(visualIdentity.logoOrFeedNotes))}` : null,
    dominantColors.length > 0 ? `Cores observadas nas imagens: ${dominantColors.join(", ")}` : null,
    profile.visualImageUrls?.length ? `Referencia visual analisada: ${profile.visualImageUrls.length} imagem(ns) publica(s) do Instagram.` : null
  ].filter(Boolean);
  const cityText = cleanText(analysis.city || profile.city || city || "");
  const cta = cleanText(analysis.callToAction || "Chama no WhatsApp para agendar ou conhecer os planos");
  const address = cleanText(analysis.address || "");
  const fallbackFacts = [
    cityText ? `Cidade/base de atendimento: ${cityText}` : null,
    profile.whatsappUrl ? `WhatsApp/link de contato: ${profile.whatsappUrl}` : null,
    profile.externalUrl ? `Link da bio: ${profile.externalUrl}` : null,
    profile.bio ? `Bio do Instagram: ${profile.bio}` : null
  ].filter(Boolean);
  const facts = contentFacts.length > 0 ? contentFacts : fallbackFacts;
  const finalPalette = palette.length > 0
    ? palette.join(", ")
    : "preto como base, cinza/prata nos elementos e branco nos pontos de contraste";

  return [
    `Crie um site para uma barbearia chamada ${businessName}. Esse site deve seguir uma paleta de cores ${finalPalette}.`,
    "",
    "**Informacoes especificas para o conteudo:**",
    ...formatPromptList(facts),
    address ? `Endereco: ${address}` : null,
    `CTA principal: ${cta}`,
    "",
    "Estetica e Layout: Quero que voce faca um site seguindo uma estetica parecida com essa: 'https://www.barbeariaspacovip.com.br/'. Este site deve ser um pouco mais moderno, com paleta de cores de algo bem gentleman. Siga a ordem das cores da paleta: primeira cor com prioridade nos fundos, segunda cor em elementos principais, e as demais em detalhes e contrastes.",
    "",
    "Diretrizes cruciais de design para este projeto:",
    "",
    "Espacamento: Garanta um respiro excelente entre as secoes (padding e margin). Os botoes nao devem ficar colados nos setores vizinhos; o design deve ser limpo e organizado.",
    "",
    "Tratamento de Imagens: Use apenas logo e fotos reais fornecidas pelo cliente ou coletadas manualmente. Nao use imagens de IA em nenhum momento. Certifique-se de que as fotos sejam exibidas por inteiro e bem enquadradas, sem cortes que prejudiquem a visualizacao.",
    "",
    "Acabamento: O site precisa sair com aspecto profissional e finalizado logo no primeiro prompt, com uma estrutura dinamica que passe luxo, mas sem ficar rigido.",
    "",
    "Na secao de galeria onde ficarao as imagens dos cortes, deixe em forma de carrossel passando as imagens automaticamente para o lado com animacao sutil e linear.",
    "",
    "Quero um site com botoes arredondados, no minimo 5 secoes, efeitos de entrada, sem imagens de IA.",
    visualNotes.length > 0 ? "" : null,
    visualNotes.length > 0 ? "**Identidade visual analisada:**" : null,
    ...formatPromptList(visualNotes),
    styleNotes.length > 0 ? "" : null,
    styleNotes.length > 0 ? "**Notas visuais analisadas:**" : null,
    ...formatPromptList(styleNotes),
    warnings.length > 0 ? "" : null,
    warnings.length > 0 ? "**Observacoes:**" : null,
    ...formatPromptList(warnings)
  ].filter((line) => line !== null).join("\n");
}

function formatPromptList(items) {
  if (!items.length) {
    return ["- Use as informacoes publicas do Instagram e confirme detalhes ausentes antes da entrega final."];
  }

  return items.map((item) => `- ${item}`);
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(String(item || ""))).filter(Boolean);
  }

  if (value) {
    return [cleanText(String(value))].filter(Boolean);
  }

  return [];
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("pt-BR") : "-";
}

function formatLastPost(profile) {
  if (Number.isFinite(Number(profile.daysSincePost))) {
    return `${Number(profile.daysSincePost)} dias atras`;
  }

  if (profile.lastNonPinnedPostAt) {
    return profile.lastNonPinnedPostAt;
  }

  return "-";
}

async function searchOwnSiteForProfile({ apiKey, profile, city, pages }) {
  const queryName = cleanBusinessName(profile.name || profile.handle);
  const query = `"${queryName}" "${city}"`;
  const results = [];
  let calls = 0;

  for (let page = 1; page <= pages; page += 1) {
    const result = await searchSerper(apiKey, {
      q: query,
      gl: "br",
      hl: "pt-br",
      num: 10,
      page
    });

    calls += 1;

    for (const item of result.organic || []) {
      const normalized = normalizeSiteResult(item, queryName);

      if (normalized) {
        results.push(normalized);
      }
    }
  }

  const ownSite = results.find((result) => result.isOwnSiteCandidate);

  return {
    handle: profile.handle,
    query,
    calls,
    hasOwnSite: Boolean(ownSite),
    ownSiteUrl: ownSite?.url || null,
    results
  };
}

function normalizeSiteResult(item, businessName) {
  if (!item.link) {
    return null;
  }

  let url;

  try {
    url = new URL(item.link);
  } catch {
    return null;
  }

  const domain = url.hostname.replace(/^www\./, "").toLowerCase();
  const rejected = isRejectedSiteDomain(domain, url.href);

  return {
    url: url.href,
    title: item.title || "",
    domain,
    rejected,
    isOwnSiteCandidate: !rejected && looksLikeOwnSite(domain, businessName)
  };
}

function isRejectedSiteDomain(domain, href) {
  return rejectedSiteDomains.some((blocked) => domain.includes(blocked) || href.includes(blocked));
}

function looksLikeOwnSite(domain, businessName) {
  const normalizedDomain = normalizeComparableText(domain);
  const nameTokens = normalizeComparableText(businessName)
    .split(" ")
    .filter((token) => token.length >= 4 && !["barbearia", "barber", "shop", "studio"].includes(token));

  if (nameTokens.length === 0) {
    return true;
  }

  return nameTokens.some((token) => normalizedDomain.includes(token));
}

function cleanBusinessName(value) {
  return String(value || "")
    .replace(/\(@.*?\)/g, "")
    .replace(/[-|].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function runApifyInstagramProfileScraper({ token, handles }) {
  const actorId = normalizeApifyActorId(process.env.APIFY_INSTAGRAM_ACTOR_ID || "apify~instagram-profile-scraper");
  const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`);
  url.searchParams.set("clean", "true");
  url.searchParams.set("format", "json");
  url.searchParams.set("timeout", "120");

  if (process.env.APIFY_MAX_TOTAL_CHARGE_USD) {
    url.searchParams.set("maxTotalChargeUsd", process.env.APIFY_MAX_TOTAL_CHARGE_USD);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      usernames: handles,
      resultsLimit: handles.length
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `Apify retornou HTTP ${response.status}`);
  }

  return Array.isArray(payload) ? payload : [];
}

function normalizeApifyProfile(item, candidateByHandle) {
  const handle = cleanInstagramHandle(item.username || item.handle || item.input);

  if (!handle) {
    return null;
  }

  const candidate = candidateByHandle.get(handle) || {};
  const followersCount = Number(item.followersCount ?? item.followers ?? 0) || 0;
  const latestPosts = Array.isArray(item.latestPosts) ? item.latestPosts : [];
  const lastPost = findLastNonPinnedPost(latestPosts);
  const lastNonPinnedPostAt = normalizeApifyDate(lastPost?.timestamp || lastPost?.takenAtTimestamp || lastPost?.date);
  const bio = item.biography || item.bio || item.description || null;
  const externalUrl = item.externalUrl || item.externalUrls?.[0]?.url || item.url || null;
  const whatsappUrl = findWhatsappUrl([externalUrl, bio].filter(Boolean));
  const profilePictureUrl = findFirstImageUrl([
    item.profilePicUrl,
    item.profilePicUrlHD,
    item.profilePictureUrl,
    item.profilePicture,
    item.avatarUrl
  ]);
  const visualImageUrls = collectApifyVisualUrls({ item, latestPosts, profilePictureUrl });
  const status = classifyInstagramProfile({ followersCount, lastNonPinnedPostAt });

  return {
    handle,
    instagramUrl: candidate.instagramUrl || candidate.url || `https://www.instagram.com/${handle}/`,
    city: candidate.city || null,
    sourceQuery: candidate.sourceQuery || null,
    displayName: item.fullName || item.name || item.title || handle,
    bio,
    followersCount,
    externalUrl,
    whatsappUrl,
    profilePictureUrl,
    visualImageUrls,
    lastNonPinnedPostAt,
    daysSincePost: calculateDaysSince(lastNonPinnedPostAt),
    status: status.value,
    notes: status.notes
  };
}

function collectApifyVisualUrls({ item, latestPosts, profilePictureUrl }) {
  const candidates = [
    profilePictureUrl,
    item.displayUrl,
    item.imageUrl,
    item.thumbnailUrl,
    item.thumbnailSrc
  ];

  for (const post of latestPosts) {
    candidates.push(
      post?.displayUrl,
      post?.imageUrl,
      post?.thumbnailUrl,
      post?.thumbnailSrc
    );

    if (Array.isArray(post?.images)) {
      for (const image of post.images) {
        candidates.push(typeof image === "string" ? image : image?.url);
      }
    }

    if (Array.isArray(post?.displayResources)) {
      for (const resource of post.displayResources) {
        candidates.push(resource?.src || resource?.url);
      }
    }
  }

  return normalizeImageUrls(candidates).slice(0, getMaxAiImagesPerPrompt());
}

function findFirstImageUrl(values) {
  return normalizeImageUrls(values)[0] || null;
}

function normalizeImageUrls(values) {
  const urls = [];
  const seen = new Set();

  for (const value of values.flatMap((item) => Array.isArray(item) ? item : [item])) {
    const url = normalizeImageUrl(value);

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

function normalizeImageUrl(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return normalizeImageUrl(value.url || value.src || value.uri);
  }

  const text = String(value).trim();

  if (!/^https?:\/\//i.test(text)) {
    return null;
  }

  if (!looksLikeDirectImageUrl(text)) {
    return null;
  }

  return text;
}

function looksLikeDirectImageUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  const imageHosts = [
    "cdninstagram.com",
    "fbcdn.net",
    "scontent",
    "cdn",
    "images"
  ];

  if (/\.(?:jpg|jpeg|png|webp|gif)(?:$|[?#])/i.test(value)) {
    return true;
  }

  return imageHosts.some((part) => host.includes(part)) &&
    !["instagram.com", "www.instagram.com"].includes(host) &&
    !pathname.includes("/p/");
}

function findLastNonPinnedPost(posts) {
  return posts.find((post) => post?.isPinned !== true) || null;
}

function classifyInstagramProfile({ followersCount, lastNonPinnedPostAt }) {
  const minFollowers = Number(process.env.MIN_INSTAGRAM_FOLLOWERS || 500);
  const maxFollowers = Number(process.env.MAX_INSTAGRAM_FOLLOWERS || 8000);
  const recentDays = Number(process.env.RECENT_POST_DAYS || 90);

  if (followersCount < minFollowers) {
    return { value: "discarded_low_followers", notes: `Menos de ${minFollowers} seguidores.` };
  }

  if (followersCount > maxFollowers) {
    return { value: "discarded_high_followers", notes: `Mais de ${maxFollowers} seguidores.` };
  }

  if (!lastNonPinnedPostAt) {
    return { value: "manual_review", notes: "Nao foi possivel identificar ultimo post nao fixado." };
  }

  const lastPostDate = new Date(lastNonPinnedPostAt);
  const ageMs = Date.now() - lastPostDate.getTime();
  const ageDays = Math.floor(ageMs / 86400000);

  if (Number.isNaN(ageDays) || ageDays > recentDays) {
    return { value: "discarded_no_recent_post", notes: `Ultimo post nao fixado acima de ${recentDays} dias.` };
  }

  return { value: "instagram_qualified", notes: "Perfil aprovado pela validacao inicial da Apify." };
}

function findWhatsappUrl(values) {
  return values.find((value) => /(?:wa\.me|api\.whatsapp\.com|whatsapp)/i.test(value)) || null;
}

function normalizeApifyDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    const milliseconds = value < 10000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function calculateDaysSince(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  const ageMs = Date.now() - date.getTime();
  const ageDays = Math.floor(ageMs / 86400000);

  return Number.isNaN(ageDays) ? null : ageDays;
}

function extractInstagramCandidates(item) {
  const links = [];

  if (item.link) {
    links.push({ link: item.link, title: item.title, snippet: item.snippet });
  }

  for (const sitelink of item.sitelinks || []) {
    if (sitelink.link) {
      links.push({ link: sitelink.link, title: sitelink.title, snippet: item.snippet });
    }
  }

  return links.map(toInstagramCandidate).filter(Boolean);
}

function toInstagramCandidate(item) {
  let url;

  try {
    url = new URL(item.link);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host !== "instagram.com") {
    return null;
  }

  const segment = url.pathname.split("/").filter(Boolean)[0];

  if (!segment || invalidInstagramSegments.has(segment.toLowerCase())) {
    return null;
  }

  return {
    handle: segment.toLowerCase(),
    url: `https://www.instagram.com/${segment}/`,
    title: item.title || segment,
    snippet: item.snippet || ""
  };
}

async function serveStaticFile(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(join(publicDir, safePath));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    sendJson(response, 404, {
      error: "not_found",
      message: "Arquivo nao encontrado."
    });
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function cleanText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function cleanInstagramHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function normalizeApifyActorId(value) {
  return value.trim().replace("/", "~");
}

function isTrelloConfigured() {
  return Boolean(process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN);
}

function isAiPromptGenerationEnabled() {
  return process.env.ENABLE_AI_PROMPT_GENERATION === "true";
}

function getProfileVisualUrls(profile) {
  const urls = [
    profile.profilePictureUrl,
    ...(Array.isArray(profile.visualImageUrls) ? profile.visualImageUrls : [])
  ];

  return normalizeImageUrls(urls).slice(0, getMaxAiImagesPerPrompt());
}

function getMaxAiImagesPerPrompt() {
  return clamp(Number(process.env.MAX_AI_IMAGES_PER_PROMPT || 4), 0, 8);
}

function getPublicAppUrl() {
  const value = process.env.PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readJsonBody(request) {
  if (request.body) {
    if (typeof request.body === "string") {
      return JSON.parse(request.body);
    }

    return request.body;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

async function loadEnvFile() {
  const envPath = join(rootDir, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = await readFile(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
