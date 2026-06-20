import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface VitalPoint {
  dateLabel: string;
  date: string;
  bp_sys?: number | null;
  bp_dia?: number | null;
  hr?: number | null;
  weight?: number | null;
  glycemia?: number | null;
  temp?: number | null;
  spo2?: number | null;
}

type VitalKey = keyof Omit<VitalPoint, 'dateLabel' | 'date'>;

const COLORS: Record<VitalKey, string> = {
  bp_sys:   '#ef4444',
  bp_dia:   '#f97316',
  hr:       '#8b5cf6',
  weight:   '#06b6d4',
  glycemia: '#10b981',
  temp:     '#f59e0b',
  spo2:     '#3b82f6',
};

function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function MiniChart({
  title, data, dataKeys, labels, unit,
}: {
  title: string;
  data: VitalPoint[];
  dataKeys: VitalKey[];
  labels: string[];
  unit?: string;
}) {
  const hasData = data.some(p => dataKeys.some(k => p[k] != null));
  if (!hasData) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
            formatter={(v: unknown, name: string) => [`${v}${unit ?? ''}`, name]}
          />
          {dataKeys.length > 1 && <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />}
          {dataKeys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={labels[i]}
              stroke={COLORS[k]}
              strokeWidth={1.5}
              dot={{ r: 3, fill: COLORS[k] }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PatientVitalsChart({ patientId }: { patientId: string }) {
  const { data: points = [], isLoading } = useQuery({
    queryKey: ['patient-vitals-chart', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinical_records')
        .select('created_at, vital_signs')
        .eq('patient_id', patientId)
        .not('vital_signs', 'is', null)
        .order('created_at', { ascending: true })
        .limit(60);
      if (error) throw error;

      return (data ?? [])
        .map((r: any) => {
          const vs = r.vital_signs ?? {};
          const p: VitalPoint = {
            dateLabel: format(parseISO(r.created_at), 'dd/MM', { locale: ptBR }),
            date: r.created_at,
            bp_sys:   parseNum(vs.bp_sys),
            bp_dia:   parseNum(vs.bp_dia),
            hr:       parseNum(vs.hr),
            weight:   parseNum(vs.weight),
            glycemia: parseNum(vs.glycemia),
            temp:     parseNum(vs.temp),
            spo2:     parseNum(vs.spo2),
          };
          return p;
        })
        .filter(p =>
          [p.bp_sys, p.bp_dia, p.hr, p.weight, p.glycemia, p.temp, p.spo2]
            .some(v => v != null),
        );
    },
    enabled: !!patientId,
  });

  if (isLoading || points.length < 2) return null;

  const charts: {
    title: string; keys: VitalKey[]; labels: string[]; unit?: string;
  }[] = [
    { title: 'Pressão Arterial (mmHg)',    keys: ['bp_sys', 'bp_dia'], labels: ['Sistólica', 'Diastólica'], unit: ' mmHg' },
    { title: 'Frequência Cardíaca (bpm)',  keys: ['hr'],               labels: ['FC'],                       unit: ' bpm'  },
    { title: 'Peso (kg)',                  keys: ['weight'],           labels: ['Peso'],                     unit: ' kg'   },
    { title: 'Glicemia (mg/dL)',           keys: ['glycemia'],         labels: ['Glicemia'],                 unit: ' mg/dL'},
    { title: 'Temperatura (°C)',           keys: ['temp'],             labels: ['Temp.'],                    unit: '°C'    },
    { title: 'SpO₂ (%)',                   keys: ['spo2'],             labels: ['SpO₂'],                     unit: '%'     },
  ].filter(c => points.some(p => c.keys.some(k => (p as any)[k] != null)));

  if (charts.length === 0) return null;

  return (
    <Card className="border-border/50 col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          Evolução dos Sinais Vitais
          <span className="font-normal ml-1">({points.length} registros)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {charts.map(c => (
            <MiniChart
              key={c.title}
              title={c.title}
              data={points}
              dataKeys={c.keys}
              labels={c.labels}
              unit={c.unit}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
