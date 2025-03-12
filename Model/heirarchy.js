import * as T from 'three';
import { Object3D, Matrix4 } from 'three/webgpu';
import {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos, dist} from './defs.js'



/**
* Main changes
* 
* Use the DOF for each joint to update each one's local transform
* Most fns are the same, and most of the new fns are for helping with
* calculation and updates
*
* Also, added some special handling for the left arm since my arena code didn't 
* work properly with this code otherwise.
*/

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

        // Extract init pos from location matrix
        let px = location.elements[12] || location.elements[3];
        let py = location.elements[13] || location.elements[7];
        let pz = location.elements[14] || location.elements[11];

        this.node.core.position.set(px, py, pz);
        this.node.core.rotation.set(0, 0, 0);

        this.is_dof = {
            Tx: false, Ty: false, Tz: false,
            Rx: true, Ry: true, Rz: true
        }
        this.dof = { Rx: 0, Ry: 0, Rz: 0};

        if(this.parent) this.length = dist(this.parent.get_global_position(), this.get_global_position())
        else this.length = 0;
        this.children = [];

        console.log(this.id, ': ', this.length);
    }

    set_length(l) { this.length = l; }

    //Store Euler angle in dof -> update_loal_transform()
    set_dof(rx = false, ry = false, rz = false, tx = false, ty = false, tz = false) {
        this.is_dof.Rx = rx;
        this.is_dof.Ry = ry;
        this.is_dof.Rz = rz;
    }

    get_global_position() {
        let global = new T.Vector3();
        this.node.core.getWorldPosition(global);
        return v3(global.x, global.y, global.z);
    }

    //Get local orientation from DOF
    update_local_transform() {
        this.node.core.rotation.set(
            this.dof.Rx,
            this.dof.Ry,
            this.dof.Rz
        );
        // Handle Tx Ty Tz here?
    }


    //Articulate to set dof then apply to core roation
    set_articulation(theta, id = this.id) {
        if (this.id !== id) {
            if (this.parent) {
                return this.parent.set_articulation(theta, id);
            }
            return;
        }

        let index = 0;
        if (this.is_dof.Rx) {
            this.dof.Rx = theta[index] || 0;
            index += 1;
        }//Similar to apply_ik
        if (this.is_dof.Ry) {
            this.dof.Ry = theta[index] || 0;
            index += 1;
        }
        if (this.is_dof.Rz) {
            this.dof.Rz = theta[index] || 0;
            index += 1;
        }

        // Now update the node's local rotation from dof
        this.update_local_transform();
    }

    //Increment dof angles
    inc_articulation(theta, id = this.id) {
        if (this.id !== id) {
            if (this.parent) {
                return this.parent.inc_articulation(theta, id);
            }
            return;
        }

        let index = 0;
        if (this.is_dof.Rx) {
            this.dof.Rx += theta[index];
            index += 1;
        }
        if (this.is_dof.Ry) {
            this.dof.Ry += theta[index];
            index += 1;
        }
        if (this.is_dof.Rz) {
            this.dof.Rz += theta[index];
            index += 1;
        }

        this.update_local_transform();
    }

    add_shape(shape = shapes.ball, material = color(), matrix = identity(), parent = this.scene) {
        if(this.node === null) this.node = new Node(parent, this.scene);
        this.node.add_shape(shape, material, matrix);
    }

    look_at(x = 0, y = 0, z = 0) {
    }
}


export class End_Effector extends Arc {
    constructor(id, scene, location = identity(), parent = null) {
        super(id, scene, location, parent);
        this.max_iterations = 30;
        this.threshold = 0.05;       
        this.damping_factor = 0.3; //Changed after experiemnting (Revert to old values?)   
        
        this.prev_target = null;
        this.target_smoothing = 0.2;
        
        // Special handling for left arm - For some reason the updated arena code wouldn't work with this code without this
        this.isLeftArm = id.startsWith('l_') || id.indexOf('l_') >= 0;
        
        // Mirror left arm
        if (this.isLeftArm) {
            this.joint_limits = {
                rx: { min: -Math.PI/2, max: Math.PI/2 },
                ry: { min: -Math.PI/2, max: Math.PI/2 },
                rz: { min: -Math.PI/2, max: Math.PI/2 }
            };
        } else {
            // Right arm (left arm will mirror this)
            this.joint_limits = {
                rx: { min: -Math.PI/2, max: Math.PI/2 },
                ry: { min: -Math.PI/2, max: Math.PI/2 },
                rz: { min: -Math.PI/2, max: Math.PI/2 }
            };
        }
    
        this.stable_count = 0;
        this.initial_y = null;
    }

