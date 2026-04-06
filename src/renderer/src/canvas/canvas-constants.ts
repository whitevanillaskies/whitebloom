/** How far connection handles sit outside the node boundary on all four sides. */
export const CONNECTION_HANDLE_OUTSET_PX = 8

export const NODE_HANDLE_IDS = {
  top: 'top',
  left: 'left',
  bottom: 'bottom',
  right: 'right'
} as const

/**
 * Distance in flow coordinates at which a node's handles become visible
 * while a connection is being dragged toward it.
 */
export const CONNECTION_PROXIMITY_THRESHOLD = 80
