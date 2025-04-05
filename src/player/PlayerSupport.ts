/*
 *
 * Copyright (c) 1999-2025 Luciad All Rights Reserved.
 *
 * Luciad grants you ("Licensee") a non-exclusive, royalty free, license to use,
 * modify and redistribute this software in source and binary code form,
 * provided that i) this copyright notice and license appear on all copies of
 * the software; and ii) Licensee does not utilize the software in a manner
 * which is disparaging to Luciad.
 *
 * This software is provided "AS IS," without a warranty of any kind. ALL
 * EXPRESS OR IMPLIED CONDITIONS, REPRESENTATIONS AND WARRANTIES, INCLUDING ANY
 * IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR
 * NON-INFRINGEMENT, ARE HEREBY EXCLUDED. LUCIAD AND ITS LICENSORS SHALL NOT BE
 * LIABLE FOR ANY DAMAGES SUFFERED BY LICENSEE AS A RESULT OF USING, MODIFYING
 * OR DISTRIBUTING THE SOFTWARE OR ITS DERIVATIVES. IN NO EVENT WILL LUCIAD OR ITS
 * LICENSORS BE LIABLE FOR ANY LOST REVENUE, PROFIT OR DATA, OR FOR DIRECT,
 * INDIRECT, SPECIAL, CONSEQUENTIAL, INCIDENTAL OR PUNITIVE DAMAGES, HOWEVER
 * CAUSED AND REGARDLESS OF THE THEORY OF LIABILITY, ARISING OUT OF THE USE OF
 * OR INABILITY TO USE SOFTWARE, EVEN IF LUCIAD HAS BEEN ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGES.
 */
import {clamp} from "@luciad/ria-toolbox-core/util/Math.js";
import {Updatable} from "@luciad/ria-toolbox-core/util/Updatable.js";
import {Handle} from '@luciad/ria/util/Evented.js';
import {EventedSupport} from '@luciad/ria/util/EventedSupport.js';
import {AnimationManager} from '@luciad/ria/view/animation/AnimationManager.js';
import {Animation} from "@luciad/ria/view/animation/Animation.js";

const PLAYER_START_STOP_EVENT = 'PlayerStartStopEvent';
const PLAYER_FRACTION_EVENT = 'PlayerFractionEvent';
const PLAYER_SPEED_CHANGE_EVENT = 'PlayerSpeedChangeEvent';
const PLAYER_DURATION_CHANGE_EVENT = 'PlayerDurationChangeEvent';
const PLAYER_PLAY_IN_LOOP_CHANGE_EVENT = 'PlayerPlayInLoopChangeEvent';

/**
 * Configuration options provided to the PlayerSupport constructor.
 */
export interface PlayerSupportConstructorOptions {
  /**
   * The object that the player updates when playing.
   */
  updatable: Updatable;

  /**
   * Key to associate the created animation with.
   * This key is used to link the animation to the AnimationManager.
   * Refer to the `AnimationManager.putAnimation` API for more information.
   * By default, a random key is generated.
   */
  animationKey?: string;

  /**
   * Duration of the complete animation in milliseconds. Default value is `1_000` ms.
   */
  duration?: number;

  /**
   * Speed factor of the animation.
   * If value is greater than 1 then the animation will play faster.
   * If value is smaller than 1 then the animation will play slower.
   * Default value is 1.
   */
  speedFactor?: number;

  /**
   * Determines whether the animation should play in a loop. Default value is `false`.
   */
  playInLoop?: boolean;
}

/**
 * The `PlayerSupport` class facilitates the management and playback of spatial animations.
 * It controls the lifecycle of an animation, allowing it to start, play, and stop based on the configuration set via
 * `PlayerSupportConstructorOptions`.
 * This class also notifies registered listeners about changes in player settings, such as duration, speed factor,
 * and play-in-loop option, as well as the player events (start/stop), and fraction change.
 */
export class PlayerSupport {
  private readonly _eventSupport: EventedSupport;
  private readonly _updatable: Updatable;
  private readonly _animationKey: string;
  private _animation: PlayerAnimation | null = null;

