import { Menu } from '@base-ui/react/menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

/**
 * Base UI powered menu primitive for new workspaces.
 * Existing Radix-backed components remain untouched until individually migrated.
 */
export default function StudioMenu({
  align = 'end',
  items = [],
  label,
  triggerClassName = '',
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className={cn('studio-menu-trigger', triggerClassName)}
      >
        <span>{label}</span>
        <ChevronDown aria-hidden="true" size={15} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          align={align}
          className="studio-menu-positioner"
          sideOffset={8}
        >
          <Menu.Popup className="studio-menu-popup">
            {items.map((item, index) => {
              if (item.type === 'separator') {
                return <Menu.Separator className="studio-menu-separator" key={item.key || 'separator-' + index} />;
              }

              const Icon = item.icon;
              return (
                <Menu.Item
                  className={cn('studio-menu-item', item.danger && 'is-danger')}
                  disabled={Boolean(item.disabled)}
                  key={item.key || item.label || index}
                  onClick={item.onSelect}
                >
                  {Icon ? <Icon aria-hidden="true" size={16} /> : null}
                  <span>{item.label}</span>
                  {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
