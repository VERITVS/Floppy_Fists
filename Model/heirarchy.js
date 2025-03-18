import * as T from 'three';
import { Object3D, Matrix4 } from 'three/webgpu';
import {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos, dist} from './defs.js'

export class Node {
    constructor(parent, scene) {
        this.parent = parent;
        this.model = [];
        // this.matrix = [];
        this.material = [];
        this.shape_count = 0

        this.core = new T.Group()
        this.scene = scene;


        if(parent === this.scene || parent === null) this.scene.add(this.core);   
        else if (parent instanceof Node) this.parent.core.add(this.core);
        else if (parent instanceof Arc) {
            this.parent.node.core.add(this.core);        
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

        if(this.parent) this.length = dist(this.parent.get_global_position(), this.get_global_position())
        else this.length = 0;

    }

    set_length(l) {this.length = l;}

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
        let global = v3(0, 0, 0)
        this.node.core.getWorldPosition(global);

        // console.log('OBJECT:\n', global)
        let x = global.x;
        let y = global.y;
        let z = global.z;

        return v3(x, y, z);
    }

     apply_ik(target_position) {
        let current_pos = this.get_global_position();
        let direction = target_position.clone().sub(current_pos).normalize();
        let axis = new T.Vector3(0, 1, 0).cross(direction).normalize();
        let angle = new T.Vector3(0, 1, 0).angleTo(direction);
        let new_angles = [];

        if (!isNaN(angle) && axis.length() > 0) {
            let quaternion = new T.Quaternion().setFromAxisAngle(axis, angle);
            let new_rotation = new T.Euler().setFromQuaternion(quaternion);

            if (this.is_dof.Rx) {
                new_angles.push(new_rotation.x);
            }
            if (this.is_dof.Ry) {
                new_angles.push(new_rotation.y);
            }
            if (this.is_dof.Rz) {
                new_angles.push(new_rotation.z);
            }


            this.set_articulation(new_angles, this.id)
            // this.node.core.rotation.set(this.dof.Rx, this.dof.Ry, this.dof.Rz);
        }
    }

    rot_matrix(id, Rx, Ry, Rz) {
        const rot_x = identity().makeRotationX(this.dof.Rx + Rx);
        const rot_y = identity().makeRotationY(this.dof.Ry + Ry);
        const rot_z = identity().makeRotationZ(this.dof.Rz + Rz);
        const predict_art_matrix = identity()
            .premultiply(rot_x)
            .premultiply(rot_y)
            .premultiply(rot_z);

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

        // Move to Origin
        let trans_to_origin = m4.makeTranslation(-core_pos.x, -core_pos.y, -core_pos.z);

        // Reset Rotation
        this.art_matrix = new T.Matrix4();
        let quaternion = new T.Quaternion();
        let index = 0;

        if (this.is_dof.Rx) {
            theta[index] = (theta[index] != null) ? theta[index] : this.dof.Rx;
            let qx = new T.Quaternion().setFromAxisAngle(v3(1, 0, 0), theta[index] - this.dof.Rx);
            quaternion.multiply(qx);
            this.dof.Rx = theta[index];
            index += 1;
        }
        if (this.is_dof.Ry) {
            theta[index] = (theta[index] != null) ? theta[index] : this.dof.Ry;
            let qy = new T.Quaternion().setFromAxisAngle(v3(0, 1, 0), theta[index] - this.dof.Ry);
            quaternion.multiply(qy);
            this.dof.Ry = theta[index];
            index += 1;
        }
        if (this.is_dof.Rz) {
            theta[index] = (theta[index] != null) ? theta[index] : this.dof.Rx;
            let qz = new T.Quaternion().setFromAxisAngle(v3(0, 0, 1), theta[index] - this.dof.Rz);
            quaternion.multiply(qz);
            this.dof.Rz = theta[index];
            index += 1;
        }

        // Convert Quaternion to Matrix
        let rotationMatrix = new T.Matrix4().makeRotationFromQuaternion(quaternion);

        // Move Back to Original Position
        let trans_back = new T.Matrix4().makeTranslation(core_pos.x, core_pos.y, core_pos.z);

        // Apply Final Transformation
        this.art_matrix = trans_back.multiply(rotationMatrix).multiply(trans_to_origin);
        this.node.core.applyMatrix4(this.art_matrix);
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
}


export class End_Effector extends Arc {
    constructor(id, scene, location = identity(), parent = null) {
        super(id, scene, location, parent);
        this.max_iterations = 200; // Maximum CCD iterations
        this.threshold = 1; // Minimum error threshold to stop
        this.damping_factor = 0.005; // Smooths rotation changes
    }