    solve_ik(target) {
        if (this.initial_y === null) {
            this.initial_y = this.get_global_position().y;
        }
        //Smoothing
        if (this.prev_target) {
            let smoothing = this.isLeftArm ? 0.18 : 0.2; // Equalize?
            let smoothed_target = this.prev_target.clone().lerp(target, 1 - smoothing);
            target = smoothed_target;
        }
        this.prev_target = target.clone();
        
        this.stable_count = 0;
        
        let joints = this.get_joint_chain();
        let root_pos = joints[0].get_global_position();
        let max_reach = this.get_chain_length(joints);
        let target_dist = root_pos.distanceTo(target);
        if (target_dist > max_reach * 0.95) {
            target = this.handle_out_of_range(target, root_pos, max_reach * 0.95);
        }

        target.y = this.initial_y;
        
        for (let i = 0; i < this.max_iterations; i++) {
            joints[0].node.core.updateMatrixWorld(true);
            let end_pos = this.get_global_position();
            if (end_pos.distanceTo(target) < this.threshold) {
                this.stable_count++;
                break;
            }

            for (let j = joints.length - 2; j > 0; j--) {
                this.rotate_joint_towards_target(joints[j], target, max_reach);
                joints[j].node.core.updateMatrixWorld(true);
            }
        }
    }

    rotate_joint_towards_target(joint, target, max_reach) {
        let joint_pos = joint.get_global_position();
        let end_pos = this.get_global_position();
        
        if (joint_pos.distanceTo(end_pos) < 0.01) return;
        
        let to_end = end_pos.clone().sub(joint_pos).normalize();
        let to_target = target.clone().sub(joint_pos).normalize();
        
        if (to_end.dot(to_target) > 0.999) return;
        
        let axis = new T.Vector3().crossVectors(to_end, to_target);
        
        //Again, special handling for left arm - scene.js needed it
        if (this.isLeftArm || (joint.id && joint.id.indexOf('l_') >= 0)) {
            // Increased vertical movement to compensate for mirror
            axis.y *= 0.3;
            if (joint.id && joint.id.indexOf('l_arm') >= 0) {
                axis.y *= 1.3;
            }
        } else {
            axis.y *= 0.3;//Right arm
        }
        
        // Normalize axis
        if (axis.length() < 0.001) {
            axis.set(1, 0, 0);
        } else {
            axis.normalize();
        }
        
        axis = this.filter_axis_by_dof(joint, axis);
        if (axis.length() < 0.001) return;
        
        let angle_damping = this.isLeftArm ? this.damping_factor * 1.1 : this.damping_factor;
        let angle = to_end.angleTo(to_target) * angle_damping;
        
        let shoulder_damping = 0.7; 

        if (joint.id) {
            if (joint.id.indexOf('_arm') >= 0) {
                if (joint.id.indexOf('l_') >= 0) {
                    shoulder_damping = 0.65; //Special handling for left arm (shoulder here)...
                } else {
                    shoulder_damping = 0.7;  // Right shoulder
                }
            }
        }
        
        let joints = this.get_joint_chain();
        let jointIndex = joints.indexOf(joint);
        let distFromRoot = jointIndex / (joints.length - 1);
        
        if (distFromRoot < 0.5) {
            angle *= shoulder_damping;
        }
        
        let max_angle = this.isLeftArm ? 0.22 : 0.2;
        angle = Math.min(angle, max_angle);
        
        this.increment_dof_from_axis_angle(joint, axis, angle);
        joint.update_local_transform();
    }

