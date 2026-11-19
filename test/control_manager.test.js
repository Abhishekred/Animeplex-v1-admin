import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_CONTROLS, PLAYER_IDS, DEFAULT_PLAYER_LAYOUT, cleanPlayerLayout,
  hiddenPlayerControls, movePlayerControl, reorderPlayerControl,
  validatePlayerLayout, REGION_CODES } from '../src/control_manager.js';

test('control registry matches 16 app controls, pinned More stays visible', () => {
  assert.equal(PLAYER_CONTROLS.length,16);
  assert.equal(new Set(PLAYER_IDS).size,16);
  assert.deepEqual(cleanPlayerLayout(DEFAULT_PLAYER_LAYOUT),DEFAULT_PLAYER_LAYOUT);
  assert.equal(hiddenPlayerControls(DEFAULT_PLAYER_LAYOUT).length,6);
});
test('moving controls preserves uniqueness and top limit', () => {
  const moved=movePlayerControl(DEFAULT_PLAYER_LAYOUT,'sources','top');
  assert.deepEqual(moved.top,['cast','info','sources']);
  assert.equal(moved.left.includes('sources'),false);
  assert.equal(validatePlayerLayout(moved),true);
  const hidden=movePlayerControl(moved,'sources','hidden');
  assert.equal(hiddenPlayerControls(hidden).includes('sources'),true);
  assert.equal(movePlayerControl(hidden,'more','hidden').left.includes('more'),true);
});
test('reordering changes only requested lane', () => {
  const result=reorderPlayerControl(DEFAULT_PLAYER_LAYOUT,'quality',-1);
  assert.deepEqual(result.left,['speed','quality','tracks','sources','more']);
  assert.deepEqual(result.right,DEFAULT_PLAYER_LAYOUT.right);
});
test('malformed duplicate and oversize layouts are sanitised', () => {
  const raw={top:['cast','cast','info','speed','tracks','sources','episodes'],
    left:['cast','bad'],right:[]};
  const safe=cleanPlayerLayout(raw);
  assert.ok(safe.top.length<=5);
  assert.ok(safe.left.includes('more'));
  assert.equal(new Set([...safe.top,...safe.left,...safe.right]).size,
    [...safe.top,...safe.left,...safe.right].length);
  assert.equal(validatePlayerLayout(raw),false);
});
test('region picker has supported ISO codes, including IN', () => {
  assert.equal(REGION_CODES.length,20);
  assert.ok(REGION_CODES.includes('IN'));
  assert.ok(REGION_CODES.every(x=>/^[A-Z]{2}$/.test(x)));
});
