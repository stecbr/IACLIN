export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configurações da clínica e perfil.</p>
      </div>
      <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">Configurações em breve</p>
      </div>
    </div>
  );
}
