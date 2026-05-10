interface Props {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'h-8 w-8 text-base', md: 'h-10 w-10 text-lg', lg: 'h-12 w-12 text-xl' };

export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${sizes[size]}`}
      style={{ backgroundColor: `${color}20` }}
    >
      <span style={{ color }}>{icon}</span>
    </div>
  );
}
