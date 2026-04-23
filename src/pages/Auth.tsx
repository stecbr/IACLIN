import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, FileHeart, Building2, Briefcase, UserCheck, ArrowLeft, ChevronRight, Lock, Eye, EyeOff, Search, Loader2, Mail } from 'lucide-react';
import { formatCpf, isValidCpf, unmaskCpf } from '@/lib/cpf';
import logoLight from '@/assets/logo-light.png';
import { SpecialtySelect } from '@/components/SpecialtySelect';

type UserType = null | 'profissional' | 'operadora' | 'cliente' | 'clinica';
type ProfessionalSubType = null | 'medico' | 'dentista';

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const item = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export default function Auth() {
  const { user, loading, isPatient } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const inviteToken = searchParams.get('invite');

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [profSubType, setProfSubType] = useState<ProfessionalSubType>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Professional fields (specialty / registration)
  const [specialty, setSpecialty] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  // Invite info loaded from token
  const [inviteInfo, setInviteInfo] = useState<{ clinic_name: string; email: string; full_name: string | null } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Clinic-specific fields
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fetchingCnpj, setFetchingCnpj] = useState(false);

  // Load invite when token is in URL
  useEffect(() => {
    if (!inviteToken) return;
    setInviteLoading(true);
    (async () => {
      const { data: invite } = await supabase
        .from('clinic_invites')
        .select('email, full_name, status, expires_at, clinic_id')
        .eq('token', inviteToken)
        .maybeSingle();
      if (!invite) {
        setInviteError('Convite inválido ou expirado');
        setInviteLoading(false);
        return;
      }
      if (invite.status !== 'pending') {
        setInviteError('Este convite já foi usado ou revogado');
        setInviteLoading(false);
        return;
      }
      if (new Date(invite.expires_at) < new Date()) {
        setInviteError('Este convite expirou');
        setInviteLoading(false);
        return;
      }
      const { data: clinic } = await supabase.from('clinics').select('name').eq('id', invite.clinic_id).maybeSingle();
      setInviteInfo({ clinic_name: clinic?.name ?? 'clínica', email: invite.email, full_name: invite.full_name });
      setIsLogin(false);
      setUserType('profissional');
      setProfSubType('dentista');
      setEmail(invite.email);
      if (invite.full_name) setFullName(invite.full_name);
      setInviteLoading(false);
    })();
  }, [inviteToken]);

  const fetchCnpjData = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos');
      return;
    }
    setFetchingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const data = await res.json();
      if (data.razao_social) setLegalName(data.razao_social);
      if (data.nome_fantasia) setTradeName(data.nome_fantasia);
      else if (data.razao_social && !tradeName) setTradeName(data.razao_social);
      if (data.ddd_telefone_1 && !phone) {
        setPhone(`(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}`);
      }
      toast.success('Dados preenchidos automaticamente!');
    } catch {
      toast.error('Não foi possível buscar o CNPJ.');
    } finally {
      setFetchingCnpj(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
        />
      </div>
    );
  }

  if (user) {
    // If user is logged in and there's an invite token, accept it then redirect
    if (inviteToken) {
      supabase.functions.invoke('accept-clinic-invite', { body: { token: inviteToken } }).then(({ error }) => {
        if (error) toast.error(error.message);
        else toast.success('Você foi vinculado à clínica!');
      });
    }
    if (returnUrl) return <Navigate to={returnUrl} replace />;
    if (isPatient) return <Navigate to="/paciente" replace />;
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Login realizado com sucesso!');
      } else {
        // Validate patient-specific fields
        if (userType === 'cliente') {
          if (!isValidCpf(cpf)) {
            toast.error('CPF inválido');
            setSubmitting(false);
            return;
          }
        }

        // Validate professional-specific fields (always requires clinic link)
        const CODE_REGEX = /^CLIN-[A-Z2-9]{8}$/;
        if (userType === 'profissional') {
          if (!specialty.trim()) {
            toast.error('Selecione sua especialidade');
            setSubmitting(false);
            return;
          }
        }
        if (userType === 'profissional' && !inviteToken) {
          const trimmed = clinicCode.trim().toUpperCase();
          if (!CODE_REGEX.test(trimmed)) {
            setClinicCodeError('Código inválido. Use CLIN-XXXXXXXX.');
            toast.error('Informe um código de clínica válido');
            setSubmitting(false);
            return;
          }
          // Validate code exists before creating account
          const { data: validation, error: valErr } = await supabase.functions.invoke('validate-clinic-code', {
            body: { code: trimmed },
          });
          if (valErr || !validation?.valid) {
            const msg = validation?.error || 'Código não encontrado. Peça à clínica para gerar um novo.';
            setClinicCodeError(msg);
            toast.error(msg);
            setSubmitting(false);
            return;
          }
          setClinicCodeError(null);
        }

        // Validate clinic-specific fields
        if (userType === 'clinica') {
          if (cnpj.replace(/\D/g, '').length !== 14) {
            toast.error('CNPJ deve ter 14 dígitos');
            setSubmitting(false);
            return;
          }
          if (!legalName.trim() || !tradeName.trim() || !responsibleName.trim() || !phone.trim()) {
            toast.error('Preencha todos os campos obrigatórios');
            setSubmitting(false);
            return;
          }
          if (password !== confirmPassword) {
            toast.error('As senhas não coincidem');
            setSubmitting(false);
            return;
          }
        }

        const clinicCategory = profSubType === 'dentista' ? 'odonto' : profSubType === 'medico' ? 'medico' : 'outro';
        // If joining via invite token or clinic code, mark user as a member-only signup (no auto-admin/clinic)
        const isJoiningExistingClinic = !!inviteToken || (userType === 'profissional' && clinicCode.trim().length > 0);
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: userType === 'clinica' ? responsibleName : fullName,
              user_type: isJoiningExistingClinic ? 'profissional_member' : userType,
              professional_subtype: profSubType,
              clinic_category: clinicCategory,
              ...(userType === 'profissional' && {
                specialty: specialty.trim() || null,
                registration_number: registrationNumber.trim() || null,
              }),
              ...(userType === 'cliente' && {
                cpf: unmaskCpf(cpf),
                phone,
                insurance_provider: insuranceProvider || null,
                insurance_number: insuranceNumber || null,
              }),
              ...(userType === 'clinica' && {
                legal_name: legalName.trim(),
                trade_name: tradeName.trim(),
                cnpj: cnpj.replace(/\D/g, ''),
                corporate_email: email.trim(),
                phone: phone.trim(),
                responsible_name: responsibleName.trim(),
              }),
            },
          },
        });
        if (error) throw error;
        toast.success('Conta criada! Verifique seu e-mail para confirmar.');

        // After signup: if joining via invite or code, link the membership
        if (signUpData.session) {
          if (inviteToken) {
            const { error: acceptErr } = await supabase.functions.invoke('accept-clinic-invite', { body: { token: inviteToken } });
            if (acceptErr) toast.error('Conta criada, mas falhou ao vincular à clínica: ' + acceptErr.message);
            else toast.success('Você foi vinculado à clínica!');
          } else if (userType === 'profissional' && clinicCode.trim()) {
            const { error: joinErr } = await supabase.functions.invoke('join-clinic-by-code', {
              body: {
                code: clinicCode.trim().toUpperCase(),
                specialty: specialty.trim() || null,
                registration_number: registrationNumber.trim() || null,
              },
            });
            if (joinErr) {
              toast.error('Conta criada, mas falhou ao vincular: ' + joinErr.message);
              navigate('/aguardando-clinica', { replace: true });
            } else {
              toast.success('Vínculo criado com a clínica!');
            }
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const signupReady =
    userType !== null &&
    (userType !== 'profissional' || profSubType !== null);

  // Determine current step key for AnimatePresence
  const stepKey = isLogin
    ? 'login'
    : userType === null
      ? 'type-select'
      : userType === 'profissional' && profSubType === null
        ? 'prof-select'
        : 'signup-form';

  const typeCards = [
    { key: 'profissional' as const, icon: Stethoscope, label: 'Profissional de Saúde', desc: 'Médico, Dentista ou outro', locked: false },
    { key: 'clinica' as const, icon: Building2, label: 'Sou uma Clínica', desc: 'Cadastre sua clínica e equipe', locked: false },
    { key: 'operadora' as const, icon: Briefcase, label: 'Operadora', desc: 'Operadora de saúde ou convênio', locked: true },
    { key: 'cliente' as const, icon: UserCheck, label: 'Paciente', desc: 'Buscar profissionais e agendar', locked: false },
  ];

  const profSubCards = [
    { key: 'medico' as const, icon: Stethoscope, label: 'Médico', desc: 'Clínica médica geral ou especializada' },
    { key: 'dentista' as const, icon: FileHeart, label: 'Dentista', desc: 'Clínica odontológica' },
  ];

  const isPatientSignup = userType === 'cliente';
  const isClinicSignup = userType === 'clinica';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <img src={logoLight} alt="IACLIN" className="h-10" />
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ─── LOGIN ─── */}
          {stepKey === 'login' && (
            <motion.div key="login" {...fade}>
              <div className="text-center mb-6">
                <motion.h1
                  className="text-xl font-semibold tracking-tight text-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  Bem-vindo de volta
                </motion.h1>
                <motion.p
                  className="mt-1 text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Acesse sua conta
                </motion.p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="h-10" autoFocus />
                </motion.div>
                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.25 }}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <button type="button" className="text-xs text-primary hover:underline">Esqueci minha senha</button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10 pr-10" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>
                <motion.div variants={item} initial="initial" animate="animate" transition={{ delay: 0.3 }}>
                  <Button type="submit" className="w-full h-10" disabled={submitting}>
                    {submitting ? 'Aguarde...' : 'Entrar'}
                  </Button>
                </motion.div>
              </form>

              <motion.div className="mt-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                <button type="button" onClick={() => { setIsLogin(false); setUserType(null); setProfSubType(null); }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Não tem conta? Cadastre-se
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── TYPE SELECT ─── */}
          {stepKey === 'type-select' && (
            <motion.div key="type-select" {...fade}>
              <div className="text-center mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Crie sua conta</h1>
                <p className="mt-1 text-sm text-muted-foreground">Como você vai usar o IACLIN?</p>
              </div>

              <motion.div className="space-y-3" variants={stagger} initial="initial" animate="animate">
                {typeCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <motion.button
                      key={card.key}
                      variants={item}
                      type="button"
                      onClick={() => !card.locked && setUserType(card.key)}
                      disabled={card.locked}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card transition-all duration-200 text-left ${card.locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40 hover:shadow-sm active:scale-[0.98]'}`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                      </div>
                      {card.locked ? (
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Em breve</span>
                        </div>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>

              <motion.div className="mt-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <button type="button" onClick={() => setIsLogin(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Já tem conta? Entrar
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── PROFESSIONAL SUB-SELECT ─── */}
          {stepKey === 'prof-select' && (
            <motion.div key="prof-select" {...fade}>
              <button type="button" onClick={() => setUserType(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <div className="text-center mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Qual sua especialidade?</h1>
              </div>

              <motion.div className="space-y-3" variants={stagger} initial="initial" animate="animate">
                {profSubCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <motion.button
                      key={card.key}
                      variants={item}
                      type="button"
                      onClick={() => setProfSubType(card.key)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card transition-all duration-200 text-left hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ─── SIGNUP FORM ─── */}
          {stepKey === 'signup-form' && signupReady && (
            <motion.div key="signup-form" {...fade}>
              <button
                type="button"
                onClick={() => {
                  if (userType === 'profissional' && profSubType) setProfSubType(null);
                  else setUserType(null);
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>

              <div className="text-center mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Crie sua conta</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {userType === 'profissional'
                    ? profSubType === 'dentista' ? '🦷 Dentista' : '🩺 Médico'
                    : userType === 'clinica' ? '🏥 Clínica'
                    : userType === 'operadora' ? '🏢 Operadora' : '👤 Paciente'}
                </p>
              </div>

              {inviteInfo && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <Mail className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-foreground">Convite de {inviteInfo.clinic_name}</p>
                    <p className="text-muted-foreground mt-0.5">Crie sua conta para começar a atender nesta clínica.</p>
                  </div>
                </div>
              )}
              {inviteError && (
                <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {inviteError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isClinicSignup && (
                  <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder={userType === 'profissional' ? 'Dr. João Silva' : userType === 'operadora' ? 'Nome da empresa' : 'Seu nome completo'}
                      required className="h-10" autoFocus
                    />
                  </motion.div>
                )}

                {isClinicSignup && (
                  <>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.08 }}>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <div className="flex gap-2">
                        <Input
                          id="cnpj" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                          placeholder="00.000.000/0000-00" required className="h-10" inputMode="numeric" autoFocus
                        />
                        <Button type="button" variant="outline" size="icon" onClick={fetchCnpjData} disabled={fetchingCnpj} className="h-10 w-10 flex-shrink-0">
                          {fetchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
                      <Label htmlFor="legal-name">Razão Social</Label>
                      <Input id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Clínica X LTDA" required className="h-10" />
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.12 }}>
                      <Label htmlFor="trade-name">Nome Fantasia</Label>
                      <Input id="trade-name" value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Clínica X" required className="h-10" />
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.14 }}>
                      <Label htmlFor="responsible">Nome do Responsável</Label>
                      <Input id="responsible" value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Administrador da clínica" required className="h-10" />
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.16 }}>
                      <Label htmlFor="clinic-phone">Telefone / WhatsApp</Label>
                      <Input id="clinic-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" required className="h-10" inputMode="tel" />
                    </motion.div>
                  </>
                )}

                {isPatientSignup && (
                  <>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.12 }}>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00" required className="h-10" inputMode="numeric"
                      />
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.14 }}>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999" className="h-10" inputMode="tel"
                      />
                    </motion.div>
                  </>
                )}

                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.15 }}>
                  <Label htmlFor="signup-email">{isClinicSignup ? 'E-mail Corporativo' : 'E-mail'}</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isPatientSignup ? 'seu@email.com' : isClinicSignup ? 'contato@clinica.com' : 'joao@clinica.com'} required className="h-10" />
                </motion.div>
                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input id="signup-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10 pr-10" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>

                {isClinicSignup && (
                  <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.21 }}>
                    <Label htmlFor="confirm-password">Confirmar Senha</Label>
                    <Input id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10" />
                  </motion.div>
                )}

                {isPatientSignup && (
                  <>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.22 }}>
                      <Label htmlFor="insurance-provider" className="text-xs text-muted-foreground">Convênio (opcional)</Label>
                      <Input
                        id="insurance-provider" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)}
                        placeholder="Ex: Amil, Unimed..." className="h-10"
                      />
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.24 }}>
                      <Label htmlFor="insurance-number" className="text-xs text-muted-foreground">Nº carteirinha (opcional)</Label>
                      <Input
                        id="insurance-number" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)}
                        placeholder="000000000000" className="h-10"
                      />
                    </motion.div>
                  </>
                )}

                {userType === 'profissional' && (
                  <>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.21 }}>
                      <Label htmlFor="specialty">Especialidade <span className="text-destructive">*</span></Label>
                      <SpecialtySelect
                        id="specialty"
                        value={specialty}
                        onChange={setSpecialty}
                        filterCategory={profSubType === 'dentista' ? 'odonto' : 'medico'}
                        placeholder="Selecione sua especialidade"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Você só aparecerá nas buscas dos pacientes para a especialidade escolhida.
                      </p>
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.22 }}>
                      <Label htmlFor="registration" className="text-xs text-muted-foreground">
                        {profSubType === 'dentista' ? 'CRO' : 'CRM'} (opcional)
                      </Label>
                      <Input
                        id="registration"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                        placeholder={profSubType === 'dentista' ? 'Ex: CRO-SP 12345' : 'Ex: CRM-SP 12345'}
                        className="h-10"
                      />
                    </motion.div>

                    {!inviteToken && (
                      <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.23 }}>
                        <Label htmlFor="clinic-code">Código da clínica</Label>
                        <Input
                          id="clinic-code"
                          value={clinicCode}
                          onChange={(e) => {
                            setClinicCodeError(null);
                            setClinicCode(e.target.value.toUpperCase());
                          }}
                          placeholder="CLIN-XXXXXXXX"
                          required
                          maxLength={13}
                          className={`h-10 font-mono tracking-wider ${clinicCodeError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        {clinicCodeError ? (
                          <p className="text-[11px] text-destructive">{clinicCodeError}</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Cole o código que você recebeu da clínica para entrar na equipe.</p>
                        )}
                      </motion.div>
                    )}
                  </>
                )}

                <motion.div variants={item} initial="initial" animate="animate" transition={{ delay: 0.28 }}>
                  <Button type="submit" className="w-full h-10" disabled={submitting}>
                    {submitting ? 'Aguarde...' : 'Criar conta'}
                  </Button>
                </motion.div>
              </form>

              <motion.div className="mt-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <button type="button" onClick={() => setIsLogin(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Já tem conta? Entrar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
