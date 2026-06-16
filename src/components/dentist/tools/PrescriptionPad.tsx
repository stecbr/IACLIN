import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, FileDown, MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DEFAULT_PRESCRIPTION_TEMPLATES, findTemplate, type PrescriptionItem } from '@/lib/prescriptionTemplates';
import { generatePrescriptionPdf } from '@/lib/generatePrescriptionPdf';
import { fetchClinicForDocs, fetchDentistForDocs, whatsappLink } from '@/lib/clinicalDocsHelpers';
import { cn } from '@/lib/utils';

// ── Lista de medicamentos ───────────────────────────────────────────────────
const MEDICATION_SUGGESTIONS = [
  // Analgésicos / Antitérmicos
  'Dipirona 500mg comprimido',
  'Dipirona 500mg/mL solução oral (gotas)',
  'Dipirona 1g comprimido',
  'Paracetamol 500mg comprimido',
  'Paracetamol 750mg comprimido',
  'Paracetamol 1g comprimido',
  'Paracetamol 200mg/mL solução oral (gotas)',
  'Paracetamol + Codeína 500mg/30mg comprimido',
  'Tramadol 50mg cápsula',
  'Tramadol 100mg comprimido de liberação prolongada',
  'Codeína 30mg comprimido',
  'Morfina 10mg comprimido',

  // Anti-inflamatórios (AINEs)
  'Ibuprofeno 400mg comprimido',
  'Ibuprofeno 600mg comprimido',
  'Ibuprofeno 50mg/mL suspensão oral',
  'Nimesulida 100mg comprimido',
  'Nimesulida 50mg/mL suspensão oral',
  'Diclofenaco sódico 50mg comprimido',
  'Diclofenaco potássico 50mg comprimido',
  'Diclofenaco + Misoprostol 50mg comprimido',
  'Naproxeno 250mg comprimido',
  'Naproxeno 500mg comprimido',
  'Celecoxibe 100mg cápsula',
  'Celecoxibe 200mg cápsula',
  'Etoricoxibe 60mg comprimido',
  'Etoricoxibe 90mg comprimido',
  'Etoricoxibe 120mg comprimido',
  'Meloxicam 7,5mg comprimido',
  'Meloxicam 15mg comprimido',
  'Piroxicam 20mg comprimido',
  'Tenoxicam 20mg comprimido',
  'Ketoprofeno 100mg comprimido',
  'Indometacina 25mg cápsula',
  'Ácido acetilsalicílico 500mg comprimido',
  'Ácido acetilsalicílico 100mg comprimido (antiagregante)',

  // Corticoides
  'Prednisona 5mg comprimido',
  'Prednisona 20mg comprimido',
  'Prednisolona 20mg comprimido',
  'Prednisolona 3mg/mL solução oral',
  'Dexametasona 4mg comprimido',
  'Dexametasona 4mg/mL solução injetável',
  'Betametasona 0,5mg comprimido',
  'Metilprednisolona 4mg comprimido',
  'Metilprednisolona 500mg pó para injeção',
  'Deflazacorte 6mg comprimido',
  'Hidrocortisona 20mg comprimido',

  // Antibióticos — Penicilinas
  'Amoxicilina 500mg cápsula',
  'Amoxicilina 875mg comprimido',
  'Amoxicilina 250mg/5mL suspensão oral',
  'Amoxicilina + Clavulanato 875mg/125mg comprimido',
  'Amoxicilina + Clavulanato 400mg/57mg suspensão oral',
  'Ampicilina 500mg cápsula',
  'Fenoximetilpenicilina 250mg/5mL suspensão oral',

  // Antibióticos — Macrolídeos / Azalídeos
  'Azitromicina 500mg comprimido',
  'Azitromicina 900mg/15mL suspensão oral',
  'Claritromicina 250mg comprimido',
  'Claritromicina 500mg comprimido',
  'Eritromicina 500mg comprimido',

  // Antibióticos — Cefalosporinas
  'Cefalexina 500mg cápsula',
  'Cefalexina 250mg/5mL suspensão oral',
  'Cefadroxila 500mg cápsula',
  'Cefuroxima 250mg comprimido',
  'Cefuroxima 500mg comprimido',
  'Ceftriaxona 1g pó para injeção',

  // Antibióticos — Fluoroquinolonas
  'Ciprofloxacino 500mg comprimido',
  'Ciprofloxacino 250mg comprimido',
  'Levofloxacino 500mg comprimido',
  'Levofloxacino 750mg comprimido',
  'Norfloxacino 400mg comprimido',
  'Moxifloxacino 400mg comprimido',

  // Antibióticos — Outros
  'Metronidazol 250mg comprimido',
  'Metronidazol 400mg comprimido',
  'Metronidazol 500mg comprimido',
  'Clindamicina 300mg cápsula',
  'Clindamicina 600mg cápsula',
  'Doxiciclina 100mg comprimido',
  'Tetraciclina 500mg cápsula',
  'Nitrofurantoína 100mg cápsula',
  'Sulfametoxazol + Trimetoprima 800mg/160mg comprimido',
  'Rifampicina 300mg cápsula',
  'Isoniazida 100mg comprimido',

  // Antifúngicos
  'Fluconazol 150mg cápsula',
  'Fluconazol 50mg cápsula',
  'Itraconazol 100mg cápsula',
  'Cetoconazol 200mg comprimido',
  'Nistatina 100.000 UI/mL suspensão oral',
  'Terbinafina 250mg comprimido',

  // Antiparasitários / Antiprotozoários
  'Albendazol 400mg comprimido',
  'Mebendazol 100mg comprimido',
  'Ivermectina 6mg comprimido',
  'Secnidazol 1g comprimido',
  'Tinidazol 500mg comprimido',
  'Cloroquina 150mg comprimido',
  'Praziquantel 600mg comprimido',

  // Anti-histamínicos / Antialérgicos
  'Loratadina 10mg comprimido',
  'Cetirizina 10mg comprimido',
  'Fexofenadina 120mg comprimido',
  'Fexofenadina 180mg comprimido',
  'Desloratadina 5mg comprimido',
  'Levocetirizina 5mg comprimido',
  'Hidroxizina 25mg comprimido',
  'Hidroxizina 10mg/5mL xarope',
  'Prometazina 25mg comprimido',
  'Loratadina + Pseudoefedrina 5mg/120mg comprimido',

  // Antihipertensivos — IECA
  'Enalapril 5mg comprimido',
  'Enalapril 10mg comprimido',
  'Enalapril 20mg comprimido',
  'Captopril 25mg comprimido',
  'Captopril 50mg comprimido',
  'Ramipril 5mg comprimido',
  'Ramipril 10mg comprimido',
  'Lisinopril 5mg comprimido',
  'Lisinopril 10mg comprimido',

  // Antihipertensivos — BRA
  'Losartana potássica 25mg comprimido',
  'Losartana potássica 50mg comprimido',
  'Losartana potássica 100mg comprimido',
  'Valsartana 80mg comprimido',
  'Valsartana 160mg comprimido',
  'Olmesartana 20mg comprimido',
  'Olmesartana 40mg comprimido',
  'Telmisartana 40mg comprimido',
  'Telmisartana 80mg comprimido',
  'Irbesartana 150mg comprimido',

  // Antihipertensivos — Bloqueadores de canal de cálcio
  'Anlodipino 5mg comprimido',
  'Anlodipino 10mg comprimido',
  'Nifedipino 30mg comprimido de liberação prolongada',
  'Felodipino 5mg comprimido',
  'Diltiazem 60mg comprimido',

  // Antihipertensivos — Betabloqueadores
  'Atenolol 25mg comprimido',
  'Atenolol 50mg comprimido',
  'Atenolol 100mg comprimido',
  'Metoprolol 25mg comprimido',
  'Metoprolol 50mg comprimido',
  'Metoprolol 100mg comprimido',
  'Carvedilol 3,125mg comprimido',
  'Carvedilol 6,25mg comprimido',
  'Carvedilol 12,5mg comprimido',
  'Carvedilol 25mg comprimido',
  'Propranolol 10mg comprimido',
  'Propranolol 40mg comprimido',
  'Bisoprolol 2,5mg comprimido',
  'Bisoprolol 5mg comprimido',
  'Bisoprolol 10mg comprimido',
  'Nebivolol 5mg comprimido',

  // Antihipertensivos — Diuréticos
  'Hidroclorotiazida 25mg comprimido',
  'Furosemida 40mg comprimido',
  'Furosemida 20mg/2mL solução injetável',
  'Espironolactona 25mg comprimido',
  'Espironolactona 50mg comprimido',
  'Espironolactona 100mg comprimido',
  'Clortalidona 25mg comprimido',
  'Indapamida 1,5mg comprimido',

  // Cardio — Lipídeos
  'Atorvastatina 10mg comprimido',
  'Atorvastatina 20mg comprimido',
  'Atorvastatina 40mg comprimido',
  'Atorvastatina 80mg comprimido',
  'Sinvastatina 10mg comprimido',
  'Sinvastatina 20mg comprimido',
  'Sinvastatina 40mg comprimido',
  'Rosuvastatina 5mg comprimido',
  'Rosuvastatina 10mg comprimido',
  'Rosuvastatina 20mg comprimido',
  'Rosuvastatina 40mg comprimido',
  'Ezetimiba 10mg comprimido',
  'Bezafibrato 400mg comprimido',
  'Fenofibrato 160mg comprimido',

  // Cardio — Antiagregantes / Anticoagulantes
  'Clopidogrel 75mg comprimido',
  'Ticagrelor 90mg comprimido',
  'Varfarina 5mg comprimido',
  'Rivaroxabana 10mg comprimido',
  'Rivaroxabana 20mg comprimido',
  'Apixabana 5mg comprimido',
  'Dabigatrana 110mg cápsula',
  'Dabigatrana 150mg cápsula',
  'Enoxaparina 40mg/0,4mL solução injetável',

  // Cardio — Outros
  'Digoxina 0,25mg comprimido',
  'Amiodarona 200mg comprimido',
  'Nitroglicerina 0,4mg sublingual (spray)',
  'Isossorbida dinitrato 5mg sublingual',
  'Ivabradina 5mg comprimido',
  'Sacubitril + Valsartana 49mg/51mg comprimido',
  'Dapagliflozina 10mg comprimido (IC)',

  // Diabetes / Endocrinologia
  'Metformina 500mg comprimido',
  'Metformina 850mg comprimido',
  'Metformina 1g comprimido',
  'Metformina XR 500mg comprimido',
  'Metformina XR 1g comprimido',
  'Glibenclamida 5mg comprimido',
  'Gliclazida 30mg comprimido',
  'Gliclazida MR 60mg comprimido',
  'Glimepirida 1mg comprimido',
  'Glimepirida 2mg comprimido',
  'Glimepirida 4mg comprimido',
  'Sitagliptina 100mg comprimido',
  'Vildagliptina 50mg comprimido',
  'Saxagliptina 5mg comprimido',
  'Dapagliflozina 10mg comprimido',
  'Empagliflozina 10mg comprimido',
  'Empagliflozina 25mg comprimido',
  'Canagliflozina 100mg comprimido',
  'Liraglutida 1,2mg/dose solução injetável',
  'Semaglutida 0,5mg/dose solução injetável',
  'Insulina NPH 100 UI/mL suspensão injetável',
  'Insulina Regular 100 UI/mL solução injetável',
  'Insulina Glargina 100 UI/mL solução injetável',
  'Insulina Asparte 100 UI/mL solução injetável',
  'Insulina Lispro 100 UI/mL solução injetável',

  // Tireoide
  'Levotiroxina 25mcg comprimido',
  'Levotiroxina 50mcg comprimido',
  'Levotiroxina 75mcg comprimido',
  'Levotiroxina 88mcg comprimido',
  'Levotiroxina 100mcg comprimido',
  'Levotiroxina 112mcg comprimido',
  'Levotiroxina 125mcg comprimido',
  'Levotiroxina 150mcg comprimido',
  'Propiltiouracil 100mg comprimido',
  'Metimazol 5mg comprimido',
  'Metimazol 10mg comprimido',

  // Psiquiatria — Antidepressivos (ISRS)
  'Sertralina 25mg comprimido',
  'Sertralina 50mg comprimido',
  'Sertralina 100mg comprimido',
  'Fluoxetina 20mg cápsula',
  'Fluoxetina 40mg cápsula',
  'Escitalopram 10mg comprimido',
  'Escitalopram 20mg comprimido',
  'Citalopram 20mg comprimido',
  'Paroxetina 20mg comprimido',
  'Paroxetina CR 25mg comprimido',
  'Fluvoxamina 50mg comprimido',

  // Psiquiatria — Antidepressivos (ISRSN / Outros)
  'Venlafaxina 37,5mg cápsula',
  'Venlafaxina 75mg cápsula',
  'Venlafaxina XR 150mg cápsula',
  'Duloxetina 30mg cápsula',
  'Duloxetina 60mg cápsula',
  'Desvenlafaxina 50mg comprimido',
  'Bupropiona 150mg comprimido',
  'Bupropiona 300mg comprimido XL',
  'Mirtazapina 15mg comprimido',
  'Mirtazapina 30mg comprimido',
  'Trazodona 50mg comprimido',
  'Trazodona 100mg comprimido',
  'Amitriptilina 25mg comprimido',
  'Amitriptilina 75mg comprimido',
  'Nortriptilina 25mg cápsula',
  'Nortriptilina 50mg cápsula',
  'Clomipramina 25mg comprimido',
  'Imipramina 25mg comprimido',

  // Psiquiatria — Ansiolíticos / Hipnóticos
  'Clonazepam 0,25mg comprimido',
  'Clonazepam 0,5mg comprimido',
  'Clonazepam 1mg comprimido',
  'Clonazepam 2mg comprimido',
  'Diazepam 5mg comprimido',
  'Diazepam 10mg comprimido',
  'Alprazolam 0,25mg comprimido',
  'Alprazolam 0,5mg comprimido',
  'Alprazolam 1mg comprimido',
  'Bromazepam 3mg comprimido',
  'Bromazepam 6mg comprimido',
  'Lorazepam 1mg comprimido',
  'Lorazepam 2mg comprimido',
  'Zolpidem 5mg comprimido',
  'Zolpidem 10mg comprimido',
  'Zopiclona 7,5mg comprimido',
  'Buspirona 10mg comprimido',
  'Hidroxizina 25mg comprimido (ansiolítico)',

  // Psiquiatria — Antipsicóticos
  'Quetiapina 25mg comprimido',
  'Quetiapina 50mg comprimido',
  'Quetiapina 100mg comprimido',
  'Quetiapina 200mg comprimido',
  'Quetiapina XR 50mg comprimido',
  'Risperidona 1mg comprimido',
  'Risperidona 2mg comprimido',
  'Risperidona 3mg comprimido',
  'Olanzapina 5mg comprimido',
  'Olanzapina 10mg comprimido',
  'Aripiprazol 10mg comprimido',
  'Aripiprazol 15mg comprimido',
  'Clozapina 100mg comprimido',
  'Haloperidol 1mg comprimido',
  'Haloperidol 5mg comprimido',
  'Haloperidol decanoato 50mg/mL solução injetável',
  'Ziprasidona 40mg cápsula',
  'Ziprasidona 80mg cápsula',
  'Paliperidona 3mg comprimido',
  'Paliperidona 6mg comprimido',

  // Neurologia — Antiepilépticos / Estabilizadores de humor
  'Carbamazepina 200mg comprimido',
  'Carbamazepina CR 400mg comprimido',
  'Ácido valproico 250mg comprimido',
  'Ácido valproico 500mg comprimido',
  'Ácido valproico CR 500mg comprimido',
  'Valproato de sódio 500mg comprimido',
  'Lítio 300mg comprimido',
  'Lamotrigina 25mg comprimido',
  'Lamotrigina 50mg comprimido',
  'Lamotrigina 100mg comprimido',
  'Topiramato 25mg comprimido',
  'Topiramato 50mg comprimido',
  'Topiramato 100mg comprimido',
  'Levetiracetam 250mg comprimido',
  'Levetiracetam 500mg comprimido',
  'Levetiracetam 1g comprimido',
  'Oxcarbazepina 300mg comprimido',
  'Oxcarbazepina 600mg comprimido',
  'Fenitoína 100mg comprimido',
  'Gabapentina 100mg cápsula',
  'Gabapentina 300mg cápsula',
  'Gabapentina 400mg cápsula',
  'Pregabalina 75mg cápsula',
  'Pregabalina 150mg cápsula',
  'Pregabalina 300mg cápsula',

  // Neurologia — Antimigrânosos
  'Sumatriptana 50mg comprimido',
  'Sumatriptana 100mg comprimido',
  'Rizatriptana 10mg comprimido',
  'Naratriptana 2,5mg comprimido',
  'Zolmitriptana 2,5mg comprimido',
  'Ergotamina + Cafeína comprimido',
  'Propranolol 40mg comprimido (profilaxia)',
  'Topiramato 25mg comprimido (profilaxia)',
  'Amitriptilina 25mg comprimido (profilaxia)',
  'Flunarizina 5mg comprimido',
  'Valproato de sódio 500mg comprimido (profilaxia)',

  // Neurologia — Parkinson / TDAH
  'Levodopa + Carbidopa 250mg/25mg comprimido',
  'Levodopa + Benserazida 200mg/50mg comprimido',
  'Pramipexol 0,125mg comprimido',
  'Pramipexol 0,5mg comprimido',
  'Metilfenidato 10mg comprimido',
  'Metilfenidato LA 20mg cápsula',
  'Metilfenidato LA 30mg cápsula',
  'Lisdexanfetamina 20mg cápsula',
  'Lisdexanfetamina 30mg cápsula',
  'Atomoxetina 18mg cápsula',
  'Atomoxetina 40mg cápsula',

  // Gastroenterologia
  'Omeprazol 20mg cápsula',
  'Omeprazol 40mg cápsula',
  'Pantoprazol 20mg comprimido',
  'Pantoprazol 40mg comprimido',
  'Lansoprazol 15mg cápsula',
  'Lansoprazol 30mg cápsula',
  'Esomeprazol 20mg comprimido',
  'Esomeprazol 40mg comprimido',
  'Rabeprazol 20mg comprimido',
  'Metoclopramida 10mg comprimido',
  'Metoclopramida 4mg/mL solução oral',
  'Domperidona 10mg comprimido',
  'Domperidona 1mg/mL suspensão oral',
  'Ondansetrona 4mg comprimido',
  'Ondansetrona 8mg comprimido',
  'Ondansetrona 4mg/5mL solução oral',
  'Bromoprida 10mg comprimido',
  'Loperamida 2mg cápsula',
  'Lactulose 667mg/mL xarope',
  'Bisacodil 5mg comprimido',
  'Polietilenoglicol 3350 pó',
  'Simeticona 40mg comprimido',
  'Simeticona 40mg/mL gotas',
  'Trimebutina 200mg comprimido',
  'Hioscina 10mg comprimido',
  'Hioscina 10mg/mL injetável',
  'Sucralfato 1g sachê',
  'Subsalicilato de bismuto 262mg comprimido',
  'Mesalazina 400mg comprimido',
  'Mesalazina 800mg comprimido',

  // Respiratório — Broncodilatadores / Antiasmáticos
  'Salbutamol 100mcg aerossol inalatório',
  'Salbutamol 5mg/mL solução para nebulização',
  'Formoterol 12mcg cápsula inalatória',
  'Salmeterol 25mcg aerossol inalatório',
  'Brometo de ipratrópio 20mcg/dose aerossol',
  'Brometo de tiotrópio 18mcg cápsula inalatória',
  'Beclometasona 250mcg aerossol inalatório',
  'Budesonida 200mcg cápsula inalatória',
  'Fluticasona 50mcg aerossol inalatório',
  'Fluticasona 250mcg aerossol inalatório',
  'Formoterol + Budesonida 6mcg/200mcg aerossol',
  'Salmeterol + Fluticasona 25mcg/125mcg aerossol',
  'Montelucaste 4mg comprimido mastigável',
  'Montelucaste 5mg comprimido mastigável',
  'Montelucaste 10mg comprimido',
  'Teofilina 200mg comprimido',

  // Respiratório — Xaropes / Antitussígenos / Mucolíticos
  'Ambroxol 30mg/5mL xarope',
  'Ambroxol 15mg/5mL xarope pediátrico',
  'Carbocisteína 750mg/15mL xarope',
  'Acetilcisteína 200mg sachê',
  'Acetilcisteína 600mg comprimido efervescente',
  'Guaifenesina 200mg/5mL xarope',
  'Dextrometorfano 15mg/5mL xarope',
  'Clobutinol 15mg/5mL xarope',
  'Bromexina 4mg/5mL xarope',
  'Erdosteína 300mg cápsula',

  // Urologia / Próstata
  'Tansulosina 0,4mg cápsula',
  'Alfuzosina 10mg comprimido',
  'Doxazosina 2mg comprimido',
  'Doxazosina 4mg comprimido',
  'Finasterida 5mg comprimido',
  'Dutasterida 0,5mg cápsula',
  'Sildenafila 50mg comprimido',
  'Sildenafila 100mg comprimido',
  'Tadalafila 5mg comprimido',
  'Tadalafila 20mg comprimido',
  'Vardenafila 10mg comprimido',
  'Oxibutinina 5mg comprimido',
  'Solifenacina 5mg comprimido',
  'Tolterodina 2mg comprimido',

  // Osteoporose / Musculoesquelético
  'Alendronato 70mg comprimido (1x/semana)',
  'Ibandronato 150mg comprimido (1x/mês)',
  'Risedronato 35mg comprimido (1x/semana)',
  'Calcitriol 0,25mcg cápsula',
  'Carbonato de cálcio 500mg comprimido',
  'Carbonato de cálcio + Vitamina D3 comprimido',
  'Cloridrato de ciclobenzaprina 5mg comprimido',
  'Cloridrato de ciclobenzaprina 10mg comprimido',
  'Carisoprodol 350mg comprimido',
  'Metocarbamol 750mg comprimido',
  'Tizanidina 2mg comprimido',
  'Baclofeno 10mg comprimido',

  // Vitaminas / Suplementos
  'Ácido fólico 400mcg comprimido',
  'Ácido fólico 5mg comprimido',
  'Vitamina D3 1.000 UI cápsula',
  'Vitamina D3 2.000 UI cápsula',
  'Vitamina D3 7.000 UI cápsula',
  'Vitamina D3 50.000 UI cápsula',
  'Vitamina B12 1mg comprimido sublingual',
  'Vitamina C 1g comprimido efervescente',
  'Complexo B comprimido',
  'Sulfato ferroso 40mg comprimido',
  'Ferro quelado 25mg comprimido',
  'Sacarato de hidróxido de ferro III 100mg/5mL xarope',
  'Ômega-3 1g cápsula',
  'Zinco 22mg comprimido',
  'Magnésio 300mg comprimido',
  'Coenzima Q10 100mg cápsula',

  // Ginecologia / Contracepção
  'Etinilestradiol + Levonorgestrel 30mcg/150mcg comprimido',
  'Etinilestradiol + Desogestrel 20mcg/150mcg comprimido',
  'Etinilestradiol + Gestodeno 20mcg/75mcg comprimido',
  'Levonorgestrel 1,5mg comprimido (emergência)',
  'Progesterona 100mg cápsula vaginal',
  'Progesterona 200mg cápsula vaginal',
  'Medroxiprogesterona 150mg/mL suspensão injetável',
  'Estradiol 1mg comprimido',
  'Estradiol 2mg comprimido',
  'Tibolona 2,5mg comprimido',
  'Metronidazol 250mg comprimido vaginal',
  'Fluconazol 150mg cápsula (candidíase)',
  'Clindamicina creme vaginal 2%',
  'Metronidazol gel vaginal',

  // Oftalmologia (colírios)
  'Timolol 0,5% colírio',
  'Latanoprosta 0,005% colírio',
  'Bimatoprosta 0,03% colírio',
  'Brimonidina 0,2% colírio',
  'Dorzolamida 2% colírio',
  'Carteolol 2% colírio',
  'Tobramicina 0,3% colírio',
  'Ciprofloxacino 0,3% colírio',
  'Ofloxacino 0,3% colírio',
  'Cloranfenicol 0,5% colírio',
  'Dexametasona 0,1% colírio',
  'Cetorolaco 0,5% colírio',
  'Lubrificante ocular (lágrima artificial)',

  // Dermatologia (tópicos)
  'Betametasona 0,05% creme',
  'Clobetasol 0,05% creme',
  'Hidrocortisona 1% creme',
  'Triamcinolona 0,1% creme',
  'Cetoconazol 2% creme',
  'Clotrimazol 1% creme',
  'Terbinafina 1% creme',
  'Mupirocina 2% pomada',
  'Ácido fusídico 2% creme',
  'Adapaleno 0,1% gel',
  'Tretinoína 0,025% creme',
  'Peróxido de benzoíla 5% gel',
  'Dapsona 5% gel',
  'Ivermectina 1% creme',
  'Metronidazol 0,75% gel',
  'Tacrolimo 0,03% pomada',
  'Tacrolimo 0,1% pomada',
  'Calcipotriol 0,005% pomada',
];

