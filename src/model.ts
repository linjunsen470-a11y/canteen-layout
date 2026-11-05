export type Kind='table'|'chair'|'counter'|'sink'|'fridge'|'stove'|'shelf'|'partition'|'wall'|'door'|'window'|'stairs'|'text'|'dimension'|'leader'|'zone'|'column'|'fixture'|'utility';
export type ModelVariant='column'|'fixture'|'utility'|'stairs'|'rect-table'|'round-table'|'chair'|'bench'|'buffet'|'worktable'|'sink'|'upright-fridge'|'chest-freezer'|'stove'|'shelf'|'partition'|'wall'|'door'|'window'|'bar-table'|'beverage'|'bin'|'cabinet'|'cart'|'cashier'|'coffee-machine'|'dishwasher'|'display-counter'|'fixed-window'|'fold-table'|'fryer'|'glass-fridge'|'glass-partition'|'griddle'|'handwash'|'hood'|'ice-maker'|'induction'|'locker'|'microwave'|'noodle-cooker'|'oven'|'return-counter'|'rice-cooker'|'salad-counter'|'single-sink'|'slat-partition'|'sofa'|'steamer'|'sterilizer'|'stool'|'tray-cart'|'tray-rack'|'triple-sink'|'undercounter-fridge'|'waiting-bench'|'wall-shelf'|'water-boiler'|'wok';
export type Item={id:string;model?:ModelVariant;kind:Kind;name:string;x:number;y:number;w:number;d:number;h:number;rotation:number;color:string;locked?:boolean;hidden?:boolean;fontSize?:number;zoneId?:string;wallId?:string;offset?:number;sill?:number;flipped?:boolean;freeStanding?:boolean;polygon?:Point[];pointType?:'entrance'|'exhaust'|'water'|'drain'|'power';verification?:'pending'|'confirmed';notes?:string;seats?:number;supportId?:string;measure?:{a:string;b:string;distance:number}};
export type ProjectMetadata={customer:string;site:string;purpose:string;notes:string;propertyId?:string;inquiryId?:string};
export type Point={x:number;y:number};
export type Underlay={assetId:string;name:string;pixelWidth:number;pixelHeight:number;x:number;y:number;mmPerPixel:number;rotation:number;opacity:number;hidden:boolean;locked:boolean;calibration?:{points:[Point,Point];distance:number}};
export type PlanningArea={id:string;name:string;color:string;outline:Point[]};
export type LayoutGroup={id:string;name:string;members:string[];seats?:number};
export type Project={id:string;schemaVersion:6;createdAt:string;updatedAt:string;metadata:ProjectMetadata;name:string;width:number;height:number;outline?:Point[];items:Item[];underlay?:Underlay;planningAreas?:PlanningArea[];groups?:LayoutGroup[];clearance?:number};
export function projectIdentity() { const now=new Date().toISOString(); return {id:crypto.randomUUID(),schemaVersion:6 as const,createdAt:now,updatedAt:now,metadata:{customer:'',site:'',purpose:'',notes:''}}; }
export function blankProject(name='未命名方案'):Project { return {...projectIdentity(),name,width:20000,height:12000,items:[]}; }
export const catalog:{id?:string;model?:ModelVariant;kind:Kind;name:string;w:number;d:number;h:number;color:string;group:string;seats?:number}[]=[
{kind:'column',model:'column',name:'矩形柱体',w:600,d:600,h:2800,color:'#a2aaa4',group:'现场设施'},
{kind:'fixture',model:'fixture',name:'固定设施',w:1200,d:800,h:1000,color:'#9babb3',group:'现场设施'},
{kind:'utility',model:'utility',name:'工程点位',w:400,d:400,h:80,color:'#3f819b',group:'现场设施'},
{kind:'stairs',model:'stairs',name:'直跑楼梯',w:1200,d:3600,h:2400,color:'#b2b7ae',group:'空间构件'},
{kind:'table',model:'rect-table',name:'四人餐桌',w:1200,d:800,h:750,color:'#d9b98c',group:'餐桌椅'},
{kind:'table',model:'rect-table',name:'六人长桌',w:1800,d:800,h:750,color:'#d9b98c',group:'餐桌椅'},
{kind:'table',model:'round-table',name:'圆餐桌',w:1200,d:1200,h:750,color:'#d9b98c',group:'餐桌椅'},
{kind:'chair',model:'chair',seats:1,name:'餐椅',w:420,d:450,h:850,color:'#8b9aab',group:'餐桌椅'},
{kind:'chair',model:'bench',name:'长凳',w:1200,d:380,h:450,color:'#8b9aab',group:'餐桌椅'},
{kind:'counter',model:'buffet',name:'自助取餐台',w:2400,d:750,h:900,color:'#8ca7a0',group:'餐饮设备'},
{kind:'counter',model:'worktable',name:'操作工作台',w:1800,d:700,h:850,color:'#a6aeb7',group:'餐饮设备'},
{kind:'sink',model:'sink',name:'双槽洗手池',w:1200,d:650,h:850,color:'#91a9b7',group:'餐饮设备'},
{kind:'fridge',model:'upright-fridge',name:'立式冰箱',w:750,d:750,h:1950,color:'#9eb8c7',group:'厨房设备'},
{kind:'fridge',model:'chest-freezer',name:'冷柜',w:1200,d:700,h:850,color:'#9eb8c7',group:'厨房设备'},
{kind:'stove',model:'stove',name:'双头炉灶',w:1200,d:900,h:850,color:'#87919b',group:'厨房设备'},
{kind:'shelf',model:'shelf',name:'储物货架',w:1200,d:450,h:1800,color:'#b9a58c',group:'收纳设施'},
{kind:'wall',model:'wall',name:'墙体',w:4000,d:200,h:2800,color:'#dddcd3',group:'空间构件'},
{kind:'door',model:'door',name:'单开门',w:900,d:200,h:2100,color:'#b59a75',group:'空间构件'},
{kind:'window',model:'window',name:'推拉窗',w:1500,d:200,h:1200,color:'#7d919b',group:'空间构件'},
{kind:'partition',model:'partition',name:'隔断',w:2000,d:100,h:1800,color:'#b7c0c8',group:'空间构件'},
{"kind": "table", "model": "rect-table", "name": "双人方桌", "w": 800, "d": 800, "h": 750, "color": "#cfb18a", "group": "餐桌椅"},
{"kind": "table", "model": "rect-table", "name": "八人长桌", "w": 2400, "d": 900, "h": 750, "color": "#bd9569", "group": "餐桌椅"},
{"kind": "table", "model": "round-table", "name": "八人圆桌", "w": 1800, "d": 1800, "h": 750, "color": "#c7a477", "group": "餐桌椅"},
{"kind": "table", "model": "bar-table", "name": "靠窗吧台桌", "w": 1800, "d": 450, "h": 1050, "color": "#b9956d", "group": "餐桌椅"},
{"kind": "table", "model": "fold-table", "name": "折叠培训桌", "w": 1500, "d": 600, "h": 740, "color": "#d0b58e", "group": "餐桌椅"},
{"kind": "table", "model": "round-table", "name": "双人洽谈圆桌", "w": 700, "d": 700, "h": 730, "color": "#d8c9ad", "group": "餐桌椅"},
{"kind": "chair", "model": "stool", "seats": 1, "name": "吧台高脚凳", "w": 420, "d": 420, "h": 750, "color": "#82735d", "group": "餐桌椅"},
{"kind": "chair", "model": "chair", "name": "塑料餐椅", "w": 460, "d": 500, "h": 820, "color": "#b3bca3", "group": "餐桌椅"},
{"kind": "chair", "model": "sofa", "name": "双人卡座沙发", "w": 1200, "d": 650, "h": 950, "color": "#5b796d", "group": "餐桌椅"},
{"kind": "chair", "model": "waiting-bench", "name": "三人等候排椅", "w": 1800, "d": 600, "h": 850, "color": "#718c9b", "group": "餐桌椅"},
{"kind": "counter", "model": "cashier", "name": "收银台", "w": 1200, "d": 650, "h": 1100, "color": "#b0a18c", "group": "餐饮服务"},
{"kind": "counter", "model": "return-counter", "name": "餐具回收台", "w": 1500, "d": 750, "h": 900, "color": "#aebbb9", "group": "餐饮服务"},
{"kind": "shelf", "model": "tray-rack", "name": "托盘餐具架", "w": 900, "d": 500, "h": 1400, "color": "#b7c2c4", "group": "餐饮服务"},
{"kind": "counter", "model": "worktable", "name": "调味料台", "w": 1200, "d": 500, "h": 900, "color": "#b3b9ac", "group": "餐饮服务"},
{"kind": "counter", "model": "beverage", "name": "双缸饮料机", "w": 600, "d": 450, "h": 700, "color": "#cfb88b", "group": "餐饮服务"},
{"kind": "counter", "model": "display-counter", "name": "玻璃展示柜", "w": 1500, "d": 700, "h": 1300, "color": "#9caeaa", "group": "餐饮服务"},
{"kind": "stove", "model": "steamer", "name": "双门蒸饭柜", "w": 1400, "d": 800, "h": 1600, "color": "#b7c3c9", "group": "热厨设备"},
{"kind": "stove", "model": "oven", "name": "双层烤箱", "w": 1200, "d": 850, "h": 1300, "color": "#a3b3bd", "group": "热厨设备"},
{"kind": "stove", "model": "fryer", "name": "双缸电炸炉", "w": 800, "d": 700, "h": 900, "color": "#a7b4bd", "group": "热厨设备"},
{"kind": "stove", "model": "griddle", "name": "煎扒炉", "w": 900, "d": 700, "h": 900, "color": "#aab7b9", "group": "热厨设备"},
{"kind": "stove", "model": "noodle-cooker", "name": "六孔煮面炉", "w": 900, "d": 700, "h": 900, "color": "#b0bdc2", "group": "热厨设备"},
{"kind": "stove", "model": "wok", "name": "单头大锅灶", "w": 1100, "d": 1100, "h": 1000, "color": "#aab6bb", "group": "热厨设备"},
{"kind": "stove", "model": "hood", "name": "落地式排烟罩组件", "w": 2400, "d": 1100, "h": 2400, "color": "#aab5b8", "group": "热厨设备"},
{"kind": "stove", "model": "induction", "name": "双头电磁灶", "w": 1200, "d": 750, "h": 850, "color": "#a3b4bc", "group": "热厨设备"},
{"kind": "fridge", "model": "glass-fridge", "name": "玻璃门饮料柜", "w": 1200, "d": 700, "h": 2000, "color": "#667e89", "group": "冷藏冷冻"},
{"kind": "fridge", "model": "undercounter-fridge", "name": "冷藏操作台", "w": 1800, "d": 750, "h": 800, "color": "#a4b8bf", "group": "冷藏冷冻"},
{"kind": "fridge", "model": "ice-maker", "name": "商用制冰机", "w": 700, "d": 700, "h": 1200, "color": "#b0c1c6", "group": "冷藏冷冻"},
{"kind": "fridge", "model": "salad-counter", "name": "沙拉冷藏展示台", "w": 1500, "d": 750, "h": 1200, "color": "#9eafb2", "group": "冷藏冷冻"},
{"kind": "sink", "model": "single-sink", "name": "单槽洗涤池", "w": 700, "d": 650, "h": 850, "color": "#a6b7c0", "group": "洗消设备"},
{"kind": "sink", "model": "triple-sink", "name": "三槽洗涤池", "w": 1800, "d": 650, "h": 850, "color": "#a6b7c0", "group": "洗消设备"},
{"kind": "sink", "model": "handwash", "name": "立柱洗手盆", "w": 500, "d": 450, "h": 850, "color": "#cad6d4", "group": "洗消设备"},
{"kind": "sink", "model": "dishwasher", "name": "揭盖式洗碗机", "w": 700, "d": 800, "h": 1450, "color": "#a4b6bf", "group": "洗消设备"},
{"kind": "shelf", "model": "sterilizer", "name": "双门消毒柜", "w": 1200, "d": 650, "h": 1800, "color": "#9caeb9", "group": "洗消设备"},
{"kind": "shelf", "model": "cart", "name": "三层送餐推车", "w": 900, "d": 600, "h": 950, "color": "#b3c1c1", "group": "收纳保洁"},
{"kind": "shelf", "model": "tray-cart", "name": "插盘推车", "w": 600, "d": 700, "h": 1700, "color": "#abbcc1", "group": "收纳保洁"},
{"kind": "shelf", "model": "bin", "name": "脚踏垃圾桶", "w": 450, "d": 450, "h": 650, "color": "#78918b", "group": "收纳保洁"},
{"kind": "shelf", "model": "locker", "name": "六门更衣柜", "w": 900, "d": 500, "h": 1800, "color": "#9aaea4", "group": "收纳保洁"},
{"kind": "shelf", "model": "cabinet", "name": "双门储物柜", "w": 1200, "d": 600, "h": 1800, "color": "#aab4a2", "group": "收纳保洁"},
{"kind": "shelf", "model": "wall-shelf", "name": "双层台上置物架", "w": 1200, "d": 350, "h": 700, "color": "#abb9b9", "group": "收纳保洁"},
{"kind": "counter", "model": "water-boiler", "name": "立式开水器", "w": 550, "d": 500, "h": 1400, "color": "#a4b9bf", "group": "小型设备"},
{"kind": "counter", "model": "coffee-machine", "name": "商用咖啡机", "w": 700, "d": 550, "h": 600, "color": "#536b70", "group": "小型设备"},
{"kind": "counter", "model": "microwave", "name": "微波炉", "w": 550, "d": 450, "h": 350, "color": "#879ba5", "group": "小型设备"},
{"kind": "counter", "model": "rice-cooker", "name": "商用电饭煲", "w": 550, "d": 550, "h": 500, "color": "#b5c1bd", "group": "小型设备"},
{"kind": "partition", "model": "glass-partition", "name": "玻璃隔断", "w": 2000, "d": 100, "h": 2100, "color": "#7f9b9e", "group": "空间构件"},
{"kind": "partition", "model": "slat-partition", "name": "木格栅隔断", "w": 1800, "d": 120, "h": 2000, "color": "#b28e60", "group": "空间构件"},
{"kind": "window", "model": "fixed-window", "name": "固定玻璃窗", "w": 1200, "d": 200, "h": 1000, "color": "#698793", "group": "空间构件"}
];
export const uid=()=>crypto.randomUUID();
export const initial:Project={...projectIdentity(),name:'食堂示例方案',width:20000,height:12000,items:[
{id:'zone-dining',kind:'zone',name:'就餐区',x:500,y:500,w:11500,d:11000,h:0,rotation:0,color:'#e9f2e9'},
{id:'zone-kitchen',kind:'zone',name:'厨房区',x:12500,y:500,w:7000,d:7000,h:0,rotation:0,color:'#f8eee2'},
{id:'zone-pickup',kind:'zone',name:'取餐区',x:12500,y:7800,w:7000,d:3700,h:0,rotation:0,color:'#e9eff8'},
{id:'t1',kind:'table',model:'rect-table',name:'四人餐桌',x:1800,y:1800,w:1200,d:800,h:750,rotation:0,color:'#d9b98c'},
{id:'t2',kind:'table',model:'rect-table',name:'四人餐桌',x:5000,y:1800,w:1200,d:800,h:750,rotation:0,color:'#d9b98c'},
{id:'t3',kind:'table',model:'rect-table',name:'四人餐桌',x:1800,y:4800,w:1200,d:800,h:750,rotation:0,color:'#d9b98c'},
{id:'c1',kind:'chair',model:'chair',seats:1,name:'餐椅',x:1900,y:1300,w:420,d:450,h:850,rotation:0,color:'#8b9aab'},
{id:'c2',kind:'chair',model:'chair',seats:1,name:'餐椅',x:2450,y:1300,w:420,d:450,h:850,rotation:0,color:'#8b9aab'},
{id:'k1',kind:'counter',model:'buffet',name:'自助取餐台',x:14000,y:8500,w:2400,d:750,h:900,rotation:0,color:'#8ca7a0'},
{id:'k2',kind:'stove',model:'stove',name:'双头炉灶',x:14000,y:1800,w:1200,d:900,h:850,rotation:0,color:'#87919b'}
]};
export function modelOf(item: {kind:Kind;name:string;model?:ModelVariant}):ModelVariant {
 return item.model ?? catalog.find(c=>c.name===item.name)?.model ?? ({column:'column',fixture:'fixture',utility:'utility',table:'rect-table',chair:'chair',counter:'worktable',sink:'sink',fridge:'upright-fridge',stove:'stove',shelf:'shelf',partition:'partition',zone:'partition',wall:'wall',door:'door',window:'window',stairs:'stairs',text:'partition',dimension:'partition',leader:'partition'} as const)[item.kind];
}
