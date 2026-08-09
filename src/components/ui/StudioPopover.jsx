import {
  Popover,
} from 'radix-ui';

export default function StudioPopover({
  align = 'end',
  children,
  sideOffset = 8,
  trigger,
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        asChild
      >
        {trigger}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align={
            align
          }
          className="studio-popover-content"
          sideOffset={
            sideOffset
          }
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
