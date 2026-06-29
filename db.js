import { neon } from "@neondatabase/serverless";

let client;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function pingDatabase() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const rows = await getClient()`select 1 as ok`;
  return rows[0]?.ok === 1;
}

export async function createScrapingRun({ city, keyword, requestedLimit, dryRun }) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const rows = await getClient()`
    insert into scraping_runs (city, keyword, requested_limit, status, dry_run)
    values (${city}, ${keyword}, ${requestedLimit}, 'running', ${dryRun})
    returning id
  `;

  return rows[0]?.id || null;
}

export async function finishScrapingRun({ runId, status, serperCalls }) {
  if (!isDatabaseConfigured() || !runId) {
    return;
  }

  await getClient()`
    update scraping_runs
    set status = ${status},
        serper_calls = ${serperCalls},
        finished_at = now()
    where id = ${runId}
  `;
}

export async function saveInstagramProfiles({ runId, city, sourceQuery, profiles }) {
  if (!isDatabaseConfigured() || profiles.length === 0) {
    return [];
  }

  const savedProfiles = [];

  for (const profile of profiles) {
    const rows = await getClient()`
      insert into instagram_profiles (handle, instagram_url, display_name, city, source_query, updated_at)
      values (${profile.handle}, ${profile.url}, ${profile.title}, ${city}, ${sourceQuery}, now())
      on conflict (handle) do update
      set instagram_url = excluded.instagram_url,
          display_name = excluded.display_name,
          city = excluded.city,
          source_query = excluded.source_query,
          updated_at = now()
      returning id, handle
    `;

    const saved = rows[0];
    savedProfiles.push(saved);

    if (runId && saved?.id) {
      await getClient()`
        insert into lead_results (run_id, profile_id, status, notes)
        values (${runId}, ${saved.id}, 'found_instagram', 'Perfil encontrado pelo Serper')
        on conflict (run_id, profile_id) do nothing
      `;
    }
  }

  return savedProfiles;
}

export async function saveQualifiedInstagramProfile({ runId, profile }) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (profile.status !== "instagram_qualified") {
    return null;
  }

  const rows = await getClient()`
    insert into instagram_profiles (
      handle,
      instagram_url,
      display_name,
      city,
      source_query,
      followers_count,
      external_url,
      whatsapp_url,
      last_non_pinned_post_at,
      last_checked_at,
      updated_at
    )
    values (
      ${profile.handle},
      ${profile.instagramUrl},
      ${profile.displayName},
      ${profile.city},
      ${profile.sourceQuery},
      ${profile.followersCount},
      ${profile.externalUrl},
      ${profile.whatsappUrl},
      ${profile.lastNonPinnedPostAt},
      now(),
      now()
    )
    on conflict (handle) do update
    set instagram_url = excluded.instagram_url,
        display_name = excluded.display_name,
        city = excluded.city,
        source_query = excluded.source_query,
        followers_count = excluded.followers_count,
        external_url = excluded.external_url,
        whatsapp_url = excluded.whatsapp_url,
        last_non_pinned_post_at = excluded.last_non_pinned_post_at,
        last_checked_at = now(),
        updated_at = now()
    returning id
  `;

  const profileId = rows[0]?.id || null;

  if (runId && profileId) {
    await getClient()`
      insert into lead_results (run_id, profile_id, status, notes)
      values (${runId}, ${profileId}, ${profile.status}, ${profile.notes})
      on conflict (run_id, profile_id) do update
      set status = excluded.status,
          notes = excluded.notes
    `;
  }

  return profileId;
}

export async function saveSiteSearchOutcome({ runId, profile, outcome }) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const profileRows = await getClient()`
    select id
    from instagram_profiles
    where handle = ${profile.handle}
    limit 1
  `;
  const profileId = profileRows[0]?.id || null;

  if (!profileId) {
    return null;
  }

  for (const result of outcome.results || []) {
    await getClient()`
      insert into site_search_results (
        profile_id,
        query,
        result_url,
        result_title,
        result_domain,
        is_rejected_domain,
        is_own_site_candidate
      )
      values (
        ${profileId},
        ${outcome.query},
        ${result.url},
        ${result.title},
        ${result.domain},
        ${result.rejected},
        ${result.isOwnSiteCandidate}
      )
    `;
  }

  if (runId) {
    await getClient()`
      update lead_results
      set status = ${outcome.hasOwnSite ? "discarded_has_own_site" : "qualified_no_site"},
          has_own_site = ${outcome.hasOwnSite},
          own_site_url = ${outcome.ownSiteUrl},
          notes = ${outcome.hasOwnSite ? "Site proprio encontrado pelo Serper." : "Nao foi encontrado site proprio nas paginas analisadas."}
      where run_id = ${runId}
        and profile_id = ${profileId}
    `;
  }

  return profileId;
}

export async function saveTrelloCardCreated({ runId, handle, cardUrl }) {
  if (!isDatabaseConfigured() || !runId || !handle || !cardUrl) {
    return null;
  }

  const profileRows = await getClient()`
    select id
    from instagram_profiles
    where handle = ${handle}
    limit 1
  `;
  const profileId = profileRows[0]?.id || null;

  if (!profileId) {
    return null;
  }

  await getClient()`
    update lead_results
    set status = 'sent_trello',
        trello_card_url = ${cardUrl},
        notes = 'Card criado no Trello.'
    where run_id = ${runId}
      and profile_id = ${profileId}
  `;

  await getClient()`
    update scraping_runs
    set trello_cards_created = trello_cards_created + 1
    where id = ${runId}
  `;

  return profileId;
}

export async function getDatabaseSummary() {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      runs: 0,
      profiles: 0,
      leads: 0
    };
  }

  const rows = await getClient()`
    select
      (select count(*)::int from scraping_runs) as runs,
      (select count(*)::int from instagram_profiles) as profiles,
      (select count(*)::int from lead_results) as leads
  `;

  return {
    configured: true,
    runs: rows[0]?.runs || 0,
    profiles: rows[0]?.profiles || 0,
    leads: rows[0]?.leads || 0
  };
}

function getClient() {
  if (!client) {
    client = neon(process.env.DATABASE_URL);
  }

  return client;
}
