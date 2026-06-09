// Fire these when any full-screen modal opens or closes so the navbar
// can go instantly transparent without its 0.4 s background transition.
export const navSignal = {
  modalOpened: () =>
    typeof document !== "undefined" &&
    document.dispatchEvent(new CustomEvent("navbar:modal-opened")),
  modalClosed: () =>
    typeof document !== "undefined" &&
    document.dispatchEvent(new CustomEvent("navbar:modal-closed")),
};
