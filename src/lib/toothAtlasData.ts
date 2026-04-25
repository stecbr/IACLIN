export interface ToothInfo {
  type: 'incisivo' | 'canino' | 'pre-molar' | 'molar';
  arch: 'superior' | 'inferior';
  side: 'direito' | 'esquerdo';
  roots: number;
  canals: number;
  commonProcedures: string[];
}

function classify(num: number): ToothInfo {
  const digit = num % 10;
  const quadrant = Math.floor(num / 10);
  const arch: ToothInfo['arch'] = quadrant <= 2 ? 'superior' : 'inferior';
  const side: ToothInfo['side'] = quadrant === 1 || quadrant === 4 ? 'direito' : 'esquerdo';

  let type: ToothInfo['type'];
  let roots = 1;
  let canals = 1;

  if (digit === 1 || digit === 2) {
    type = 'incisivo';
    roots = 1;
    canals = 1;
  } else if (digit === 3) {
    type = 'canino';
    roots = 1;
    canals = 1;
  } else if (digit === 4 || digit === 5) {
    type = 'pre-molar';
    roots = arch === 'superior' && digit === 4 ? 2 : 1;
    canals = arch === 'superior' && digit === 4 ? 2 : 1;
  } else {
    type = 'molar';
    roots = arch === 'superior' ? 3 : 2;
    canals = arch === 'superior' ? 3 : (digit === 6 ? 3 : 2);
  }

  const procs: Record<ToothInfo['type'], string[]> = {
    incisivo: ['Restauração estética', 'Faceta', 'Tratamento endodôntico', 'Clareamento'],
    canino: ['Restauração', 'Tratamento endodôntico', 'Faceta'],
    'pre-molar': ['Restauração', 'Endodontia', 'Coroa'],
    molar: ['Restauração', 'Endodontia', 'Coroa', 'Extração', 'Selante'],
  };

  return { type, arch, side, roots, canals, commonProcedures: procs[type] };
}

export function getToothInfo(num: number): ToothInfo {
  return classify(num);
}

export function getToothLabel(num: number): string {
  const info = classify(num);
  return `${info.type[0].toUpperCase() + info.type.slice(1)} ${info.arch} ${info.side}`;
}