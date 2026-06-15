// ===========================================================
// DATABASE
// ===========================================================

const SUPABASE_URL = 'https://hfusmrnvblrzezllvlec.supabase.co';

const SUPABASE_KEY = 'sb_publishable_anWXUvGCVbF821Co8VQsLQ_PujwsaUn';

let supabaseClient = null;

const ESTRUTURAS_SQL = `-- ===========================================================
-- 15/06/2026 - PDV: cancelamento de vendas
-- Execute no SQL Editor do Supabase.
-- ===========================================================

alter table public.vendas
  add column if not exists cancelada boolean not null default false,
  add column if not exists cancelado_em timestamp without time zone,
  add column if not exists cancelado_por text,
  add column if not exists cancel_obs text;

comment on column public.vendas.cancelada is 'Indica se a venda foi cancelada sem excluir o histórico.';
comment on column public.vendas.cancelado_em is 'Data e hora local do cancelamento da venda.';
comment on column public.vendas.cancelado_por is 'Usuário administrador que autorizou o cancelamento.';
comment on column public.vendas.cancel_obs is 'Motivo informado para o cancelamento da venda.';
`;
