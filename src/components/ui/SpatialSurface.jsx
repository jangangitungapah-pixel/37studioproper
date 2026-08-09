import {
  forwardRef,
} from 'react';

const SpatialSurface =
  forwardRef(
    function SpatialSurface(
      {
        as:
          Component =
            'div',

        children,

        className =
          '',

        depth =
          'base',

        ...props
      },
      ref,
    ) {
      const surfaceClassName =
        [
          'spatial-surface',
          className,
        ]
          .filter(
            Boolean,
          )
          .join(
            ' ',
          );

      return (
        <Component
          className={
            surfaceClassName
          }
          data-depth={
            depth
          }
          ref={
            ref
          }
          {...props}
        >
          {children}
        </Component>
      );
    },
  );

export default SpatialSurface;
