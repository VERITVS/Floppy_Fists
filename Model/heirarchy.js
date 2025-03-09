import * as T from 'three';
import { Object3D, Matrix4 } from 'three/webgpu';

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

const v3 = (x, y, z) => {return new T.Vector3(x, y, z)}
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

export class Node {
    constructor(parent, scene) {
        this.parent = parent;
        this.model = [];
        // this.matrix = [];
        this.material = [];
        this.shape_count = 0

        this.core = new T.Mesh(shapes.ball(5), hidden)
        this.scene = scene;


        if(parent === this.scene || parent === null) this.scene.add(this.core);   
        else if (parent instanceof Node) this.parent.core.add(this.core);
        else if (parent instanceof Arc) {
            this.parent.node.core.add(this.core);
            console.log("Parent is Arc")
        
        };

    }

    init() {
    }

    set_pos(x, y, z) {
        set_pos(this.core, x, y, z);
    }

    set_mat(Mat4 = identity()) {
        this.core.matrix = Mat4;
    }

    add_shape(model = shapes.ball(5), material = color(), matrix = identity()) {
        // Adds Local Matrix
        let obj = new T.Mesh(model, material);
        this.model.push(obj);
        this.model[this.shape_count].applyMatrix4(matrix);
        this.core.add(this.model[this.shape_count])

        this.shape_count += 1;
    }

    look_at(x = 0, y = 0, z = 0) {
        if(x instanceof T.Vector3) this.core.lookAt(x);
        else this.core.lookAt(x, y, z);
    }

    global() { // Returns Core Matrix in World Basis
        return this.core.matrixWorld;
    }

    local() {
        return this.core.matrix;
    }
}

export class Arc {
    constructor(id, scene, location = identity(), parent = null) {
        this.id = id;
        this.parent = parent;
        if(parent) this.parent.children.push(this);

        this.scene = scene;
        this.children = [];
        this.node = new Node(parent, this.scene);
        // this.node.set_pos(location[3], location[7], location[11])
        this.node.core.applyMatrix4(location)
        this.loc_matrix = translation(location.elements[3], location.elements[7], location.elements[11]);     // Local Location matrix
        this.art_matrix = identity();   // Articulation Matrix
        this.is_dof = {
            Tx: false, Ty: false, Tz: false,
            Rx: true, Ry: true, Rz: true
        }
        this.dof = { Rx: 0, Ry: 0, Rz: 0};
    }

    get_prod_matrix() {
        if(this.parent) {
            return this.parent.get_prod_matrix()
                .times(this.loc_matrix)
                .times(this.art_matrix);
        }

        if(this.parent === null) {
            return this.loc_matrix.times(this.art_matrix);
        }
    }

    get_global_position() {
        let global = this.node.core.matrixWorld.elements;

        let x = global[3];
        let y = global[7];
        let z = global[11];

        return v3(x, y, z);
    }

    // rot_matrix(id, Rx, Ry, Rz) {
    //     // Backtraces through parent matrices to get matrix
    //     // Rotate ID by step_size along x, y, z axis
    //     const rot_x = identity().makeRotationX(this.dof.Rx + Rx)
    //     const rot_y = identity().makeRotationY(this.dof.Ry + Ry)
    //     const rot_z = identity().makeRotationZ(this.dof.Rz + Rz)
    //     const predict_art_matrix = identity()
    //     .premultiply(rot_x)
    //     .premultiply(rot_y)
    //     .premultiply(rot_z)

    //     console.log('PREDICT', predict_art_matrix)

    //     if(this.parent) {
    //         if(this.id === id)
    //             return this.parent.rot_matrix(id, Rx, Ry, Rz)
    //                 .multiply(this.loc_matrix)
    //                 .multiply(predict_art_matrix);


    //         return this.parent.rot_matrix(id, Rx, Ry, Rz)
    //             .multiply(this.loc_matrix)
    //             .multiply(this.art_matrix);
    //     }
    //     else {
    //         if(this.id === id)
    //             return this.loc_matrix.multiply(predict_art_matrix)
    //         else
    //             return this.loc_matrix.multiply(this.art_matrix);
    //     }
    // }

