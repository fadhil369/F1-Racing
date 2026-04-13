export class InputManager {
  public forward = false;
  public backward = false;
  public left = false;
  public right = false;
  public brake = false;
  private readonly onKeyDownBound: (event: KeyboardEvent) => void;
  private readonly onKeyUpBound: (event: KeyboardEvent) => void;
  private readonly onBlurBound: () => void;
  private readonly onVisibilityChangeBound: () => void;

  constructor() {
    this.onKeyDownBound = (event: KeyboardEvent) => this.onKeyDown(event);
    this.onKeyUpBound = (event: KeyboardEvent) => this.onKeyUp(event);
    this.onBlurBound = () => this.resetState();
    this.onVisibilityChangeBound = () => {
      if (document.hidden) {
        this.resetState();
      }
    };

    // Capture phase ensures game input still works even when focus is on UI controls.
    window.addEventListener('keydown', this.onKeyDownBound, { capture: true });
    window.addEventListener('keyup', this.onKeyUpBound, { capture: true });
    window.addEventListener('blur', this.onBlurBound);
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  private resetState() {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.brake = false;
  }

  private handleKey(event: KeyboardEvent, pressed: boolean) {
    const code = event.code ?? '';
    const key = event.key ?? '';
    const keyLower = key.length === 1 ? key.toLowerCase() : key;

    // Match by code (preferred for layout independence) or key (fallback).
    const isW = code === 'KeyW' || keyLower === 'w';
    const isS = code === 'KeyS' || keyLower === 's';
    const isA = code === 'KeyA' || keyLower === 'a';
    const isD = code === 'KeyD' || keyLower === 'd';
    const isUp = code === 'ArrowUp' || key === 'ArrowUp' || key === 'Up';
    const isDown = code === 'ArrowDown' || key === 'ArrowDown' || key === 'Down';
    const isLeft = code === 'ArrowLeft' || key === 'ArrowLeft' || key === 'Left';
    const isRight = code === 'ArrowRight' || key === 'ArrowRight' || key === 'Right';
    const isSpace = code === 'Space' || key === ' ' || key === 'Spacebar';
    const isGameInput = isW || isS || isA || isD || isUp || isDown || isLeft || isRight || isSpace;

    if (isGameInput) {
      event.preventDefault();
    }

    if (isUp || isW) {
      this.forward = pressed;
    } else if (isDown || isS) {
      this.backward = pressed;
    }

    if (isLeft || isA) {
      this.left = pressed;
    } else if (isRight || isD) {
      this.right = pressed;
    }

    if (isSpace) {
      this.brake = pressed;
    }
  }

  public onKeyDown(event: KeyboardEvent) {
    this.handleKey(event, true);
  }

  public onKeyUp(event: KeyboardEvent) {
    this.handleKey(event, false);
  }

  // Mobile API
  public setForward(val: boolean) { this.forward = val; }
  public setBackward(val: boolean) { this.backward = val; }
  public setLeft(val: boolean) { this.left = val; }
  public setRight(val: boolean) { this.right = val; }
  public setBrake(val: boolean) { this.brake = val; }
}
