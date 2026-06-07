require('./load-env');
const sql = `
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS test_a TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS test_b TEXT;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS test_c TEXT;
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS test_a;
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS test_b;
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS test_c;
`;
(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/rvjsnkolroaakskvvwnv/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  console.log(r.status, await r.text());
})();
