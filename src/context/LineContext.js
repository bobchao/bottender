/* @flow */

import sleep from 'delay';
import warning from 'warning';
import invariant from 'invariant';
import { LineClient } from 'messaging-api-line';

import type { LineSession } from '../bot/LineConnector';

import type { Context } from './Context';
import LineEvent from './LineEvent';
import DelayableJobQueue from './DelayableJobQueue';

type Options = {|
  client: LineClient,
  event: LineEvent,
  session: ?LineSession,
|};

class LineContext implements Context {
  _client: LineClient;
  _event: LineEvent;
  _session: ?LineSession;
  _jobQueue: DelayableJobQueue;
  _messageDelay: number = 1000;

  _replied: boolean = false;

  constructor({ client, event, session }: Options) {
    this._client = client;
    this._event = event;
    this._session = session;
    this._jobQueue = new DelayableJobQueue();
    this._jobQueue.beforeEach(({ delay }) => sleep(delay));
  }

  /**
   * The name of the platform.
   *
   */
  get platform(): string {
    return 'line';
  }

  /**
   * The client instance.
   *
   */
  get client(): LineClient {
    return this._client;
  }

  /**
   * The event instance.
   *
   */
  get event(): LineEvent {
    return this._event;
  }

  /**
   * The session state of the context.
   *
   */
  get session(): ?LineSession {
    return this._session;
  }

  /**
   * Determine if the reply token is already used.
   *
   */
  get replied(): boolean {
    return this._replied;
  }

  /**
   * Set delay before sending every messages.
   *
   */
  setMessageDelay(milliseconds: number): void {
    this._messageDelay = milliseconds;
  }

  /**
   * Delay and show indicators for milliseconds.
   *
   */
  async typing(milliseconds: number): Promise<void> {
    await sleep(milliseconds);
  }

  /**
   * Send text to the owner of then session.
   *
   */
  sendText(text: string): Promise<any> {
    if (!this._session) {
      warning(
        false,
        'sendText: should not be called in context without session'
      );
      return Promise.resolve();
    }
    return this._enqueue({
      instance: this._client,
      method: `pushText`,
      args: [this._session.user.id, text],
      delay: this._messageDelay,
      showIndicators: true,
    });
  }

  sendTextWithDelay(delay: number, text: string): Promise<any> {
    if (!this._session) {
      warning(
        false,
        'sendTextWithDelay: should not be called in context without session'
      );
      return Promise.resolve();
    }
    return this._enqueue({
      instance: this._client,
      method: `pushText`,
      args: [this._session.user.id, text],
      delay,
      showIndicators: true,
    });
  }

  _enqueue(job: Object): Promise<any> {
    return new Promise((resolve, reject) => {
      this._jobQueue.enqueue({
        ...job,
        onSuccess: resolve,
        onError: reject,
      });
    });
  }
}

const types = [
  'Text',
  'Image',
  'Video',
  'Audio',
  'Location',
  'Sticker',
  'Imagemap',
  'ButtonTemplate',
  'ConfirmTemplate',
  'CarouselTemplate',
  'ImageCarouselTemplate',
];
types.forEach(type => {
  Object.defineProperty(LineContext.prototype, `reply${type}`, {
    enumerable: false,
    configurable: true,
    writable: true,
    value(...args) {
      invariant(!this._replied, 'Can not reply event mulitple times');

      this._replied = true;

      return this._enqueue({
        instance: this._client,
        method: `reply${type}`,
        args: [this._event.replyToken, ...args],
        delay: this._messageDelay,
        showIndicators: true,
      });
    },
  });

  Object.defineProperty(LineContext.prototype, `push${type}`, {
    enumerable: false,
    configurable: true,
    writable: true,
    value(...args) {
      if (!this._session) {
        warning(
          false,
          `push${type}: should not be called in context without session`
        );
        return Promise.resolve();
      }
      return this._enqueue({
        instance: this._client,
        method: `push${type}`,
        args: [this._session.user.id, ...args],
        delay: this._messageDelay,
        showIndicators: true,
      });
    },
  });
});

types.filter(type => type !== 'Text').forEach(type => {
  Object.defineProperty(LineContext.prototype, `send${type}`, {
    enumerable: false,
    configurable: true,
    writable: true,
    value(...args) {
      if (!this._session) {
        warning(
          false,
          `send${type}: should not be called in context without session`
        );
        return Promise.resolve();
      }
      return this._enqueue({
        instance: this._client,
        method: `push${type}`,
        args: [this._session.user.id, ...args],
        delay: this._messageDelay,
        showIndicators: true,
      });
    },
  });

  Object.defineProperty(LineContext.prototype, `send${type}WithDelay`, {
    enumerable: false,
    configurable: true,
    writable: true,
    value(delay, ...rest) {
      warning(false, `send${type}WithDelay is deprecated.`);

      if (!this._session) {
        warning(
          false,
          `send${type}WithDelay: should not be called in context without session`
        );
        return Promise.resolve();
      }
      return this._enqueue({
        instance: this._client,
        method: `push${type}`,
        args: [this._session.user.id, ...rest],
        delay,
        showIndicators: true,
      });
    },
  });
});

export default LineContext;