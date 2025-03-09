import * as T from 'three'
import { Matrix4 } from 'three/webgpu';

export const hidden = new T.MeshToonMaterial({visible: false})
export const shades = new Uint8Array( 40 ); // How many shadedportions in the sphere
for ( let c = 0; c <= shades.length; c ++ ) {   // Make a rainbow out of the colors
    shades[ c ] = ( c /shades.length) * 256;
}
const gradientMap = new T.DataTexture( shades, shades.length, 1, T.RedFormat );
gradientMap.needsUpdate = true;
export function color( r = null, g = null, b = null) {
    if (r == null) r = Math.random() * 256;
    if (g == null) g = Math.random() * 256;
    if (b == null) b = Math.random() * 256;
    r /= 256;
    g /= 256;
    b /= 256
    let diffuseColor = new T.Color(r, g, b);
    return new T.MeshToonMaterial( {
        visible: true,
        color: diffuseColor,
        gradientMap: gradientMap
    } );
}
export const shapes = {
    ball: (rad = 5) => {return new T.SphereGeometry(rad)},
    box: (x = 1, y = 1, z = 1) => {return new T.BoxGeometry(x, y, z)},
    tube: (rad_top = 5, rad_bot = 5, height = 10) => {return new T.CylinderGeometry(
        rad_top, rad_bot, height
    )},
}

export const v3 = (x, y, z) => {return new T.Vector3(x, y, z)}
const m4 = new Matrix4;
export const identity = () => {let m = new Matrix4; return m.identity()}; 
export const translation = (x, y, z) => {
    if(x instanceof T.Vector3) return identity().makeTranslation(x.x, x.y, x.z);
    return identity().makeTranslation(x, y, z)
};

export function make_obj(model = shapes.ball(5), material = color(), matrix = identity()){
    let obj = new T.Mesh(model, material);
    obj.applyMatrix4(matrix);
    return obj;
}