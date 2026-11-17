import assert from 'node:assert/strict';
const rule = '.dmo-group>.dmo-row>.dmo-select{padding-left:2px;padding-right:14px}';
const measure = row => row.evaluate(el => {
  const rect = node => { const r=node.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
  const select=el.querySelector('.dmo-select');
  return {row:rect(el),hit:rect(select),icon:rect(el.querySelector('.dmo-icon')),text:rect(el.querySelector('.dmo-copy')),paddingLeft:getComputedStyle(select).paddingLeft,paddingRight:getComputedStyle(select).paddingRight};
});
const apply = async(page, css) => {
  await page.locator('style[data-plugin="dsh-model-shelf"]').evaluate((style,text)=>style.textContent=text,css);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
};
export async function assertShelfGeometry(page) {
  const style=await page.locator('style[data-plugin="dsh-model-shelf"]').textContent();
  assert.equal(style.split(rule).length-1,1);const baseline=style.replace(rule,'');const group=page.locator('.dmo-group').first(),row=group.locator('.dmo-row').first();
  const result={};
  try {
    await apply(page,baseline);result.before=await measure(row);await apply(page,style);result.after=await measure(row);
    assert.equal(result.before.paddingLeft,'8px');assert.equal(result.before.paddingRight,'8px');
    assert.equal(result.after.paddingLeft,'2px');assert.equal(result.after.paddingRight,'14px');
    for(const part of ['icon','text'])assert.ok(Math.abs(result.after[part].x-result.before[part].x+6)<0.05,part+' moves exactly 6px');
    assert.deepEqual(result.after.hit,result.before.hit);assert.equal(result.after.row.height,result.before.row.height);assert.equal(result.after.text.width,result.before.text.width);
    await group.locator('.dmo-group-heading').click();await apply(page,baseline);const before=await group.boundingBox();await apply(page,style);assert.deepEqual(await group.boundingBox(),before);await group.locator('.dmo-group-heading').click();
    result.hitBoxRowHeightTextWidthAndCollapsedUnchanged=true;return result;
  } finally {await apply(page,style);}
}
export async function assertFlatFavoritesUnchanged(page) {
  const style=await page.locator('style[data-plugin="dsh-model-shelf"]').textContent(),row=page.locator('.dmo-list > .dmo-row').first();
  try {await apply(page,style.replace(rule,''));const before=await measure(row);await apply(page,style);assert.deepEqual(await measure(row),before);assert.equal(before.paddingLeft,'8px');assert.equal(before.paddingRight,'8px');}
  finally {await apply(page,style);}
}
