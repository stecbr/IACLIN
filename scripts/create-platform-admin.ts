/**
 * Script para criar a conta do Super Admin da plataforma IACLIN.
 * Execute com: bun run scripts/create-platform-admin.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fwyulywxhjyxdreeuqna.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3eXVseXd4aGp5eGRyZWV1cW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NzY4NjIsImV4cCI6MjA5MTU1Mjg2Mn0.x5-aEcALt7GdRp0Mx-dtW1uVIheOT22an8rUjis-vkI';

const ADMIN_EMAIL    = 'iaclin@gmail.com';
const ADMIN_PASSWORD = 'iaclin@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('\n🔐 Criando conta do Super Admin IACLIN...\n');

  // 1. Tenta criar a conta
  const { data, error } = await supabase.auth.signUp({
    email:    ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    options: {
      data: { full_name: 'Super Admin IACLIN' },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already been registered')) {
      console.log('ℹ️  Conta já existe no Supabase. Tentando login...');
    } else {
      console.error('❌ Erro ao criar conta:', error.message);
      process.exit(1);
    }
  } else if (data.user) {
    console.log('✅ Conta criada com sucesso!');
    console.log('   User ID:', data.user.id);

    if (!data.user.email_confirmed_at && !data.session) {
      console.log('\n⚠️  Confirmação de e-mail pode ser necessária.');
      console.log('   Acesse o painel do Supabase para confirmar ou desativar:');
      console.log('   → https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna');
      console.log('   → Authentication → Users → confirme manualmente o e-mail\n');
    }
  }

  // 2. Tenta logar para verificar se está tudo OK
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email:    ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (loginError) {
    console.error('\n❌ Login falhou:', loginError.message);
    console.log('\n👉 Ação necessária:');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna');
    console.log('   2. Vá em Authentication → Users');
    console.log('   3. Encontre iaclin@gmail.com e clique em "Confirm user" ou "Send confirmation email"');
    console.log('   4. OU vá em Authentication → Settings → Email → desative "Enable email confirmations"');
  } else {
    console.log('\n✅ Login funcionando! Conta pronta para uso.');
    console.log('   E-mail:', loginData.user?.email);
    console.log('   ID:    ', loginData.user?.id);
    console.log('\n🚀 Agora acesse localhost e faça login com:');
    console.log('   E-mail: iaclin@gmail.com');
    console.log('   Senha:  iaclin@gmail.com');
    await supabase.auth.signOut();
  }
}

main().catch(console.error);