    rot_matrix(id, Rx, Ry, Rz) {
        const rot_x = identity().makeRotationX(this.dof.Rx + Rx);
        const rot_y = identity().makeRotationY(this.dof.Ry + Ry);
        const rot_z = identity().makeRotationZ(this.dof.Rz + Rz);
        const predict_art_matrix = identity()
            .premultiply(rot_x)
            .premultiply(rot_y)
            .premultiply(rot_z);

            console.log("Inputs to rot_matrix:", { id, Rx, Ry, Rz });
            console.log("predict_art_matrix:", predict_art_matrix);

        if (this.parent) {
            if (this.id === id)
                return this.parent.rot_matrix(id, Rx, Ry, Rz)
                    .premultiply(this.loc_matrix)
                    .premultiply(predict_art_matrix);
    
            return this.parent.rot_matrix(id, Rx, Ry, Rz)
                .premultiply(this.loc_matrix)
                .premultiply(this.art_matrix);
        } else {
            if (this.id === id)
                return this.loc_matrix.premultiply(predict_art_matrix);
            else
                return this.loc_matrix.premultiply(this.art_matrix);
        }
    }

    set_dof( rx = false, ry = false, rz = false, tx = false, ty = false, tz = false,) {
        this.is_dof.Rx = rx;
        this.is_dof.Ry = ry;
        this.is_dof.Rz = rz;
    }

    set_articulation(theta, id = this.id) {
        if (this.id !== id) {
            if (this.parent) return this.parent.inc_articulation(theta, id);
            else return;
        }
    
        let core_pos = this.node.core.position.clone();
        let trans_to_origin = identity().makeTranslation(-core_pos.x, -core_pos.y, -core_pos.z);
        
        this.art_matrix = identity();
        let index = 0;
        if (this.is_dof.Rx) {
            this.art_matrix.premultiply(identity().makeRotationX(theta[index] - this.dof.Rx));
            this.dof.Rx = theta[index];
            index += 1;
        }
        if (this.is_dof.Ry) {
            this.art_matrix.premultiply(identity().makeRotationY(theta[index] - this.dof.Ry));
            this.dof.Ry = theta[index];
            index += 1;
        }
        if (this.is_dof.Rz) {
            this.art_matrix.premultiply(identity().makeRotationZ(theta[index] - this.dof.Rz));
            this.dof.Rz = theta[index];
            index += 1;
        }

        let trans_back = identity().makeTranslation(core_pos.x, core_pos.y, core_pos.z);    
        let trans_final = trans_back.multiply(this.art_matrix).multiply(trans_to_origin);
        this.art_matrix = trans_final;    
        this.node.core.applyMatrix4(trans_final);
    }
    

    inc_articulation(theta, id = this.id) {
        if (this.id !== id) {
            if (this.parent) return this.parent.inc_articulation(theta, id);
            else return;
        }
    
        let core_pos = this.node.core.position.clone();
        let trans_to_origin = identity().makeTranslation(-core_pos.x, -core_pos.y, -core_pos.z);
        
        this.art_matrix = identity();
        let index = 0;
        if (this.is_dof.Rx) {
            this.art_matrix.premultiply(identity().makeRotationX(theta[index]));
            this.dof.Rx = theta[index];
            index += 1;
        }
        if (this.is_dof.Ry) {
            this.art_matrix.premultiply(identity().makeRotationY(theta[index]));
            this.dof.Ry = theta[index];
            index += 1;
        }
        if (this.is_dof.Rz) {
            this.art_matrix.premultiply(identity().makeRotationZ(theta[index]));
            this.dof.Rz = theta[index];
            index += 1;
        }

        let trans_back = identity().makeTranslation(core_pos.x, core_pos.y, core_pos.z);    
        let trans_final = trans_back.multiply(this.art_matrix).multiply(trans_to_origin);    
        this.node.core.applyMatrix4(trans_final);
    }

    add_shape(shape = shapes.ball, material = color(),  matrix = identity(), parent = this.scene) {
        if(this.node === null) this.node = new Node(parent, this.scene);
        this.node.add_shape(shape, material, matrix);
    }

    look_at(x = 0, y = 0, z = 0) { // FOR TESTING, NOT FOR USE IN DEV
        // if(x instanceof T.Vector3) this.node.core.lookAt(x);
        // else this.node.core.lookAt(x, y, z);
    }

    apply_ik(target_position) {
        let current_pos = this.get_global_position();
        let direction = target_position.clone().sub(current_pos).normalize();
        let axis = new T.Vector3(0, 1, 0).cross(direction).normalize();
        let angle = new T.Vector3(0, 1, 0).angleTo(direction);

        if (!isNaN(angle) && axis.length() > 0) {
            let quaternion = new T.Quaternion().setFromAxisAngle(axis, angle);
            let new_rotation = new T.Euler().setFromQuaternion(quaternion);
            
            if (this.is_dof.x) this.dof.x = new_rotation.x;
            if (this.is_dof.y) this.dof.y = new_rotation.y;
            if (this.is_dof.z) this.dof.z = new_rotation.z;
            
            this.node.core.rotation.set(this.dof.x, this.dof.y, this.dof.z);
        }
    }
}

