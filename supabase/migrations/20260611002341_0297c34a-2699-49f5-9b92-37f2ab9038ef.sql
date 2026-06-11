UPDATE public.clinics SET city = 'São Paulo' WHERE city IS NOT NULL AND lower(btrim(translate(city,'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'))) = 'sao paulo';
UPDATE public.patients SET city = 'São Paulo' WHERE city IS NOT NULL AND lower(btrim(translate(city,'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'))) = 'sao paulo';
UPDATE public.profiles SET city = 'São Paulo' WHERE city IS NOT NULL AND lower(btrim(translate(city,'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'))) = 'sao paulo';
-- also trim trailing whitespace on all city values to prevent future duplicates
UPDATE public.clinics  SET city = btrim(city) WHERE city IS NOT NULL AND city <> btrim(city);
UPDATE public.patients SET city = btrim(city) WHERE city IS NOT NULL AND city <> btrim(city);
UPDATE public.profiles SET city = btrim(city) WHERE city IS NOT NULL AND city <> btrim(city);