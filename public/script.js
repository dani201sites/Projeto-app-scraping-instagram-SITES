const form = document.querySelector("#searchForm");
const cityInput = document.querySelector("#cityInput");
const limitInput = document.querySelector("#limitInput");
const keywordInput = document.querySelector("#keywordInput");
const dryRunInput = document.querySelector("#dryRunInput");
const twoPagesInput = document.querySelector("#twoPagesInput");
const startButton = document.querySelector("#startButton");
const clearButton = document.querySelector("#clearButton");
const resultsBody = document.querySelector("#resultsBody");
const activityList = document.querySelector("#activityList");
const queueCount = document.querySelector("#queueCount");
const runState = document.querySelector("#runState");
const dailyLimit = document.querySelector("#dailyLimit");
const progressLabel = document.querySelector("#progressLabel");
const progressPercent = document.querySelector("#progressPercent");
const progressBar = document.querySelector("#progressBar");
const foundMetric = document.querySelector("#foundMetric");
const approvedMetric = document.querySelector("#approvedMetric");
const trelloMetric = document.querySelector("#trelloMetric");
const callsMetric = document.querySelector("#callsMetric");
const neonStatus = document.querySelector("#neonStatus");
const apifyStatus = document.querySelector("#apifyStatus");
const trelloStatus = document.querySelector("#trelloStatus");
const aiStatus = document.querySelector("#aiStatus");
const trelloBoardSelect = document.querySelector("#trelloBoardSelect");
const trelloListSelect = document.querySelector("#trelloListSelect");
const trelloSetupStatus = document.querySelector("#trelloSetupStatus");
const refreshTrelloButton = document.querySelector("#refreshTrelloButton");

const sampleNames = [
  "Barbearia Navalha Prime",
  "Jonas Barberbox",
  "Studio Corte Fino",
  "Barbearia Avenida",
  "Dom Barbeiro",
  "Corte 88",
  "Barber Club Centro",
  "Barbearia Vila Forte",
  "Alfa Barber Shop",
  "Seu Jorge Barber",
  "Barbearia Estacao",
  "Mestre do Corte",
  "Barber House Sul",
  "Barbearia Linha Reta",
  "Studio Barba e Corte",
  "Classic Barber",
  "Barbearia Ponto X",
  "New Style Barber",
  "Barbearia Machado",
  "Arena Barber",
  "Barbearia Norte",
  "Oficina do Barbeiro",
  "Banca do Corte",
  "Barbearia Imperial"
];

const state = {
  found: 0,
  approved: 0,
  trello: 0,
  calls: 0,
  daily: 0,
  running: false
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHandle(name, city) {
  return `${name} ${city}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
}

function makeProfiles(city, limit, serperProfiles = []) {
  if (serperProfiles.length > 0) {
    return serperProfiles.slice(0, limit).map((profile) => ({
      name: profile.title?.replace(/\s*\|.*$/, "") || profile.handle,
      city,
      handle: profile.handle,
      instagramUrl: profile.url,
      followers: null,
      daysSincePost: null,
      hasOwnSite: null,
      apifyStatus: "pending",
      source: "serper"
    }));
  }

  const available = Math.min(limit, sampleNames.length);

  return sampleNames.slice(0, available).map((name, index) => {
    const simulated = makeSimulatedStats(index);

    return {
      name,
      city,
      handle: normalizeHandle(name, city),
      instagramUrl: `https://instagram.com/${normalizeHandle(name, city)}`,
      followers: simulated.followers,
      daysSincePost: simulated.daysSincePost,
      hasOwnSite: simulated.hasOwnSite,
      source: "sample"
    };
  });
}

function mergeApifyProfiles(profiles, apifyProfiles = []) {
  const apifyByHandle = new Map(apifyProfiles.map((profile) => [profile.handle, profile]));

  return profiles.map((profile) => {
    const apifyProfile = apifyByHandle.get(profile.handle);

    if (!apifyProfile) {
      return profile;
    }

    return {
      ...profile,
      name: apifyProfile.displayName || profile.name,
      bio: apifyProfile.bio,
      followers: apifyProfile.followersCount,
      daysSincePost: apifyProfile.daysSincePost,
      lastNonPinnedPostAt: apifyProfile.lastNonPinnedPostAt,
      externalUrl: apifyProfile.externalUrl,
      whatsappUrl: apifyProfile.whatsappUrl,
      apifyStatus: apifyProfile.status,
      apifyNotes: apifyProfile.notes
    };
  });
}