  private _speedFactor = 1.0;
  private _playInLoop = false;
  private _duration = 1_000; // milliseconds
  private _fraction = 0.0;
  private _playing = false;

  /**
   * Constructs a new `PlayerSupport` instance.
   * @param options The options for configuring `PlayerSupport`.
   */
  constructor({
                updatable,
                duration,
                speedFactor,
                playInLoop,
                animationKey,
              }: PlayerSupportConstructorOptions) {
    this._eventSupport = new EventedSupport([
      PLAYER_START_STOP_EVENT,
      PLAYER_FRACTION_EVENT,
      PLAYER_SPEED_CHANGE_EVENT,
      PLAYER_DURATION_CHANGE_EVENT,
      PLAYER_PLAY_IN_LOOP_CHANGE_EVENT], true);

    this._updatable = updatable;
    this._animationKey = animationKey || `PLAYER-${performance.now()}`;
    this._duration = duration && duration > 0 ? duration : 1_000;
    this._speedFactor = speedFactor && speedFactor > 0 ? speedFactor : 1.0;
    this._playInLoop = playInLoop ?? false;
  }

  /**
   * Gets the total duration of the playback in milliseconds.
   */
  get duration(): number {
    return this._duration;
  }

  set duration(value: number) {
    if (value <= 0) {
      throw new Error('Player tool: the duration must be a positive value')
    }
    if (this._duration !== value) {
      this._duration = value;
      this._eventSupport.emit(PLAYER_DURATION_CHANGE_EVENT, this.duration);
      // restart the animation taking into account the new settings
      if (this.playing) {
        this.play();
      }
    }
  }

  /**
   * The player's speed factor.
   * If value is greater than 1 then the animation will be played faster.
   * If value is smaller than 1 then the animation will be played slower.
   */
  get speedFactor(): number {
    return this._speedFactor;
  }

  set speedFactor(factor: number) {
    if (factor <= 0) {
      throw new Error('Player tool: the speed factor must be a positive value');
    }

    if (factor !== this._speedFactor) {
      this._speedFactor = factor;
      this._eventSupport.emit(PLAYER_SPEED_CHANGE_EVENT, this.speedFactor);
      // restart animation taking into account new settings
      if (this.playing) {
        this.play();
      }
    }
  }

  /**
   * If set to `true`, the player will restart the animation after it finishes.
   * Default is `false`.
   */
  get playInLoop(): boolean {
    return this._playInLoop;
  }

  set playInLoop(value: boolean) {
    if (this._playInLoop !== value) {
      this._playInLoop = value;
      this._eventSupport.emit(PLAYER_PLAY_IN_LOOP_CHANGE_EVENT, this.playInLoop);
    }
  }

  /**
   * Retrieves the current fraction that has been passed to the updatable object.
   * The returned value is between 0 (indicating no change) and 1 (indicating full change).
   * @returns the current fraction.
   */
  get fraction(): number {
    return this._fraction;
  }

  /**
   * Updates the current fraction of the animation playback and refreshes
   * the screen to reflect the state at the new fraction.
   */
  set fraction(fraction: number) {
    fraction = clamp(fraction, 0, 1);
    if (fraction !== this._fraction) {
      this._fraction = fraction;
      this._updatable.update(fraction);
      this.emitPlayerFractionEvent();
    }
  }

  /**
   * Returns `true` if the playing is in progress, `false` otherwise.
   */
  get playing(): boolean {
    return this._playing;
  }

  private set playing(value: boolean) {
    if (this._playing !== value) {
      this._playing = value;
      this.emitPlayerStartStopEvent();
    }
  }

  /**
   * Starts the player animation from the current fraction.
   */
  play(): void {
    this.playing = true;
    // reset the fraction if starting from the very end
    if (this.fraction === 1.0) {
      this.fraction = 0.0;
    }

    this._animation = new PlayerAnimation(this);
    AnimationManager.putAnimation(this._animationKey, this._animation, false)
        .then(() => {
          if (this.playInLoop) {
            this.play();
          } else {
            this.fraction = 1.0;
            this.stop();
          }
        })
        .catch(error => {
          if (error.name !== "AbortError") {
            throw error;
          }
        });
  }

