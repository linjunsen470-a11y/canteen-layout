import { Component, ReactNode } from 'react';
import { useWorkspace } from './workspace';
export default class SceneBoundary extends Component<{children:ReactNode},{failed:boolean;attempt:number}>{
 state={failed:false,attempt:0};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="scene-fallback" role="alert"><b>三维暂时无法显示</b><p>二维编辑、保存及平面导出仍可使用。</p><button onClick={()=>this.setState(s=>({failed:false,attempt:s.attempt+1}))}>重试三维</button><button onClick={()=>useWorkspace.getState().set({view:'2d'})}>继续二维编辑</button></div>:<div className="scene-boundary" key={this.state.attempt}>{this.props.children}</div>}
}
