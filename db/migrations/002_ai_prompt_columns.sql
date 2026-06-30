alter table lead_results
  add column if not exists website_prompt text,
  add column if not exists ai_analysis jsonb,
  add column if not exists ai_model text,
  add column if not exists prompt_generated_at timestamptz;

