import {
  MotionConfig,
} from 'motion/react';

import {
  Tooltip,
} from 'radix-ui';

export default function SpatialUiProvider({
  children,
}) {
  return (
    <MotionConfig
      reducedMotion="user"
    >
      <Tooltip.Provider
        delayDuration={
          420
        }
        skipDelayDuration={
          180
        }
      >
        {children}
      </Tooltip.Provider>
    </MotionConfig>
  );
}