  /**
   * Stops the ongoing player animation.
   * Note: You can resume the animation from the current fraction by invoking the `play` method again.
   */
  stop(): void {
    if (this._animation && AnimationManager.getAnimation(this._animationKey)) {
      AnimationManager.removeAnimation(this._animationKey);
    }
    this._animation = null;
    this.playing = false;
  }

  private emitPlayerStartStopEvent() {
    this._eventSupport.emit(PLAYER_START_STOP_EVENT, this.playing);
  }

  private emitPlayerFractionEvent() {
    this._eventSupport.emit(PLAYER_FRACTION_EVENT, this.fraction);
  }

  /**
   * Register a callback for the player start/stop event.
   *
   * @param callback - The function to call when the event occurs.
   * @returns A handle that represents the registration of the callback.
   *          This handle can be used to unregister the callback later.
   */
  onPlayerStartStopEvent(callback: (playing: boolean) => void): Handle {
    return this._eventSupport.on(PLAYER_START_STOP_EVENT, callback);
  }

  /**
   * Register a callback for the player fraction change event.
   *
   * @param callback - The function to call when the event occurs.
   * @returns A handle that represents the registration of the callback.
   *          This handle can be used to unregister the callback later.
   */
  onPlayerFractionEvent(callback: (fraction: number) => void): Handle {
    return this._eventSupport.on(PLAYER_FRACTION_EVENT, callback);
  }

  /**
   * Register a callback for the duration of the complete animation (in milliseconds) change event.
   *
   * @param callback - The function to call when the event occurs.
   * @returns A handle that represents the registration of the callback.
   *          This handle can be used to unregister the callback later.
   */
  onPlayerDurationChange(callback: (duration: number) => void): Handle {
    return this._eventSupport.on(PLAYER_DURATION_CHANGE_EVENT, callback);
  }

  /**
   * Register a callback for the speed factor change event.
   *
   * @param callback - The function to call when the event occurs.
   * @returns A handle that represents the registration of the callback.
   *          This handle can be used to unregister the callback later.
   */
  onPlayerSpeedChange(callback: (speedFactor: number) => void): Handle {
    return this._eventSupport.on(PLAYER_SPEED_CHANGE_EVENT, callback);
  }

  /**
   * Register a callback for the play-in-loop property (whether the animation should play in a loop) change event.
   *
   * @param callback - The function to call when the event occurs.
   * @returns A handle that represents the registration of the callback.
   *          This handle can be used to unregister the callback later.
   */
  onPlayerPlayInLoopChange(callback: (playInLoop: boolean) => void): Handle {
    return this._eventSupport.on(PLAYER_PLAY_IN_LOOP_CHANGE_EVENT, callback);
  }
}

/**
 * The `PlayerAnimation` class is used to animate the map camera over a path.
 */
class PlayerAnimation extends Animation {
  private readonly _playerSupport: PlayerSupport;
  private readonly _fractionStart: number;

  constructor(player: PlayerSupport) {
    super(computeDuration(player.duration, player.fraction, player.speedFactor));
    this._playerSupport = player;
    this._fractionStart = player.fraction;
  }

  override update(relativeFraction: number): void {
    // Computes the absolute fraction of the progress
    this._playerSupport.fraction = this._fractionStart + relativeFraction * (1 - this._fractionStart);
  }
}

/**
 * Computes remaining duration of the tour animation.
 * @param totalDuration total duration of the tour in seconds
 * @param fractionStart fraction when the animation starts
 * @param speedFactor speed factor
 */
function computeDuration(totalDuration: number, fractionStart: number, speedFactor: number): number {
  const timeAtStart = fractionStart * totalDuration;
  const normalDuration = totalDuration - timeAtStart;
  return normalDuration / speedFactor;
}
