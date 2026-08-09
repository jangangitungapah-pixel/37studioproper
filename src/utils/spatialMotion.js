export const STUDIO_MOTION =
  Object.freeze({
    micro: {
      duration:
        0.13,

      ease:
        [
          0.2,
          0,
          0,
          1,
        ],
    },

    control: {
      duration:
        0.19,

      ease:
        [
          0.16,
          1,
          0.3,
          1,
        ],
    },

    spatial: {
      duration:
        0.28,

      ease:
        [
          0.22,
          1,
          0.36,
          1,
        ],
    },
  });

export const STUDIO_OVERLAY_VARIANTS =
  Object.freeze({
    hidden: {
      opacity:
        0,

      scale:
        0.985,

      y:
        -4,
    },

    visible: {
      opacity:
        1,

      scale:
        1,

      y:
        0,
    },
  });

export const STUDIO_ROUTE_VARIANTS =
  Object.freeze({
    hidden: {
      opacity:
        0,

      y:
        6,
    },

    visible: {
      opacity:
        1,

      y:
        0,
    },
  });
