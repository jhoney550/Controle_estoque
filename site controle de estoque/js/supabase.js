try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );
  } else {
    console.warn('Supabase não carregou. Sistema seguirá usando localStorage.');
  }
} catch (e) {
  console.error('Erro ao iniciar Supabase:', e);
}