function makeSimulatedStats(index) {
  return {
    followers: [742, 1280, 421, 6120, 9340, 2270, 7990, 530, 3150, 1640, 890, 4520, 7700, 710, 1040, 6840, 480, 2550, 5810, 915, 1440, 3770, 6900, 810][index % 24],
    daysSincePost: [12, 31, 8, 86, 18, 121, 64, 23, 4, 77, 93, 15, 58, 41, 135, 28, 10, 68, 82, 6, 112, 38, 54, 17][index % 24],
    hasOwnSite: [false, false, false, true, false, false, false, false, true, false, false, true, false, false, false, false, false, false, true, false, false, false, false, true][index % 24]
  };
}

async function fetchSerperProfiles(city, keyword, limit) {
  const params = new URLSearchParams({
    city,
    keyword,
    limit: String(limit),
    dryRun: String(dryRunInput.checked)
  });
  const response = await fetch(`/api/serper/instagram-profiles?${params}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Nao foi possivel consultar o Serper.");
  }

  return payload;
}

async function validateProfilesWithApify(runId, profiles) {
  const response = await fetch("/api/apify/instagram-profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      runId,
      profiles: profiles.map((profile) => ({
        handle: profile.handle,
        instagramUrl: profile.instagramUrl,
        name: profile.name,
        city: profile.city,
        sourceQuery: `${keywordInput.value.trim()} em ${cityInput.value.trim()} site:instagram.com`
      }))
    })
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Nao foi possivel validar perfis na Apify.");
  }

  return payload;
}

async function searchOwnSites(runId, city, profiles, pages) {
  const qualifiedProfiles = profiles.filter((profile) => profile.apifyStatus === "instagram_qualified");

  if (qualifiedProfiles.length === 0) {
    return { searched: 0, calls: 0, outcomes: [] };
  }

  const response = await fetch("/api/serper/site-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      runId,
      city,
      pages,
      profiles: qualifiedProfiles
    })
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Nao foi possivel buscar site proprio.");
  }

  return payload;
}

function mergeSiteOutcomes(profiles, outcomes = []) {
  const outcomeByHandle = new Map(outcomes.map((outcome) => [outcome.handle, outcome]));

  return profiles.map((profile) => {
    const outcome = outcomeByHandle.get(profile.handle);

    if (!outcome) {
      return profile;
    }

    return {
      ...profile,
      siteStatus: outcome.hasOwnSite ? "found" : "not_found",
      ownSiteUrl: outcome.ownSiteUrl
    };
  });
}

async function createTrelloCards(runId, city, profiles, dryRun) {
  const leadsWithoutSite = profiles.filter((profile) => (
    profile.apifyStatus === "instagram_qualified" && profile.siteStatus === "not_found"
  ));

  if (leadsWithoutSite.length === 0) {
    return { created: 0, cards: [] };
  }

  const response = await fetch("/api/trello/cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      runId,
      city,
      dryRun,
      profiles: leadsWithoutSite
    })
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Nao foi possivel criar cards no Trello.");
  }

  return payload;
}

function mergeTrelloCards(profiles, cards = []) {
  const cardByHandle = new Map(cards.map((card) => [card.handle, card]));

  return profiles.map((profile) => {
    const card = cardByHandle.get(profile.handle);

    if (!card) {
      return profile;
    }

    return {
      ...profile,
      trelloCardUrl: card.url,
      trelloCardName: card.name,
      trelloDryRun: Boolean(card.dryRun)
    };
  });
}

function getLeadStatus(profile, dryRun) {
  if (profile.source === "serper" && profile.apifyStatus === "pending") {
    return { label: "Aguardando Apify", type: "warn", approved: false, trello: false, site: "Pendente" };
  }

  if (profile.apifyStatus === "manual_review") {
    return { label: "Revisao manual", type: "warn", approved: false, trello: false, site: "Pendente" };
  }

  if (profile.apifyStatus === "discarded_low_followers") {
    return { label: "Seguidores baixos", type: "stop", approved: false, trello: false, site: "Pendente" };
  }

  if (profile.apifyStatus === "discarded_high_followers") {
    return { label: "Seguidores altos", type: "stop", approved: false, trello: false, site: "Pendente" };
  }

  if (profile.apifyStatus === "discarded_no_recent_post") {
    return { label: "Sem post recente", type: "warn", approved: false, trello: false, site: "Pendente" };
  }

  if (profile.apifyStatus === "instagram_qualified") {
    if (profile.siteStatus === "found") {
      return { label: "Tem site proprio", type: "warn", approved: false, trello: false, site: "Encontrado" };
    }

    if (profile.siteStatus === "not_found") {
      if (profile.trelloCardUrl) {
        return { label: "Enviado Trello", type: "ok", approved: true, trello: true, site: "Nao encontrado" };
      }

      return { label: dryRun ? "Lead sem site" : "Trello pendente", type: "ok", approved: true, trello: false, site: "Nao encontrado" };
    }

    return { label: "Instagram qualificado", type: "ok", approved: true, trello: false, site: "Pendente" };
  }

  if (profile.followers < 500) {
    return { label: "Seguidores baixos", type: "stop", approved: false, trello: false, site: "Nao verificado" };
  }

  if (profile.followers > 8000) {
    return { label: "Seguidores altos", type: "stop", approved: false, trello: false, site: "Nao verificado" };
  }

  if (profile.daysSincePost > 90) {
    return { label: "Sem post recente", type: "warn", approved: false, trello: false, site: "Nao verificado" };
  }

  if (profile.hasOwnSite) {
    return { label: "Tem site proprio", type: "warn", approved: true, trello: false, site: "Encontrado" };
  }

  return {
    label: dryRun ? "Lead qualificado" : "Enviado Trello",
    type: "ok",
    approved: true,
    trello: true,
    site: "Nao encontrado"
  };
}

function setProgress(done, total, label) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  progressLabel.textContent = label;
  progressPercent.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function updateMetrics() {
  foundMetric.textContent = state.found;
  approvedMetric.textContent = state.approved;
  trelloMetric.textContent = state.trello;
  callsMetric.textContent = state.calls;
  dailyLimit.textContent = `${state.daily}/30 hoje`;
}

function resetRun() {
  state.found = 0;
  state.approved = 0;
  state.trello = 0;
  state.calls = 0;
  updateMetrics();
  setProgress(0, 1, "Aguardando inicio");
  runState.textContent = "Pronto";
  resultsBody.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhuma pesquisa executada.</td></tr>';
  activityList.innerHTML = "<li>Aguardando nova pesquisa.</li>";
  queueCount.textContent = "0 itens";
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();

    if (health.databaseConnected) {
      neonStatus.classList.add("ready");
      neonStatus.querySelector("strong").textContent = "Conectado";
    }

    if (!health.databaseConnected) {
      neonStatus.classList.remove("ready");
      neonStatus.querySelector("strong").textContent = health.neonConfigured ? "Sem conexao" : "Pendente";
    }

    apifyStatus.textContent = health.apifyConfigured ? "Token configurado" : "Pendente";

    if (health.trelloConfigured) {
      trelloStatus.classList.add("ready");
      trelloStatus.querySelector("strong").textContent = health.trelloTargetConfigured ? "Destino definido" : "Token configurado";
    } else {
      trelloStatus.classList.remove("ready");
      trelloStatus.querySelector("strong").textContent = "Pendente";
    }

    if (health.openRouterConfigured && health.aiPromptGenerationEnabled) {
      aiStatus.classList.add("ready");
      aiStatus.querySelector("strong").textContent = "Prompt ativo";
    } else if (health.openRouterConfigured) {
      aiStatus.classList.remove("ready");
      aiStatus.querySelector("strong").textContent = "Token configurado";
    } else {
      aiStatus.classList.remove("ready");
      aiStatus.querySelector("strong").textContent = "Pendente";
    }
  } catch {
    neonStatus.classList.remove("ready");
    trelloStatus.classList.remove("ready");
    aiStatus.classList.remove("ready");
    neonStatus.querySelector("strong").textContent = "Indisponivel";
    apifyStatus.textContent = "Indisponivel";
    trelloStatus.querySelector("strong").textContent = "Indisponivel";
    aiStatus.querySelector("strong").textContent = "Indisponivel";
  }
}

async function refreshDatabaseSummary() {
  try {
    const response = await fetch("/api/database/summary");
    const summary = await response.json();

    if (!summary.configured) {
      return;
    }

    neonStatus.classList.add("ready");
    neonStatus.querySelector("strong").textContent = `${summary.runs} exec. / ${summary.profiles} perfis`;
  } catch {
    // Health already covers the visible connection state.
  }
}

async function refreshTrelloBoards() {
  trelloBoardSelect.innerHTML = '<option value="">Carregando boards</option>';
  trelloListSelect.innerHTML = '<option value="">Escolha um board primeiro</option>';
  trelloSetupStatus.textContent = "Consultando boards da sua conta Trello.";
  refreshTrelloButton.disabled = true;

  try {
    const response = await fetch("/api/trello/boards");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Nao foi possivel carregar os boards.");
    }

    fillSelect({
      select: trelloBoardSelect,
      items: payload.boards,
      selectedId: payload.selectedBoardId,
      emptyText: "Escolha um board"
    });

    if (payload.boards.length === 0) {
      trelloSetupStatus.textContent = "Nenhum board aberto encontrado nessa conta Trello.";
      return;
    }

    const selectedBoardId = trelloBoardSelect.value || payload.boards[0].id;
    trelloBoardSelect.value = selectedBoardId;
    await refreshTrelloLists(selectedBoardId);
  } catch (error) {
    trelloBoardSelect.innerHTML = '<option value="">Trello pendente</option>';
    trelloListSelect.innerHTML = '<option value="">Trello pendente</option>';
    trelloSetupStatus.textContent = error.message;
  } finally {
    refreshTrelloButton.disabled = false;
  }
}

async function refreshTrelloLists(boardId) {
  if (!boardId) {
    trelloListSelect.innerHTML = '<option value="">Escolha um board primeiro</option>';
    trelloSetupStatus.textContent = "Escolha um board para carregar as listas.";
    return;
  }

  trelloListSelect.innerHTML = '<option value="">Carregando listas</option>';
  trelloSetupStatus.textContent = "Consultando listas abertas do board selecionado.";

  try {
    const response = await fetch(`/api/trello/lists?boardId=${encodeURIComponent(boardId)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Nao foi possivel carregar as listas.");
    }

    fillSelect({
      select: trelloListSelect,
      items: payload.lists,
      selectedId: payload.selectedListId,
      emptyText: "Escolha uma lista"
    });

    if (payload.lists.length === 0) {
      trelloSetupStatus.textContent = "Nenhuma lista aberta encontrada nesse board.";
      return;
    }

    updateTrelloEnvHint();
  } catch (error) {
    trelloListSelect.innerHTML = '<option value="">Erro ao carregar listas</option>';
    trelloSetupStatus.textContent = error.message;
  }
}

