-- Map free-text legacy specialty values to catalog ids in clinic_members.
-- Only update rows where the current value clearly maps to a known catalog id.
UPDATE public.clinic_members
SET specialty = CASE
  WHEN lower(trim(specialty)) IN ('cardiologia', 'cardiologista') THEN 'cardiologia'
  WHEN lower(trim(specialty)) IN ('clinico geral', 'clínico geral', 'clinica geral', 'clínica geral') THEN 'clinico-geral'
  WHEN lower(trim(specialty)) IN ('dentista', 'odontologia') THEN 'dentista'
  WHEN lower(trim(specialty)) IN ('ortodontia', 'ortodontista') THEN 'dentista'
  WHEN lower(trim(specialty)) IN ('pediatria', 'pediatra') THEN 'pediatra'
  WHEN lower(trim(specialty)) IN ('ginecologia', 'ginecologista') THEN 'ginecologista'
  WHEN lower(trim(specialty)) IN ('dermatologia', 'dermatologista') THEN 'dermatologia'
  WHEN lower(trim(specialty)) IN ('neurologia', 'neurologista') THEN 'neurologia'
  WHEN lower(trim(specialty)) IN ('psiquiatria', 'psiquiatra') THEN 'psiquiatria'
  WHEN lower(trim(specialty)) IN ('psicologia', 'psicologo', 'psicóloga', 'psicólogo') THEN 'psicologia'
  WHEN lower(trim(specialty)) IN ('ortopedia', 'ortopedista') THEN 'ortopedia-geral'
  WHEN lower(trim(specialty)) IN ('endocrinologia', 'endocrinologista') THEN 'endocrinologia'
  WHEN lower(trim(specialty)) IN ('urologia', 'urologista') THEN 'urologia'
  WHEN lower(trim(specialty)) IN ('oftalmologia', 'oftalmologista') THEN 'oftalmologia'
  WHEN lower(trim(specialty)) IN ('otorrinolaringologia', 'otorrino') THEN 'otorrinolaringologia'
  WHEN lower(trim(specialty)) IN ('nutricao', 'nutrição', 'nutricionista') THEN 'nutricao'
  WHEN lower(trim(specialty)) IN ('fisioterapia', 'fisioterapeuta') THEN 'fisioterapia'
  WHEN lower(trim(specialty)) IN ('fonoaudiologia', 'fonoaudiologo', 'fonoaudióloga', 'fonoaudiólogo') THEN 'fonoaudiologia'
  WHEN lower(trim(specialty)) IN ('estetica', 'estética') THEN 'estetica'
  ELSE specialty
END
WHERE specialty IS NOT NULL
  AND specialty <> ''
  AND lower(trim(specialty)) IN (
    'cardiologia','cardiologista',
    'clinico geral','clínico geral','clinica geral','clínica geral',
    'dentista','odontologia',
    'ortodontia','ortodontista',
    'pediatria','pediatra',
    'ginecologia','ginecologista',
    'dermatologia','dermatologista',
    'neurologia','neurologista',
    'psiquiatria','psiquiatra',
    'psicologia','psicologo','psicóloga','psicólogo',
    'ortopedia','ortopedista',
    'endocrinologia','endocrinologista',
    'urologia','urologista',
    'oftalmologia','oftalmologista',
    'otorrinolaringologia','otorrino',
    'nutricao','nutrição','nutricionista',
    'fisioterapia','fisioterapeuta',
    'fonoaudiologia','fonoaudiologo','fonoaudióloga','fonoaudiólogo',
    'estetica','estética'
  );

-- Same mapping for pending invites
UPDATE public.clinic_invites
SET specialty = CASE
  WHEN lower(trim(specialty)) IN ('cardiologia', 'cardiologista') THEN 'cardiologia'
  WHEN lower(trim(specialty)) IN ('clinico geral', 'clínico geral', 'clinica geral', 'clínica geral') THEN 'clinico-geral'
  WHEN lower(trim(specialty)) IN ('dentista', 'odontologia') THEN 'dentista'
  WHEN lower(trim(specialty)) IN ('pediatria', 'pediatra') THEN 'pediatra'
  WHEN lower(trim(specialty)) IN ('ginecologia', 'ginecologista') THEN 'ginecologista'
  WHEN lower(trim(specialty)) IN ('dermatologia', 'dermatologista') THEN 'dermatologia'
  WHEN lower(trim(specialty)) IN ('neurologia', 'neurologista') THEN 'neurologia'
  WHEN lower(trim(specialty)) IN ('psiquiatria', 'psiquiatra') THEN 'psiquiatria'
  WHEN lower(trim(specialty)) IN ('psicologia', 'psicologo', 'psicóloga', 'psicólogo') THEN 'psicologia'
  WHEN lower(trim(specialty)) IN ('ortopedia', 'ortopedista') THEN 'ortopedia-geral'
  WHEN lower(trim(specialty)) IN ('endocrinologia', 'endocrinologista') THEN 'endocrinologia'
  WHEN lower(trim(specialty)) IN ('urologia', 'urologista') THEN 'urologia'
  WHEN lower(trim(specialty)) IN ('oftalmologia', 'oftalmologista') THEN 'oftalmologia'
  WHEN lower(trim(specialty)) IN ('otorrinolaringologia', 'otorrino') THEN 'otorrinolaringologia'
  WHEN lower(trim(specialty)) IN ('nutricao', 'nutrição', 'nutricionista') THEN 'nutricao'
  WHEN lower(trim(specialty)) IN ('fisioterapia', 'fisioterapeuta') THEN 'fisioterapia'
  WHEN lower(trim(specialty)) IN ('fonoaudiologia', 'fonoaudiologo', 'fonoaudióloga', 'fonoaudiólogo') THEN 'fonoaudiologia'
  WHEN lower(trim(specialty)) IN ('estetica', 'estética') THEN 'estetica'
  ELSE specialty
END
WHERE specialty IS NOT NULL AND specialty <> '';