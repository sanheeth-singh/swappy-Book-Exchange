import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
test('slider input events and adjustment buttons update the displayed handovers', async () => {
 const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://127.0.0.1:3000' });
 Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
 const { createElement, act } = await import('react');
 const { createRoot } = await import('react-dom/client');
 const { ReuseSlider } = await import('../src/features/landing/components/reuse-slider');
 const container = document.getElementById('root')!; const root = createRoot(container);
 try {
  await act(async () => root.render(createElement(ReuseSlider)));
  const range = container.querySelector('input[type="range"]') as HTMLInputElement;
  await act(async () => { range.value = '9'; range.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  assert.equal(container.querySelector('output')?.textContent, '9');
  assert.deepEqual([...container.querySelectorAll('.reuse-metrics strong')].map((node) => node.textContent), ['9', '18']);
  await act(async () => (container.querySelector('[aria-label="More exchanges"]') as HTMLButtonElement).click());
  assert.equal(container.querySelector('output')?.textContent, '10');
  await act(async () => { range.value = '1'; range.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  assert.equal((container.querySelector('[aria-label="Fewer exchanges"]') as HTMLButtonElement).disabled, true);
 } finally { await act(async () => root.unmount()); dom.window.close(); }
});
