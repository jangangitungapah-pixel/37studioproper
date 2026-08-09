import {
  DropdownMenu,
} from 'radix-ui';

export function StudioMenuItem({
  children,
  className = '',
  ...props
}) {
  const itemClassName =
    [
      'studio-menu-item',
      className,
    ]
      .filter(
        Boolean,
      )
      .join(
        ' ',
      );

  return (
    <DropdownMenu.Item
      className={
        itemClassName
      }
      {...props}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function StudioMenuSeparator() {
  return (
    <DropdownMenu.Separator
      className="studio-menu-separator"
    />
  );
}

export default function StudioMenu({
  align = 'end',
  children,
  sideOffset = 8,
  trigger,
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        asChild
      >
        {trigger}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={
            align
          }
          className="studio-menu-content"
          sideOffset={
            sideOffset
          }
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
