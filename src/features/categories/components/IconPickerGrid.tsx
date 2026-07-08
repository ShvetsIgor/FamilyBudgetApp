'use client';
import { useT } from '@/shared/hooks/useT';
import { useState } from 'react';
import { I } from '../icons/icons';
import { StickerIcon } from './CategoryIcon';

const ALL_ICONS = Object.keys(I);

const TABS: Array<{ key: string; icons: string[] }> = [
  {
    key: 'all',
    icons: ALL_ICONS,
  },
  {
    key: 'food',
    icons: ['cart', 'plate', 'coffee', 'burger', 'delivery', 'icecream', 'wine'],
  },
  {
    key: 'home',
    icons: ['house', 'key', 'bank', 'lightning', 'wifi', 'phone', 'couch', 'wrench', 'spray', 'receipt', 'building'],
  },
  {
    key: 'transport',
    icons: ['bus', 'taxi', 'train', 'car', 'fuel', 'parking', 'shield', 'carwash', 'plane'],
  },
  {
    key: 'fun',
    icons: ['cinema', 'ticket', 'brush', 'ferris', 'controller', 'tv', 'music', 'cloud', 'headphones'],
  },
  {
    key: 'kids',
    icons: ['teddy', 'backpack', 'ball', 'book', 'cap'],
  },
  {
    key: 'health',
    icons: ['heart', 'pill', 'stethoscope', 'tooth', 'dumbbell'],
  },
  {
    key: 'other',
    icons: ['box', 'briefcase', 'cash', 'card', 'coin', 'gift', 'chart_up', 'star', 'bag', 'shirt', 'laptop', 'lipstick', 'online', 'watch', 'paw', 'scissors', 'hands', 'cake', 'palm'],
  },
];

interface Props {
  selected: string;
  color: string;
  onSelect: (icon: string) => void;
}

export function IconPickerGrid({ selected, color, onSelect }: Props) {
  const t = useT();
  const [activeTab, setActiveTab] = useState(0);

  const icons = TABS[activeTab].icons.filter((ic) => I[ic]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(i)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === i
                ? 'bg-[#E07A5F] text-white'
                : 'bg-[#F4ECDE] text-[#8E7A66] hover:text-[#3D2C1F]'
            }`}
          >
            {t(`categories.iconGroups.${tab.key}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-0.5">
        {icons.map((icon) => (
          <button
            key={icon}
            onClick={() => onSelect(icon)}
            className={`box-border flex aspect-square h-10 w-10 items-center justify-center rounded-xl border p-1.5 transition-colors ${
              selected === icon
                ? 'border-[#E07A5F] bg-[#F4ECDE]'
                : 'border-transparent hover:bg-[#F4ECDE]'
            }`}
            style={
              selected === icon
                ? { backgroundColor: `${color}20`, borderColor: color, boxShadow: `inset 0 0 0 1px ${color}` }
                : {}
            }
            aria-label={icon}
          >
            <StickerIcon icon={icon} color={selected === icon ? color : '#8E7A66'} className="h-6 w-6" />
          </button>
        ))}
      </div>
    </div>
  );
}
