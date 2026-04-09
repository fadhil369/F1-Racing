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
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
    
    if (event && gameKeys.includes(code)) {
      event.preventDefault();
    }

    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        this.forward = pressed;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.backward = pressed;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.left = pressed;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.right = pressed;
        break;
      case 'Space':
        this.brake = pressed;
        break;
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
