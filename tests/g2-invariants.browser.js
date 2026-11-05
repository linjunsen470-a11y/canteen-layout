// Data-bearing G2 regressions: shared selection, wall ownership and visibility JSON.
export default async function checkEditorInvariants(){
  const {useStore}=await import('/src/store.ts');
  const {blankProject}=await import('/src/model.ts');
  const {parseProject}=await import('/src/projectIO.ts');
  const {isVisible,isEditable}=await import('/src/editorInteraction.ts');
  const {attachOpening}=await import('/src/structure.ts');
  const s=()=>useStore.getState(),checks=[];
  const ok=(value,label)=>{if(!value)throw Error(label);checks.push(label)};
  s().setProject({...blankProject('G2 墙窗合成回归'),items:[
    {id:'wall',name:'验收墙',kind:'wall',x:1000,y:3000,w:5000,d:200,h:2800,rotation:20,color:'#dddcd3'},
    {id:'door',name:'验收门',kind:'door',x:0,y:0,w:900,d:200,h:2100,rotation:0,color:'#b59a75',wallId:'wall',offset:600,sill:0},
    {id:'table',name:'验收桌',kind:'table',x:6000,y:6000,w:1200,d:800,h:750,rotation:0,color:'#d9b98c'},
  ]});
  s().selectMany(['wall','door','missing','wall']);ok(s().selectedIds.join(',')==='wall,door'&&s().selected==='door','选择去重并过滤不存在的 ID');
  const before=structuredClone(s().project),door=()=>s().project.items.find(i=>i.id==='door');
  s().update('wall',{x:2000});ok(Math.abs(door().x-before.items[1].x-1000)<.001,'移动墙体仍同步门窗');
  s().undo();ok(door().x===before.items[1].x&&s().selectedIds.length===0,'撤销同步恢复墙窗与选择');
  s().setFlags(['wall'],{hidden:true});ok(!isVisible(door(),s().project)&&!isEditable(door(),s().project),'隐藏墙体同时隐藏并保护从属门窗');
  const parsed=parseProject(JSON.parse(JSON.stringify(s().project)));ok(parsed.items[0].hidden===true,'显隐状态 JSON 往返保留');
  let refused=false;try{attachOpening(s().project,{...door(),id:'new-door'},{x:2000,y:3000})}catch{refused=true}ok(refused,'新增门窗不会吸附隐藏墙体');
  s().setFlags(['wall'],{hidden:false,locked:true});ok(!isEditable(door(),s().project),'所属墙体锁定阻止编辑门窗');
  s().removeMany(['door']);ok(!!door(),'Delete 不误删锁定墙体的门窗');
  s().setFlags(['wall'],{locked:false});s().selectMany(['wall','table']);
  const snapshot=JSON.stringify(s().project);
  s().updateMany([{id:'wall',patch:{w:700}},{id:'table',patch:{w:700}}]);
  ok(!!s().error&&JSON.stringify(s().project)===snapshot,'关联尺寸不合法时整批拒绝，无部分写入');
  s().selectMany(['table']);s().beginMove();s().move('table',{x:8500});s().cancelInteraction();
  ok(!s().gesture&&s().project.items.find(i=>i.id==='table').x===6000,'统一取消回退正在进行的事务');
  s().setProject(blankProject('切换后的空白方案'));ok(!s().selected&&s().selectedIds.length===0&&s().tool==='select','切换项目清空选择和临时工具');
  return checks;
}