function fillSelect({ select, items, selectedId, emptyText }) {
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = emptyText;
  select.append(placeholder);

  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.append(option);
  }

  if (selectedId && items.some((item) => item.id === selectedId)) {
    select.value = selectedId;
    return;
  }

  if (items.length > 0) {
    select.value = items[0].id;
  }
}

function updateTrelloEnvHint() {
  const boardId = trelloBoardSelect.value;
  const listId = trelloListSelect.value;
  const boardName = trelloBoardSelect.selectedOptions[0]?.textContent || "";
  const listName = trelloListSelect.selectedOptions[0]?.textContent || "";

  if (!boardId || !listId) {
    trelloSetupStatus.textContent = "Escolha um board e uma lista para gerar os IDs.";
    return;
  }

  trelloSetupStatus.textContent = `Selecionado: ${boardName} > ${listName}. No .env: TRELLO_BOARD_ID=${boardId} e TRELLO_LIST_ID=${listId}`;
}

function addActivity(text) {
  if (activityList.children.length === 1 && activityList.textContent.includes("Aguardando")) {
    activityList.innerHTML = "";
  }

  const item = document.createElement("li");
  item.textContent = text;
  activityList.prepend(item);
}

function addResult(profile, status) {
  if (resultsBody.querySelector(".empty-row")) {
    resultsBody.innerHTML = "";
  }

  const followers = Number.isFinite(profile.followers) ? profile.followers.toLocaleString("pt-BR") : "-";
  const lastPost = Number.isFinite(profile.daysSincePost) ? `${profile.daysSincePost} dias` : "-";
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><a class="profile-link" href="${profile.instagramUrl}" target="_blank" rel="noreferrer">@${profile.handle}</a></td>
    <td>${followers}</td>
    <td>${lastPost}</td>
    <td>${status.site}</td>
    <td><span class="status ${status.type}">${status.label}</span></td>
  `;
  resultsBody.append(row);
}

async function runScraping(event) {
  event.preventDefault();

  if (state.running) {
    return;
  }

  const city = cityInput.value.trim();
  const keyword = keywordInput.value.trim();
  const requestedLimit = Number(limitInput.value);
  const maxLimit = Math.min(Math.max(requestedLimit, 1), 30);
  const dryRun = dryRunInput.checked;
  const googlePages = twoPagesInput.checked ? 2 : 1;
  let profiles = [];

  state.running = true;
  state.found = 0;
  state.approved = 0;
  state.trello = 0;
  state.calls = 1;

  startButton.disabled = true;
  startButton.innerHTML = '<span aria-hidden="true">■</span> Executando';
  runState.textContent = "Rodando";
  resultsBody.innerHTML = "";
  activityList.innerHTML = "";
  queueCount.textContent = "Carregando";
  updateMetrics();
  setProgress(0, 1, `Buscando ${keyword} em ${city}`);
  addActivity(`Serper: ${keyword} em ${city} site:instagram.com`);

  await wait(450);

  try {
    const serperResult = await fetchSerperProfiles(city, keyword, maxLimit);
    profiles = makeProfiles(city, maxLimit, serperResult.profiles);
    state.calls = serperResult.calls;
    addActivity(`Serper: ${profiles.length} perfis reais encontrados`);
    addActivity(serperResult.persisted ? `Neon: execucao #${serperResult.runId} salva, candidatos ainda fora do banco` : "Neon: DATABASE_URL nao configurado");

    try {
      const apifyResult = await validateProfilesWithApify(serperResult.runId, profiles);
      profiles = mergeApifyProfiles(profiles, apifyResult.profiles);
      addActivity(`Apify: ${apifyResult.returned} perfis enriquecidos`);
      addActivity(`Neon: ${apifyResult.savedQualified} perfis qualificados salvos`);

      try {
        const siteResult = await searchOwnSites(serperResult.runId, city, profiles, googlePages);
        profiles = mergeSiteOutcomes(profiles, siteResult.outcomes);
        state.calls += siteResult.calls;
        addActivity(`Serper: site proprio verificado em ${siteResult.searched} perfis`);

        try {
          const trelloResult = await createTrelloCards(serperResult.runId, city, profiles, dryRun);
          profiles = mergeTrelloCards(profiles, trelloResult.cards);

          if (dryRun) {
            addActivity(`Dry run: ${trelloResult.cards.length} cards seriam criados no Trello`);
          } else {
            addActivity(`Trello: ${trelloResult.created} cards criados`);
          }
        } catch (error) {
          addActivity(`Trello pendente: ${error.message}`);
        }
      } catch (error) {
        addActivity(`Site pendente: ${error.message}`);
      }
    } catch (error) {
      addActivity(`Apify pendente: ${error.message}`);
    }
  } catch (error) {
    profiles = makeProfiles(city, maxLimit);
    addActivity(`Modo simulado: ${error.message}`);
  }

  queueCount.textContent = `${profiles.length} itens`;
  updateMetrics();

  for (const [index, profile] of profiles.entries()) {
    const current = index + 1;
    setProgress(index, profiles.length, `Analisando @${profile.handle}`);
    addActivity(`Apify: verificando @${profile.handle}`);
    state.found += 1;
    state.calls += 1;
    updateMetrics();

    await wait(260);

    const status = getLeadStatus(profile, dryRun);

    if (status.approved) {
      state.approved += 1;
      addActivity(`Instagram: @${profile.handle} passou nos filtros`);
    }

    if (status.trello) {
      state.trello += dryRun ? 0 : 1;
      addActivity(dryRun ? `Dry run: lead qualificado ${profile.name}` : `Trello: card criado para ${profile.name}`);
    }

    state.daily = Math.min(30, state.daily + 1);
    addResult(profile, status);
    updateMetrics();
    setProgress(current, profiles.length, `Processados ${current} de ${profiles.length}`);

    await wait(220);
  }

  await refreshDatabaseSummary();

  if (profiles.length < requestedLimit) {
    addActivity(`Pesquisa encerrada: ${profiles.length} perfis diferentes encontrados.`);
  }

  runState.textContent = "Concluido";
  setProgress(profiles.length, profiles.length, "Pesquisa concluida");
  startButton.disabled = false;
  startButton.innerHTML = '<span aria-hidden="true">▶</span> Iniciar scraping';
  state.running = false;
}

form.addEventListener("submit", runScraping);
clearButton.addEventListener("click", resetRun);
refreshTrelloButton.addEventListener("click", refreshTrelloBoards);
trelloBoardSelect.addEventListener("change", () => refreshTrelloLists(trelloBoardSelect.value));
trelloListSelect.addEventListener("change", updateTrelloEnvHint);
limitInput.addEventListener("input", () => {
  const value = Number(limitInput.value);
  if (value > 30) {
    limitInput.value = 30;
  }
});

resetRun();
refreshHealth();
refreshDatabaseSummary();
refreshTrelloBoards();
