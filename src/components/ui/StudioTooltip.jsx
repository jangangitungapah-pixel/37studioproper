import {
  Tooltip,
} from 'radix-ui';

export default function StudioTooltip({
  children,
  content,
  delayDuration,
  side = 'right',
  sideOffset = 8,
}) {
  if (!content) {
    return children;
  }

  return (
    <Tooltip.Root
      delayDuration={
        delayDuration
      }
    >
      <Tooltip.Trigger
        asChild
      >
        {children}
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Content
          className="studio-tooltip-content"
          side={
            side
          }
          sideOffset={
            sideOffset
          }
        >
          {content}

          <Tooltip.Arrow
            className="studio-tooltip-arrow"
          />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
