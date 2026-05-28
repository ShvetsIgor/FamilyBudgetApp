import { I } from '../icons/icons';

interface StickerProps {
  icon: string;
  color: string;
  className?: string;
}

export function StickerIcon({ icon, color, className = 'h-4 w-4' }: StickerProps) {
  const IconComp = I[icon];
  const gradId = `si-${icon}-${color.replace('#', '')}`;
  if (!IconComp) return <span style={{ color }}>{icon}</span>;
  return (
    <span className={`inline-block shrink-0 [&>svg]:h-full [&>svg]:w-full ${className}`}>
      <IconComp c={color} id={gradId} />
    </span>
  );
}

interface Props {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { data: 'md', inner: 'h-5 w-5' },
  md: { data: 'lg', inner: 'h-6 w-6' },
  lg: { data: 'xl', inner: 'h-8 w-8' },
};

export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const { data, inner } = sizes[size];
  const IconComp = I[icon];
  const gradId = `cg-${icon}-${color.replace('#', '')}`;

  return (
    <div
      className="fb-cat-chip shrink-0"
      data-size={data}
      style={{ backgroundColor: `${color}20` }}
    >
      {IconComp ? (
        <div className={`[&>svg]:h-full [&>svg]:w-full ${inner}`}>
          <IconComp c={color} id={gradId} />
        </div>
      ) : (
        <span style={{ color }} className="leading-none">
          {icon}
        </span>
      )}
    </div>
  );
}
