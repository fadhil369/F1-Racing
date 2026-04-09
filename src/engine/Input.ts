export class InputManager {
  public forward = false;
  public backward = false;
  public left = false;
  public right = false;
  public brake = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private handleKey(code: string, pressed: boolean, event?: KeyboardEvent) {
    const gameCodes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' ', 'W', 'A', 'S', 'D'];
    
    // Prevent default browser actions (like scrolling) for all game performance keys
    if (event && (gameCodes.includes(code) || gameKeys.includes(event.key))) {
      event.preventDefault();
    }

    // Match by code (preferred for layout independence) or key (fallback)
    const isW = code === 'KeyW' || (event && event.key === 'w') || (event && event.key === 'W');
    const isS = code === 'KeyS' || (event && event.key === 's') || (event && event.key === 'S');
    const isA = code === 'KeyA' || (event && event.key === 'a') || (event && event.key === 'A');
    const isD = code === 'KeyD' || (event && event.key === 'd') || (event && event.key === 'D');
    const isUp = code === 'ArrowUp' || (event && event.key === 'ArrowUp');
    const isDown = code === 'ArrowDown' || (event && event.key === 'ArrowDown');
    const isLeft = code === 'ArrowLeft' || (event && event.key === 'ArrowLeft');
    const isRight = code === 'ArrowRight' || (event && event.key === 'ArrowRight');
    const isSpace = code === 'Space' || (event && event.key === ' ');

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
    this.handleKey(event.code, true, event);
  }

  public onKeyUp(event: KeyboardEvent) {
    this.handleKey(event.code, false, event);
  }

  // Mobile API
  public setForward(val: boolean) { this.forward = val; }
  public setBackward(val: boolean) { this.backward = val; }
  public setLeft(val: boolean) { this.left = val; }
  public setRight(val: boolean) { this.right = val; }
  public setBrake(val: boolean) { this.brake = val; }
}
