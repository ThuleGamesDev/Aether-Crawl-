export interface UiCursorState {
  inventoryOpen: boolean;
  mapOpen: boolean;
  paused: boolean;
  levelUpOpen: boolean;
  roomOfferOpen: boolean;
  lawOfferOpen?: boolean;
  threadOfferOpen?: boolean;
  gameOver: boolean;
}

/** Any blocking game overlay requires an unlocked cursor and cleared gameplay input. */
export function shouldReleasePointerLockForUi(state: UiCursorState): boolean {
  return state.inventoryOpen || state.mapOpen || state.paused || state.levelUpOpen || state.roomOfferOpen || state.lawOfferOpen || state.threadOfferOpen || state.gameOver;
}