export class End_Effector extends Arc {
    constructor(id, scene, location = identity(), parent = null) {
        super(id, scene, location, parent);
    }

    solve_ik(target, iterations = 10, threshold = 0.01) {
        for (let i = 0; i < iterations; i++) {
            let error = target.clone().sub(this.get_global_position());
            if (error.length() < threshold) break;

            let chain = [];
            let current = this;
            while (current) {
                chain.push(current);
                current = current.parent;
            }

            for (let j = chain.length - 1; j >= 0; j--) {
                chain[j].apply_ik(target);
            }
        }
    }


    set_articulation(theta, id = this.id) {
        if (this.id !== id) {
            if (this.parent) return this.parent.set_articulation(theta, id);
            else return;
        }

        let core_pos = this.node.core.position.clone();
        let trans_to_origin = identity().makeTranslation(-core_pos.x, -core_pos.y, -core_pos.z);
        this.art_matrix = identity();
        let index = 0;

        if (this.is_dof.x) {
            this.art_matrix.premultiply(identity().makeRotationX(theta[index]));
            this.dof.x = theta[index];
            index++;
        }
        if (this.is_dof.y) {
            this.art_matrix.premultiply(identity().makeRotationY(theta[index]));
            this.dof.y = theta[index];
            index++;
        }
        if (this.is_dof.z) {
            this.art_matrix.premultiply(identity().makeRotationZ(theta[index]));
            this.dof.z = theta[index];
            index++;
        }

        let trans_back = identity().makeTranslation(core_pos.x, core_pos.y, core_pos.z);
        let trans_final = trans_back.multiply(this.art_matrix).multiply(trans_to_origin);
        this.art_matrix = trans_final;
        this.node.core.applyMatrix4(trans_final);
    }
}


// export class End_Effector extends Arc {
//     constructor(id, scene, location = identity(), parent = null) {
//         super(id, scene, location, parent);
//         this.show_properties = false;
//     }

//     predict(step_size, hand = "r"){
//         // Get coords of all thetas
//         let pred = {
//             s_x: null, s_y: null, s_z: null,
//             f_x: null, f_y: null,
//             h_y: null, h_z: null,
//         }

//         let arm_mx = this.rot_matrix(hand + "_arm", step_size, 0, 0);
//         let arm_my = this.rot_matrix(hand + "_arm", 0, step_size,0);
//         let arm_mz = this.rot_matrix(hand + "_arm", 0, 0, step_size);
//         let fore_mx = this.rot_matrix(hand + "_fore", step_size, 0, 0);
//         let fore_my = this.rot_matrix(hand + "_fore", 0, step_size,0);
//         let hand_my = this.rot_matrix(hand + "_hand", 0, step_size,0);
//         let hand_mz = this.rot_matrix(hand + "_hand", 0, 0,step_size);
//         console.log('arm_mx', arm_mx)
//         console.log('arm_my', arm_my)
//         console.log('arm_mz', arm_mz)

//         pred.s_x = [arm_mx[3], arm_mx[7], arm_mx[11]]
//         pred.s_y = [arm_my[3], arm_my[7], arm_my[11]]
//         pred.s_z = [arm_mz[3], arm_mz[7], arm_mz[11]]
//         pred.f_x = [fore_mx[3], fore_mx[7], fore_mx[11]]
//         pred.f_y = [fore_my[3], fore_my[7], fore_my[11]]
//         pred.h_y = [hand_my[3], hand_my[7], hand_my[11]]
//         pred.h_z = [hand_mz[3], hand_mz[7], hand_mz[11]]

//         console.log('s_x', pred.s_x)
//         console.log('s_y', pred.s_y)
//         console.log('s_y', pred.s_z)

//         return pred;

//     }

//     jacobian(step) {
//         // Step in all direction by step size, p = post step, c = currently
//         let p = this.predict(step);

//         let global = this.get_global_position();
//         if(this.show_properties) {
//             console.log("Effector_Coords:");
//             console.log(global);
//         }
//         const x = global.x;
//         const y = global.y;
//         const z = global.z;

