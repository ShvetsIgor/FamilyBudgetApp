'use client';
import { useState } from 'react';
import { I } from '../icons/icons';
import { StickerIcon } from './CategoryIcon';

const ALL_ICONS = Object.keys(I);

const TABS: Array<{ label: string; icons: string[] }> = [
  {
    label: 'Все',
    icons: ALL_ICONS,
  },
  {
    label: 'Еда',
    icons: ['cart', 'plate', 'coffee', 'burger', 'delivery', 'icecream', 'wine'],
  },
  {
    label: 'Дом',
    icons: ['house', 'key', 'bank', 'lightning', 'wifi', 'phone', 'couch', 'wrench', 'spray', 'receipt', 'building'],
  },
  {
    label: 'Транспорт',
    icons: ['bus', 'taxi', 'train', 'car', 'fuel', 'parking', 'shield', 'carwash', 'plane'],
  },
  {
    label: 'Развл',
    icons: ['cinema', 'ticket', 'brush', 'ferris', 'controller', 'tv', 'music', 'cloud', 'headphones'],
  },
  {
    label: 'Дети',
    icons: ['teddy', 'backpack', 'ball', 'book', 'cap'],
  },
  {
    label: 'Здоровье',
    icons: ['heart', 'pill', 'stethoscope', 'tooth', 'dumbbell'],
  },
  {
    label: 'Прочее',
    icons: ['box', 'briefcase', 'cash', 'card', 'coin', 'gift', 'chart_up', 'star', 'bag', 'shirt', 'laptop', 'lipstick', 'online', 'watch', 'paw', 'scissors', 'hands', 'cake', 'palm'],
  },
];

interface Props {
  selected: string;
  color: string;
  onSelect: (icon: string) => void;
}

export function IconPickerGrid({ selected, color, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  const icons = TABS[activeTab].icons.filter((ic) => I[ic]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === i
                ? 'bg-[#E07A5F] text-white'
                : 'bg-[#F4ECDE] text-[#8E7A66] hover:text-[#3D2C1F]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
        {icons.map((icon) => (
          <button
            key={icon}
            onClick={() => onSelect(icon)}
            className={`flex items-center justify-center rounded-xl p-2 transition-colors ${
              selected === icon
                ? 'ring-2 ring-offset-1'
                : 'hover:bg-[#F4ECDE]'
            }`}
            style={
              selected === icon
                ? { backgroundColor: `${color}20`, ringColor: color }
                : {}
            }
            aria-label={icon}
          >
            <StickerIcon icon={icon} color={selected === icon ? color : '#8E7A66'} className="h-7 w-7" />
          </button>
        ))}
      </div>
    </div>
  );
}
