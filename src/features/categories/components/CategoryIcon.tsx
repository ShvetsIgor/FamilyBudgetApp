import { I } from '../icons/icons';

interface Props {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { outer: 'h-8 w-8',   inner: 'h-5 w-5'  },
  md: { outer: 'h-10 w-10', inner: 'h-6 w-6'  },
  lg: { outer: 'h-12 w-12', inner: 'h-8 w-8'  },
};

export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const { outer, inner } = sizes[size];
  const IconComp = I[icon];
  const gradId = `cg-${icon}-${color.replace('#', '')}`;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${outer}`}
      style={{ backgroundColor: `${color}20` }}
    >
      {IconComp ? (
        <div className={inner}>
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
