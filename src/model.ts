export type Kind='table'|'chair'|'counter'|'sink'|'fridge'|'stove'|'shelf'|'partition'|'zone';
export type Item={id:string;kind:Kind;name:string;x:number;y:number;w:number;d:number;h:number;rotation:number;color:string;locked?:boolean};
export type Project={name:string;width:number;height:number;items:Item[]};
export const catalog:{kind:Kind;name:string;w:number;d:number;h:number;color:string;group:string}[]=[
{kind:'table',name:'四人餐桌',w:1200,d:800,h:750,color:'#d9b98c',group:'餐桌椅'},
{kind:'table',name:'六人长桌',w:1800,d:800,h:750,color:'#d9b98c',group:'餐桌椅'},
{kind:'table',name:'圆餐桌',w:1200,d:1200,h:750,color:'#d9b98c',group:'餐桌椅'},
{kind:'chair',name:'餐椅',w:420,d:450,h:850,color:'#8b9aab',group:'餐桌椅'},
{kind:'chair',name:'长凳',w:1200,d:380,h:450,color:'#8b9aab',group:'餐桌椅'},
{kind:'counter',name:'自助取餐台',w:2400,d:750,h:900,color:'#8ca7a0',group:'餐饮设备'},
{kind:'counter',name:'操作工作台',w:1800,d:700,h:850,color:'#a6aeb7',group:'餐饮设备'},
{kind:'sink',name:'双槽洗手池',w:1200,d:650,h:850,color:'#91a9b7',group:'餐饮设备'},
{kind:'fridge',name:'立式冰箱',w:750,d:750,h:1950,color:'#9eb8c7',group:'厨房设备'},
{kind:'fridge',name:'冷柜',w:1200,d:700,h:850,color:'#9eb8c7',group:'厨房设备'},
{kind:'stove',name:'双头炉灶',w:1200,d:900,h:850,color:'#87919b',group:'厨房设备'},
{kind:'shelf',name:'储物货架',w:1200,d:450,h:1800,color:'#b9a58c',group:'收纳设施'},
{kind:'partition',name:'隔断',w:2000,d:100,h:1800,color:'#b7c0c8',group:'空间构件'}
];
export const uid=()=>crypto.randomUUID();
export const initial:Project={name:'新建食堂方案',width:20000,height:12000,items:[
{id:'zone-dining',kind:'zone',name:'就餐区',x:500,y:500,w:11500,d:11000,h:0,rotation:0,color:'#e9f2e9'},
{id:'zone-kitchen',kind:'zone',name:'厨房区',x:12500,y:500,w:7000,d:7000,h:0,rotation:0,color:'#f8eee2'},
{id:'zone-pickup',kind:'zone',name:'取餐区',x:12500,y:7800,w:7000,d:3700,h:0,rotation:0,color:'#e9eff8'},
{id:'t1',kind:'table',name:'四人餐桌',x:1800,y:1800,w:1200,d:800,h:750,rotation:0,color:'#d9b98c'},
{id:'t2',kind:'table',name:'四人餐桌',x:5000,y:1800,w:1200,d:800,h:750,rotation:0,color:'#d9b98c'},
{id:'t3',kind:'table',name:'四人餐桌',x:1800,y:4800,w:1200,d:800,h:750,rotation:0,color:'#d9b98c'},
{id:'c1',kind:'chair',name:'餐椅',x:1900,y:1300,w:420,d:450,h:850,rotation:0,color:'#8b9aab'},
{id:'c2',kind:'chair',name:'餐椅',x:2450,y:1300,w:420,d:450,h:850,rotation:0,color:'#8b9aab'},
{id:'k1',kind:'counter',name:'自助取餐台',x:14000,y:8500,w:2400,d:750,h:900,rotation:0,color:'#8ca7a0'},
{id:'k2',kind:'stove',name:'双头炉灶',x:14000,y:1800,w:1200,d:900,h:850,rotation:0,color:'#87919b'}
]};