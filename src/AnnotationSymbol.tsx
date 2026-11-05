import { Item } from './model';
export default function AnnotationSymbol({item:i,selected,scale}:{item:Item;selected:boolean;scale:number}){
 const font=i.fontSize??180,stroke=selected?'#b67523':i.color;
 return <g fill={i.color} stroke={stroke} strokeWidth={1/scale}>
  <rect data-ui={selected?true:undefined} x={-i.w/2} y={-i.d/2} width={i.w} height={i.d} fill="transparent" stroke={selected?'#b67523':'none'} strokeDasharray={selected?`${4/scale} ${3/scale}`:undefined}/>
  {i.kind==='text'?i.name.split('\n').map((line,k)=><text key={k} x={-i.w/2} y={-i.d/2+font*(k+1)} fontSize={font} stroke="none">{line}</text>):i.kind==='dimension'?<>
   <path d={`M ${-i.w/2} 0 V ${i.d/2+font/3} M ${i.w/2} 0 V ${i.d/2+font/3} M ${-i.w/2} ${i.d/2} H ${i.w/2}`} fill="none"/>
   <path d={`M ${-i.w/2-font/4} ${i.d/2+font/4} l ${font/2} ${-font/2} M ${i.w/2-font/4} ${i.d/2+font/4} l ${font/2} ${-font/2}`} fill="none"/>
   <text textAnchor="middle" y={i.d/2-font/3} fontSize={font} stroke="none">{i.name==='尺寸'?'':i.name+' '}{Math.round((i.measure?.distance??i.w)*10)/10} mm</text>
  </>:<>
   <path d={`M ${-i.w/2} 0 H ${i.w/2} v ${-i.d/2}`} fill="none"/>
   <path d={`M ${-i.w/2} 0 l ${font/2} ${-font/4} v ${font/2} Z`} stroke="none"/>
   <text x={i.w/2} y={-i.d/2-font/3} textAnchor="end" fontSize={font} stroke="none">{i.name}</text>
  </>}
 </g>;
}