    increment_dof_from_axis_angle(joint, axis, angle) {
        const xAxis = new T.Vector3(1, 0, 0);
        const yAxis = new T.Vector3(0, 1, 0);
        const zAxis = new T.Vector3(0, 0, 1);
        
        const isLeftJoint = this.isLeftArm || (joint.id && joint.id.indexOf('l_') >= 0);
        
        let dotX = axis.dot(xAxis);
        let dotY = axis.dot(yAxis);
        let dotZ = axis.dot(zAxis);
        
        let absX = Math.abs(dotX);
        let absY = Math.abs(dotY);
        let absZ = Math.abs(dotZ);
        

        if (joint.is_dof.Rx && absX > 0.1) {
            let delta = angle * dotX * (absX / (absX + absY + absZ));
            
            if (isLeftJoint && (joint.id.indexOf('shoulder') >= 0 || joint.id.indexOf('arm') >= 0)) {
                if (joint.id.indexOf('elbow') >= 0 || joint.id.indexOf('fore') >= 0) {
                    delta *= 1.0;  
                }
            }
            
            let new_angle = joint.dof.Rx + delta;
            
            // Apply appropriate limits based on left/right arm
            let min_limit = isLeftJoint ? this.joint_limits.rx.min : this.joint_limits.rx.min;
            let max_limit = isLeftJoint ? this.joint_limits.rx.max : this.joint_limits.rx.max;
            
            if (new_angle < min_limit) delta = min_limit - joint.dof.Rx;
            if (new_angle > max_limit) delta = max_limit - joint.dof.Rx;
            
            joint.dof.Rx += delta;
        }
        
        if (joint.is_dof.Ry && absY > 0.1) {
            let delta = angle * dotY * (absY / (absX + absY + absZ));
            
            if (isLeftJoint && (joint.id.indexOf('shoulder') >= 0 || joint.id.indexOf('arm') >= 0)) {
                if (joint.id.indexOf('shoulder') >= 0 || joint.id.indexOf('arm') >= 0) {
                    delta *= 1.0; 
                }
            }
            
            let new_angle = joint.dof.Ry + delta;
            
            // Left arm handling..
            let min_limit = isLeftJoint ? this.joint_limits.ry.min : this.joint_limits.ry.min;
            let max_limit = isLeftJoint ? this.joint_limits.ry.max : this.joint_limits.ry.max;
            
            if (new_angle < min_limit) delta = min_limit - joint.dof.Ry;
            if (new_angle > max_limit) delta = max_limit - joint.dof.Ry;
            
            joint.dof.Ry += delta;
        }
        
        if (joint.is_dof.Rz && absZ > 0.1) {
            let delta = angle * dotZ * (absZ / (absX + absY + absZ));
            
            // MIrror left arm Z
            if (isLeftJoint) {
                if (joint.id.indexOf('elbow') >= 0 || joint.id.indexOf('wrist') >= 0 || 
                    joint.id.indexOf('shoulder') >= 0) {
                    delta *= 1.0;
                }
            }
            
            let new_angle = joint.dof.Rz + delta;
            
            let min_limit = isLeftJoint ? this.joint_limits.rz.min : this.joint_limits.rz.min;
            let max_limit = isLeftJoint ? this.joint_limits.rz.max : this.joint_limits.rz.max;
            
            if (new_angle < min_limit) delta = min_limit - joint.dof.Rz;
            if (new_angle > max_limit) delta = max_limit - joint.dof.Rz;
            
            joint.dof.Rz += delta;
        }
        
        return true;
    }

    filter_axis_by_dof(joint, axis) {
        let allowedAxes = [];
        if (joint.is_dof.Rx) allowedAxes.push(new T.Vector3(1,0,0));
        if (joint.is_dof.Ry) allowedAxes.push(new T.Vector3(0,1,0));
        if (joint.is_dof.Rz) allowedAxes.push(new T.Vector3(0,0,1));

        if (allowedAxes.length === 3) {
            return axis;
        }

        let filtered = new T.Vector3(0,0,0);
        for (let a of allowedAxes) {
            let proj = axis.clone().projectOnVector(a);
            filtered.add(proj);
        }
        return filtered.length() > 0.001 ? filtered.normalize() : filtered;
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
            length += joints[i].length;
        }
        return length;
    }

    handle_out_of_range(target, root_pos, max_reach) {
        let direction = target.clone().sub(root_pos).normalize();
        return root_pos.clone().add(direction.multiplyScalar(max_reach * 0.95));
    }
}