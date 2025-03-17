import * as T from 'three'
import { instance } from 'three/tsl';
import { Matrix4 } from 'three/webgpu';

const hidden = new T.MeshToonMaterial({visible: false})
const shades = new Uint8Array( 40 ); // How many shadedportions in the sphere
for ( let c = 0; c <= shades.length; c ++ ) {   // Make a rainbow out of the colors
    shades[ c ] = ( c /shades.length) * 256;
}
const gradientMap = new T.DataTexture( shades, shades.length, 1, T.RedFormat );
gradientMap.needsUpdate = true;
function color( r = null, g = null, b = null) {
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
const shapes = {
    ball: (rad = 5) => {return new T.SphereGeometry(rad)},
    box: (x = 1, y = 1, z = 1) => {return new T.BoxGeometry(x, y, z)},
    tube: (rad_top = 5, rad_bot = 5, height = 10) => {return new T.CylinderGeometry(
        rad_top, rad_bot, height
    )},
}

const v3 = (x, y, z) => {return new T.Vector3(x, y, z)}
const m4 = new T.Matrix4();
const identity = () => {let m = new T.Matrix4(); return m.identity()}; 
const translation = (x, y, z) => {
    if(x instanceof T.Vector3) return identity().makeTranslation(x.x, x.y, x.z);
    return identity().makeTranslation(x, y, z)
};
const dist = (v1, v2) => {
    return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2 + (v1.z - v2.z) ** 2);
}

function make_obj(model = shapes.ball(5), material = color(), matrix = identity()){
    let obj = new T.Mesh(model, material);
    if(matrix instanceof T.Vector3) matrix = translation(matrix.x, matrix.y, matrix.z)
    obj.applyMatrix4(matrix);
    return obj;
}

function set_pos(element, x = null, y = null, z = null) {
    if(x instanceof T.Vector3) {
        element.position.x = x.x;
        element.position.y = x.y;
        element.position.z = x.z;
        return
    }

    if(x) element.position.x = x;
    if(y) element.position.y = y;
    if(z) element.position.z = z;
}

function signed_angle(v1, v2, normal) {
    let angle = v1.angleTo(v2);
    let cross = v3().crossVectors(v1, v2);
    return cross.dot(normal) < 0 ? -angle : angle;
}


export {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos, dist, signed_angle}
