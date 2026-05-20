'use client';
import { RPToday } from './widgets/RPToday';
import { RPEnvelopes } from './widgets/RPEnvelopes';
import { RPGoals } from './widgets/RPGoals';
import { RPBills } from './widgets/RPBills';
import { RPFirstSteps } from './widgets/RPFirstSteps';
import { RPCheatSheet } from './widgets/RPCheatSheet';
import { usePanelPriority } from './usePanelPriority';

const REGISTRY: Record<string, React.ComponentType> = {
  today: RPToday,
  envelopes: RPEnvelopes,
  goals: RPGoals,
  bills: RPBills,
  firstSteps: RPFirstSteps,
  cheatSheet: RPCheatSheet,
};

export function RightPanel() {
  const order = usePanelPriority();
  return (
    <>
      {order.map((key) => {
        const W = REGISTRY[key];
        return W ? <W key={key} /> : null;
      })}
    </>
  );
}
