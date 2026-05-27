/**
 * Script para criar a conta do Super Admin da plataforma IACLIN.
 * Execute com: node scripts/create-platform-admin.mjs
 */

const SUPABASE_URL = 'https://fwyulywxhjyxdreeuqna.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3eXVseXd4aGp5eGRyZWV1cW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NzY4NjIsImV4cCI6MjA5MTU1Mjg2Mn0.x5-aEcALt7GdRp0Mx-dtW1uVIheOT22an8rUjis-vkI';

const ADMIN_EMAIL    = 'iaclin@gmail.com';
const ADMIN_PASSWORD = 'iaclin@gmail.com';

async function supabaseRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  console.log('\n🔐 Criando conta do Super Admin IACLIN...\n');

  // 1. Tenta criar a conta via signUp
  const signup = await supabaseRequest('/signup', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    data: { full_name: 'Super Admin IACLIN' },
  });

  if (signup.status === 200 || signup.status === 201) {
    const user = signup.data.user ?? signup.data;
    console.log('✅ Conta criada com sucesso!');
    if (user?.id) console.log('   User ID:', user.id);
  } else if (
    signup.data?.msg?.includes('already registered') ||
    signup.data?.message?.includes('already registered') ||
    signup.data?.error_description?.includes('already registered')
  ) {
    console.log('ℹ️  Conta já existia no Supabase.');
  } else {
    console.log('Resposta signup:', signup.status, JSON.stringify(signup.data));
  }

  // 2. Tenta fazer login para verificar
  console.log('\n🔑 Testando login...');
  const login = await supabaseRequest('/token?grant_type=password', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (login.status === 200 && login.data.access_token) {
    console.log('✅ LOGIN FUNCIONANDO!');
    console.log('\n🚀 Pronto! Acesse o app e faça login com:');
    console.log('   E-mail: iaclin@gmail.com');
    console.log('   Senha:  iaclin@gmail.com');
  } else {
    console.log('Status:', login.status);
    console.log('Resposta:', JSON.stringify(login.data, null, 2));

    if (login.data?.error === 'email_not_confirmed') {
      console.log('\n⚠️  E-mail precisa ser confirmado.');
      console.log('   Acesse o painel Supabase e confirme manualmente:');
      console.log('   → https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna/auth/users');
      console.log('   → Encontre iaclin@gmail.com → clique nos 3 pontinhos → "Send confirmation email"');
      console.log('\n   OU desative confirmação de e-mail:');
      console.log('   → Authentication → Providers → Email → desmarque "Confirm email"');
    } else {
      console.log('\n❌ Erro inesperado. Verifique o painel Supabase.');
    }
  }
}

main().catch(console.error);
