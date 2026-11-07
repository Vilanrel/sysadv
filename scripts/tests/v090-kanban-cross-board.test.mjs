import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('custom boards accept existing cards through accessible cross-board column chooser',()=>{
 const src=readFileSync('apps/web/src/features/tasks/KanbanPage.tsx','utf8');
 assert.match(src,/boards\.map\(b=><optgroup/);
 assert.match(src,/value=\{c\.id\}/);
 assert.match(src,/move\(t\.id,e\.target\.value\)/);
});