//         // console.log(x, y, z)
//         // console.log(p)
//         // 3x7 matrix
//         // [s_x, s_y, s_z, f_x, f_y, h_y, h_z]
//         // j[0] -> dx, j[1] -> dy, j[2] -> dz
//         // j[X][0]  --> Theta[0]
//         let j = [
//             [(p.s_x[0]-x)/step,(p.s_y[0]-x)/step,(p.s_z[0]-x)/step,(p.f_x[0]-x)/step,(p.f_y[0]-x)/step,(p.h_y[0]-x)/step,(p.h_z[0]-x)/step],
//             [(p.s_x[1]-y)/step,(p.s_y[1]-y)/step,(p.s_z[1]-y)/step,(p.f_x[1]-y)/step,(p.f_y[1]-y)/step,(p.h_y[1]-y)/step,(p.h_z[1]-y)/step],
//             [(p.s_x[2]-z)/step,(p.s_y[2]-z)/step,(p.s_z[2]-z)/step,(p.f_x[2]-z)/step,(p.f_y[2]-z)/step,(p.h_y[2]-z)/step,(p.h_z[2]-z)/step],
//         ];

//         // Get New Position
//         if(this.show_properties) {
//             console.log("Jacobian:");
//             console.log(j);
//         }

//         return j;
//     }

//     psuedo_inverse(step) {
//         let j = this.jacobian(step)
//         let j_t = transpose(j);
//         let A = matrixDot(j, j_t);
//         if(this.show_properties) {
//             console.log("A");
//             console.log(A);

//             let A_inv = invert(A);

//             console.log("A-Inverse");
//             console.log(A_inv);
//         }

//         let lu = new LuDecomposition(A);
//         let lower = mat_copy(lu.lowerTriangularMatrix.data);
//         let upper  = mat_copy(lu.upperTriangularMatrix.data);
//         let lower_inv = invert(lower);
//         let upper_inv = invert(upper);

//         // Get inverse (J, J_T) using Lower, upper
//         let LU_inv = matrixDot(upper_inv,lower_inv);
//         if(this.show_properties) {
//             console.log("LU Inverse");
//             console.log(LU_inv);
//         }


//         let psuedo_inv = matrixDot(j_t, LU_inv);
//         if(this.show_properties) {
//             console.log("Pseudo Inverse");
//             console.log(psuedo_inv);
//         }
//         return psuedo_inv;
//     }

//     delta_theta(dx, dy, dz, step) {
//         // Where delta pos = [delt_x, delt_y, delt_z]
//         // Delta Pos = [[0,0,0]]T
//         let psuedo_inv = this.psuedo_inverse(step);
//         let delta_pos = [[dx], [dy], [dz]];
//         let del_theta = matrixDot(psuedo_inv, delta_pos);

//         if(this.show_properties) {
//             console.log("Delta Theta:");
//             console.log(del_theta);
//         }

//         return del_theta;
//     }

//     // Iterate Inverse Kinematics - One Iteration
//     inch_to(x, y, z, step = 0.01, max_error = 0.25) {
//         // Compute Error and delta_X
//         let curr_pos = this.get_global_position();
//         let error = [x - curr_pos[0], y - curr_pos[1], z - curr_pos[2]];
//         const mag_error = Math.sqrt(error[0] ** 2 + error[1] ** 2 + error[2] ** 2);
//         if(this.show_properties) {
//             console.log("Error:");
//             console.log(error);
//             console.log(mag_error);
//         }
//         if(mag_error < max_error) return;

//         // let dx = error[0] * step, dy = error[1] * step, dz = error[2] * step;
//         // if(this.show_properties) console.log(`Delta Pos: ${dx}, ${dy}, ${dz}`)
//         let dx = error[0], dy = error[1], dz = error[2];

//         //Get change in angles using pseudo inverse
//         let ang = this.delta_theta(dx, dy, dz, step);

//         // Get
//         const f_step = 1;
//         this.inc_target_articulation("l_arm",[ang[0] * f_step, ang[1] * f_step, ang[2] * f_step]);
//         this.inc_target_articulation("l_fore", [ang[3] * f_step, ang[4] * f_step]);
//         this.inc_target_articulation("l_hand", [ang[5] * f_step, ang[6] * f_step]);
//     }

//     hop_to(x, y, z, step = 0.01, max_error = 0.25) {
//         step = Math.max(step, 0.1);
//         // console.log(`x: ${x}\ny: ${y}\nz: ${z}`)
//         for (let i = 0; i < (1/step); i++) {
//             this.inch_to(x, y, z, step, max_error);
//         }
//     }
// }