// ── Autocomplete de medicamento ─────────────────────────────────────────────
interface MedAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function MedAutocomplete({ value, onChange, placeholder }: MedAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = value.trim().length >= 2
    ? MEDICATION_SUGGESTIONS.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
      ).slice(0, 9)
    : [];

  const showDropdown = open && suggestions.length > 0;

  useEffect(() => { setHighlighted(0); }, [value]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const select = (s: string) => {
    onChange(s);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, suggestions.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); select(suggestions[highlighted]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg text-sm">
          {suggestions.map((s, idx) => {
            const q = value.trim();
            const lo = s.toLowerCase();
            const start = lo.indexOf(q.toLowerCase());
            const before = s.slice(0, start);
            const match = s.slice(start, start + q.length);
            const after = s.slice(start + q.length);
            return (
              <li
                key={s}
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
                onMouseEnter={() => setHighlighted(idx)}
                className={cn(
                  'px-3 py-2 cursor-pointer',
                  idx === highlighted ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                )}
              >
                {before}<strong>{match}</strong>{after}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
interface PrescriptionPadProps {
  patientId?: string;
}

const EMPTY_ITEM: PrescriptionItem = {
  medication: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
};

export function PrescriptionPad({ patientId: initialPatientId }: PrescriptionPadProps = {}) {
  const { user, currentClinicId } = useAuth();
  const [patientId, setPatientId] = useState<string>(initialPatientId ?? '');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

  const { data: patients = [] } = useQuery({
    queryKey: ['rx-patients', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, cpf')
        .eq('clinic_id', currentClinicId)
        .eq('is_active', true)
        .order('full_name')
        .limit(500);
      return data ?? [];
    },
    enabled: !!currentClinicId,
  });

  const patient = patients.find((p) => p.id === patientId);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = findTemplate(id);
    if (tpl) setItems(tpl.items.map((i) => ({ ...i })));
  };

  const updateItem = (idx: number, field: keyof PrescriptionItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const validItems = items.filter((it) => it.medication.trim());

  const handleGenerate = async () => {
    if (!patient || validItems.length === 0 || !user) {
      toast.error('Selecione o paciente e adicione ao menos um medicamento.');
      return;
    }
    setGenerating(true);
    try {
      const [clinic, dentist] = await Promise.all([
        fetchClinicForDocs(currentClinicId),
        fetchDentistForDocs(user.id, currentClinicId),
      ]);
      await generatePrescriptionPdf({
        items: validItems,
        patient: { full_name: patient.full_name, cpf: patient.cpf },
        dentist,
        clinic,
        notes,
      });
      await supabase.from('documents').insert({
        patient_id: patient.id,
        name: `Receita - ${new Date().toLocaleDateString('pt-BR')}`,
        file_url: 'generated://prescription',
        file_type: 'application/pdf',
        category: 'prescription',
        uploaded_by: user.id,
      });
      toast.success('Receita gerada e registrada no histórico.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar receita.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!patient?.phone) {
      toast.error('Paciente sem telefone cadastrado.');
      return;
    }
    const link = whatsappLink(patient.phone, 'Olá! Segue sua receita do atendimento. Em caso de dúvidas, entre em contato.');
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Modelo</Label>
        <div className="grid grid-cols-2 gap-2">
          {DEFAULT_PRESCRIPTION_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                templateId === tpl.id
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <p className="text-sm font-semibold">{tpl.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" /> Paciente
        </Label>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o paciente" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Medicamentos</Label>
          <Button variant="ghost" size="sm" onClick={addItem} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
        {items.map((item, idx) => (
          <Card key={idx} className="border-border/60">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <MedAutocomplete
                  value={item.medication}
                  onChange={(v) => updateItem(idx, 'medication', v)}
                  placeholder="Medicamento (ex: Dipirona 500mg)"
                />
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-9 w-9 text-destructive flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 ml-8">
                <Input placeholder="Dose" value={item.dosage} onChange={(e) => updateItem(idx, 'dosage', e.target.value)} />
                <Input placeholder="Frequência" value={item.frequency} onChange={(e) => updateItem(idx, 'frequency', e.target.value)} />
                <Input placeholder="Duração" value={item.duration} onChange={(e) => updateItem(idx, 'duration', e.target.value)} />
              </div>
              <Input
                placeholder="Instruções (opcional)"
                value={item.instructions ?? ''}
                onChange={(e) => updateItem(idx, 'instructions', e.target.value)}
                className="ml-8 w-[calc(100%-2rem)] text-xs"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Observações (opcional)</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Orientações adicionais..." />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleGenerate} disabled={generating || !patient || validItems.length === 0} className="gap-2">
          <FileDown className="h-4 w-4" />
          {generating ? 'Gerando...' : 'Gerar PDF'}
        </Button>
        <Button variant="outline" onClick={handleSendWhatsApp} disabled={!patient?.phone} className="gap-2">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}
