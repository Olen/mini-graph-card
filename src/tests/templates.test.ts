/**
 * Tests for isTemplate() and TemplateSubscriber.
 */

import { expect, describe, it, vi } from 'vitest';
import { isTemplate, TemplateSubscriber } from '../templates';

const makeHass = () => {
  const unsubs: Array<() => void> = [];
  const sent: any[] = [];
  let push: (msg: { result: string }) => void = () => {};
  return {
    unsubs,
    sent,
    result: (value: string) => push({ result: value }),
    hass: {
      connection: {
        subscribeMessage: (cb: (msg: { result: string }) => void, msg: unknown) => {
          push = cb;
          sent.push(msg);
          const unsub = vi.fn();
          unsubs.push(unsub);
          return Promise.resolve(unsub);
        },
      },
    },
  };
};

describe('isTemplate', () => {
  it('spots both Jinja delimiters', () => {
    expect(isTemplate('{{ states("plant.x") }}')).toBe(true);
    expect(isTemplate('{% if true %}a{% endif %}')).toBe(true);
  });

  it('leaves anything else alone', () => {
    expect(isTemplate('Monstéra')).toBe(false);
    expect(isTemplate('{ not jinja }')).toBe(false);
    expect(isTemplate(undefined)).toBe(false);
    expect(isTemplate(42)).toBe(false);
  });
});

describe('TemplateSubscriber', () => {
  it('subscribes once per template and reports results', async () => {
    const env = makeHass();
    const onUpdate = vi.fn();
    const subscriber = new TemplateSubscriber(onUpdate);

    subscriber.sync(env.hass, { name: '{{ 1 }}' });
    subscriber.sync(env.hass, { name: '{{ 1 }}' });
    expect(env.sent).toHaveLength(1);
    expect(env.sent[0]).toEqual({ type: 'render_template', template: '{{ 1 }}' });

    env.result('Monstéra');
    expect(subscriber.results.name).toBe('Monstéra');
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // an unchanged result must not trigger a re-render
    env.result('Monstéra');
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('resubscribes when a template is edited', async () => {
    const env = makeHass();
    const subscriber = new TemplateSubscriber(() => {});
    subscriber.sync(env.hass, { name: '{{ 1 }}' });
    await Promise.resolve();
    subscriber.sync(env.hass, { name: '{{ 2 }}' });

    expect(env.unsubs[0]).toHaveBeenCalled();
    expect(env.sent).toHaveLength(2);
  });

  it('drops a template that is gone, and its result with it', async () => {
    const env = makeHass();
    const subscriber = new TemplateSubscriber(() => {});
    subscriber.sync(env.hass, { name: '{{ 1 }}' });
    await Promise.resolve();
    env.result('Monstéra');

    subscriber.sync(env.hass, {});
    expect(env.unsubs[0]).toHaveBeenCalled();
    expect(subscriber.results.name).toBeUndefined();
  });

  it('cancels a subscription that resolves after it was dropped', async () => {
    const env = makeHass();
    const subscriber = new TemplateSubscriber(() => {});
    subscriber.sync(env.hass, { name: '{{ 1 }}' });
    // destroyed before subscribeMessage's promise settles
    subscriber.destroy();
    await Promise.resolve();
    await Promise.resolve();

    expect(env.unsubs[0]).toHaveBeenCalled();
  });

  it('does nothing without a connection', () => {
    const subscriber = new TemplateSubscriber(() => {});
    expect(() => subscriber.sync(undefined, { name: '{{ 1 }}' })).not.toThrow();
    expect(() => subscriber.sync({}, { name: '{{ 1 }}' })).not.toThrow();
    expect(subscriber.results).toEqual({});
  });
});