    solve_ik(target) {
        let joints = this.get_joint_chain();
        let root_pos = joints[0].get_global_position();
        let max_reach = this.get_chain_length(joints);
        let target_dist = root_pos.distanceTo(target);
    
        // Transform target to local model space
        let inverseModelMatrix = new T.Matrix4().copy(this.scene.matrixWorld).invert();
        let targetLocal = target.clone().applyMatrix4(inverseModelMatrix);
    
        if (target_dist > max_reach) {
            targetLocal = this.handle_out_of_range(targetLocal, root_pos, max_reach);
        }
    
        for (let i = 0; i < this.max_iterations; i++) {
            let end_pos = joints[joints.length - 1].get_global_position();
            if (end_pos.distanceTo(targetLocal) < this.threshold) break;
    
            for (let j = joints.length - 1; j >= 0; j--) {
                this.rotate_joint_towards_target(joints[j], targetLocal, max_reach);
            }
        }
    }
    
    
    
    rotate_joint_towards_target(joint, target, max_reach) {
        let joint_pos = joint.get_global_position();
        let end_effector_pos = this.get_global_position();
        
        let to_end_effector = end_effector_pos.clone().sub(joint_pos).normalize();
        let to_target = target.clone().sub(joint_pos).normalize();
    
        // Ensure rotation respects model's orientation
        let modelRotation = new T.Matrix4().extractRotation(this.scene.matrixWorld);
        to_target.applyMatrix4(modelRotation);
    
        let axis = new T.Vector3().crossVectors(to_end_effector, to_target).normalize();
        if (axis.length() === 0) return;
    
        axis = this.filter_axis_by_dof(joint, axis);
        if (axis.length() === 0) return;
    
        let angle = to_end_effector.angleTo(to_target) * this.damping_factor;
        angle = this.clamp_angle(joint, angle);
    
        joint.node.core.rotateOnAxis(axis, angle);
    }
    

    filter_axis_by_dof(joint, axis) {
        let allowed_axes = [];
        if (joint.is_dof.Rx) allowed_axes.push(new T.Vector3(1, 0, 0));
        if (joint.is_dof.Ry) allowed_axes.push(new T.Vector3(0, 1, 0));
        if (joint.is_dof.Rz) allowed_axes.push(new T.Vector3(0, 0, 1));

        let filtered_axis = new T.Vector3();
        for (let allowed_axis of allowed_axes) {
            let projection = axis.clone().projectOnVector(allowed_axis);
            filtered_axis.add(projection);
        }
        return filtered_axis.normalize();
    }

    get_joint_chain() {
        let chain = [];
        let current = this;
        while (current) {
            chain.push(current);
            current = current.parent;
        }
        return chain.reverse(); 
    }

    get_chain_length(joints) {
        let length = 0;
        for (let i = 1; i < joints.length; i++) {
            length += joints[i].length
        }
        return length;
    }

    handle_out_of_range(target, root_pos, max_reach) {
        let direction = target.clone().sub(root_pos).normalize();
        return root_pos.clone().add(direction.multiplyScalar(max_reach * 0.95)); // Prevent snapping
    }

    clamp_angle(joint, angle) {
        let min_angle = -Math.PI * 2; 
        let max_angle = Math.PI * 2;
        return Math.max(min_angle, Math.min(max_angle, angle));
    }
}
