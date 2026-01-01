/** @jest-environment jsdom */
const path = require('path');
const isogram = require(path.resolve(__dirname, '../../.vscode/isogram.js'));

describe('isogram.js exports', () => {
  test('module loads without throwing', () => {
    expect(typeof isogram).toBe('object');
  });
});
