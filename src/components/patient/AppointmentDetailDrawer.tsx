import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, Clock, MapPin, Phone, Building2, Stethoscope,
  CheckCircle2, XCircle, ExternalLink, MessageCircle, FileText, Eye,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { geocodeAddress } from '@/lib/geocode';
import { appointmentStatusMap, type AppointmentRow } from '@/hooks/usePatientData';
import { AttendanceSummaryModal } from '@/components/attendance/AttendanceSummaryModal';

interface Props {
  appointment: AppointmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

function digitsOnly(s?: string | null) {
  return (s ?? '').replace(/\D/g, '');
}

export function AppointmentDetailDrawer({ appointment, open, onOpenChange, onChanged }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Geocode when appointment changes
  useEffect(() => {
    if (!appointment) return;
    setCoords(null);
    let cancel = false;
    geocodeAddress(appointment.clinic_address, appointment.clinic_city, null, null).then((c) => {
      if (!cancel) setCoords(c);
    });
    return () => {
      cancel = true;
    };
  }, [appointment?.id, appointment?.clinic_address, appointment?.clinic_city]);

  // Init map when coords + drawer open
  useEffect(() => {
    if (!open || !coords || !mapRef.current) return;
    // small delay to ensure container has size after sheet animation
    const t = setTimeout(() => {
      if (!mapRef.current) return;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      const map = L.map(mapRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 15,
        zoomControl: false,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;background:hsl(var(--primary));border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([coords.lat, coords.lng], { icon }).addTo(map);
      mapInstance.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }, 250);

    return () => {
      clearTimeout(t);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [open, coords]);

  if (!appointment) return null;

  const status = appointmentStatusMap[appointment.status] ?? {
    label: appointment.status,
    variant: 'outline' as const,
  };

  const handleConfirm = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointment.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Presença confirmada');
    onChanged?.();
  };

  const handleCancel = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Consulta cancelada');
    onChanged?.();
    onOpenChange(false);
  };

  const mapsUrl = (() => {
    const q = encodeURIComponent(
      [appointment.clinic_name, appointment.clinic_address, appointment.clinic_city]
        .filter(Boolean)
        .join(', ')
    );
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  })();

  const phone = digitsOnly(appointment.clinic_phone);
  const waUrl = phone
    ? `https://wa.me/55${phone}?text=${encodeURIComponent(
        `Olá! Sobre minha consulta em ${format(parseISO(appointment.start_time), "dd/MM 'às' HH:mm")}.`
      )}`
    : null;

  const initials = appointment.dentist_name
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isPast = new Date(appointment.start_time) < new Date();
  const canAct = !isPast && appointment.status !== 'cancelled' && appointment.status !== 'completed';
  const isCompleted = appointment.status === 'completed';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes da consulta</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-12 w-12">
                <AvatarImage src={appointment.dentist_avatar ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold truncate">{appointment.dentist_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Building2 className="h-3 w-3 flex-shrink-0" /> {appointment.clinic_name}
                </p>
              </div>
            </div>
            <Badge variant={status.variant} className="flex-shrink-0">
              {status.label}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2.5 text-foreground">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">
                {format(parseISO(appointment.start_time), "EEEE, dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(parseISO(appointment.start_time), 'HH:mm')} —{' '}
                {format(parseISO(appointment.end_time), 'HH:mm')}
              </span>
            </div>
            {(appointment.clinic_address || appointment.clinic_city) && (
              <div className="flex items-start gap-2.5 text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>
                  {[appointment.clinic_address, appointment.clinic_city].filter(Boolean).join(' - ')}
                </span>
              </div>
            )}
            {appointment.clinic_phone && (
              <div className="flex items-center gap-2.5 text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.clinic_phone}</span>
              </div>
            )}
            {appointment.notes && (
              <div className="flex items-start gap-2.5 text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">{appointment.notes}</span>
              </div>
            )}
          </div>

          {coords && (
            <div className="rounded-xl overflow-hidden border border-border h-44">
              <div ref={mapRef} className="h-full w-full" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Google Maps
              </a>
            </Button>
            {waUrl ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="gap-1.5">
                <MessageCircle className="h-4 w-4" /> Sem telefone
              </Button>
            )}
          </div>

          {canAct && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                {appointment.status !== 'confirmed' && (
                  <Button onClick={handleConfirm} disabled={busy} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Confirmar
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={busy}
                  className={`gap-1.5 ${appointment.status === 'confirmed' ? 'col-span-2' : ''}`}
                >
                  <XCircle className="h-4 w-4" /> Cancelar consulta
                </Button>
              </div>
            </>
          )}

          {isCompleted && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resumo da consulta
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={() => setShowSummary(true)}
                >
                  <Eye className="h-4 w-4" /> Ver resumo completo
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
      <AttendanceSummaryModal
        appointmentId={appointment.id}
        open={showSummary}
        onOpenChange={setShowSummary}
      />
    </Sheet>
  );
}
