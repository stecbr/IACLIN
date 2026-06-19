interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
};

export function IaclinWordmark({ className = '', size = 'md' }: Props) {
  return (
    <span
      className={`leading-none ${sizeMap[size]} ${className}`}
      style={{ fontFamily: "'Jura', sans-serif", letterSpacing: '0.12em', fontWeight: 600 }}
    >
      <span style={{ color: '#033563' }}>IA</span>
      <span style={{ color: '#5b6887' }}>CLIN</span>
    </span>
  );
}
