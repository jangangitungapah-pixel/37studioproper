import {
  forwardRef,
} from 'react';

const IconButton =
  forwardRef(
    function IconButton(
      {
        children,
        className = '',
        label,
        title,
        type = 'button',
        ...props
      },
      ref,
    ) {
      if (!label) {
        throw new Error(
          'IconButton membutuhkan prop label untuk accessibility.',
        );
      }

      const buttonClassName =
        [
          'studio-icon-button',
          className,
        ]
          .filter(
            Boolean,
          )
          .join(
            ' ',
          );

      return (
        <button
          aria-label={
            label
          }
          className={
            buttonClassName
          }
          ref={
            ref
          }
          title={
            title ||
            label
          }
          type={
            type
          }
          {...props}
        >
          {children}
        </button>
      );
    },
  );

export default IconButton;
