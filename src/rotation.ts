export const normalizeRotation=(angle:number)=>{const value=angle%360;return value<0?value+360:value===0?0:value};
