-- Alguns nomes vindos do dataset da ANS têm espaços duplicados/sobrando
-- (ex.: "UNIMED  FLORIANO"), o que fazia buscas por substring simples
-- (ex.: "UNIMED FLORIANO") não encontrarem a operadora, dando a falsa
-- impressão de que ela tinha sumido do catálogo.

UPDATE public.insurance_operators
SET name = btrim(regexp_replace(name, '\s+', ' ', 'g'))
WHERE name ~ '\s{2,}' OR name <> btrim(name);

UPDATE public.insurance_operators
SET legal_name = btrim(regexp_replace(legal_name, '\s+', ' ', 'g'))
WHERE legal_name IS NOT NULL AND (legal_name ~ '\s{2,}' OR legal_name <> btrim(legal_name));
