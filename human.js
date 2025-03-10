import {tiny, defs} from './examples/common.js';


// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// import { multiply, transpose, lusolve } from 'https://mathjs.org/index.html';

// const math = require('mathjs');


const shapes = {
    'sphere': new defs.Subdivision_Sphere( 5 ),
};

export
const Articulated_Human = 
class Articulated_Human {
    constructor() {
        const sphere_shape = shapes.sphere;
    
        const figure_transform = Mat4.identity();
        // scale to 3/4th
        figure_transform.post_multiply(Mat4.scale(0.75, 0.75, 0.75));
        // Translate to correct locatin
        figure_transform.post_multiply(Mat4.translation(-1.5, 6.5, 0));
    
        // torso node
        const torso_transform = Mat4.scale(1, 2.2, 0.5);
        this.torso_node = new Node("torso", sphere_shape, torso_transform);
    
        // root->torso uses our combined transform
        this.root = new Arc("root", null, this.torso_node, figure_transform);
    
        // head node
        let head_transform = Mat4.scale(.6, .6, .6);
        head_transform.pre_multiply(Mat4.translation(0, .1, 0));
        this.head_node = new Node("head", sphere_shape, head_transform);
        const neck_location = Mat4.translation(0, 2.5, 0);
        this.neck = new Arc("neck", this.torso_node, this.head_node, neck_location);
        this.torso_node.children_arcs.push(this.neck);
    
        let ru_arm_transform = Mat4.scale(1.2, .2, .2);
        ru_arm_transform.pre_multiply(Mat4.translation(1.1, -0.25, 0));
        this.ru_arm_node = new Node("ru_arm", sphere_shape, ru_arm_transform);
    
        const r_shoulder_location = Mat4.translation(0.6, 2, 0);
        this.r_shoulder = new Arc("r_shoulder", this.torso_node, this.ru_arm_node, r_shoulder_location);
        this.torso_node.children_arcs.push(this.r_shoulder);
        this.r_shoulder.set_dof(true, true, true);
    
        // right lower arm node
        let rl_arm_transform = Mat4.scale(1, .2, .2);
        rl_arm_transform.pre_multiply(Mat4.translation(0.9, -0.25, 0));
        this.rl_arm_node = new Node("rl_arm", sphere_shape, rl_arm_transform);
    
        const r_elbow_location = Mat4.translation(2.4, 0, 0);
        this.r_elbow = new Arc("r_elbow", this.ru_arm_node, this.rl_arm_node, r_elbow_location);
        this.ru_arm_node.children_arcs.push(this.r_elbow);
        this.r_elbow.set_dof(true, true, false);
    
        // right hand node
        let r_hand_transform = Mat4.scale(.4, .3, .2);
        r_hand_transform.pre_multiply(Mat4.translation(0.2, -0.25, 0));
        this.r_hand_node = new Node("r_hand", sphere_shape, r_hand_transform);
    
        const r_wrist_location = Mat4.translation(2, 0, 0);
        this.r_wrist = new Arc("r_wrist", this.rl_arm_node, this.r_hand_node, r_wrist_location);
        this.rl_arm_node.children_arcs.push(this.r_wrist);
        this.r_wrist.set_dof(true, false, true);
    
        const r_hand_end_local_pos = vec4(0.8, 0, 0, 1);
        this.end_effector = new End_Effector("right_hand", this.r_wrist, r_hand_end_local_pos);
        this.r_wrist.end_effector = this.end_effector;
    
        // Left arm - mirrored
        let lu_arm_transform = Mat4.scale(1.2, 0.2, 0.2);
        lu_arm_transform.pre_multiply(Mat4.translation(-1.1, -0.25, 0));
        this.lu_arm_node = new Node("lu_arm", sphere_shape, lu_arm_transform);
    
        const l_shoulder_location = Mat4.translation(-0.6, 2, 0);
        this.l_shoulder = new Arc("l_shoulder", this.torso_node, this.lu_arm_node, l_shoulder_location);
        this.torso_node.children_arcs.push(this.l_shoulder);
        this.l_shoulder.set_dof(false, false, false);
    
        let ll_arm_transform = Mat4.scale(1, 0.2, 0.2);
        ll_arm_transform.pre_multiply(Mat4.translation(-0.9, -0.25, 0));
        this.ll_arm_node = new Node("ll_arm", sphere_shape, ll_arm_transform);
    
        const l_elbow_location = Mat4.translation(-2.4, 0, 0);
        this.l_elbow = new Arc("l_elbow", this.lu_arm_node, this.ll_arm_node, l_elbow_location);
        this.lu_arm_node.children_arcs.push(this.l_elbow);
        this.l_elbow.set_dof(false, false, false);
    
        let l_hand_transform = Mat4.scale(0.4, 0.3, 0.2);
        l_hand_transform.pre_multiply(Mat4.translation(-0.2, -0.25, 0));
        this.l_hand_node = new Node("l_hand", sphere_shape, l_hand_transform);
    
        const l_wrist_location = Mat4.translation(-2, 0, 0);
        this.l_wrist = new Arc("l_wrist", this.ll_arm_node, this.l_hand_node, l_wrist_location);
        this.ll_arm_node.children_arcs.push(this.l_wrist);
        this.l_wrist.set_dof(false, false, false);
    
        // Right leg
        let ru_leg_transform = Mat4.scale(.2, 1.1, .2);
        ru_leg_transform.pre_multiply(Mat4.translation(0.025, -0.55, 0));
        this.ru_leg_node = new Node("ru_leg", sphere_shape, ru_leg_transform);
    
        const r_hip_location = Mat4.translation(0.3, -2.6, 0);
        this.r_hip = new Arc("r_hip", this.torso_node, this.ru_leg_node, r_hip_location);
        this.torso_node.children_arcs.push(this.r_hip);
    
        let rl_leg_transform = Mat4.scale(.2, 1.1, .2);
        rl_leg_transform.pre_multiply(Mat4.translation(0.025, -0.3, 0));
        this.rl_leg_node = new Node("rl_leg", sphere_shape, rl_leg_transform);
    
        const r_knee_location = Mat4.translation(0, -2.4, 0);
        this.r_knee = new Arc("r_knee", this.ru_leg_node, this.rl_leg_node, r_knee_location);
        this.ru_leg_node.children_arcs.push(this.r_knee);
    
        let r_foot_transform = Mat4.scale(.3, .2, .4);
        r_foot_transform.pre_multiply(Mat4.translation(0, 0.5, 0.2));
        this.r_foot_node = new Node("r_foot", sphere_shape, r_foot_transform);
    
        const r_ankle_location = Mat4.translation(0, -2, 0);
        this.r_ankle = new Arc("r_ankle", this.rl_leg_node, this.r_foot_node, r_ankle_location);
        this.rl_leg_node.children_arcs.push(this.r_ankle);
    
        //Left leg - mirrored
        let lu_leg_transform2 = Mat4.scale(.2, 1.1, .2);
        lu_leg_transform2.pre_multiply(Mat4.translation(-0.025, -0.55, 0));
        this.lu_leg_node = new Node("lu_leg", sphere_shape, lu_leg_transform2);
    
        const l_hip_location = Mat4.translation(-0.3, -2.6, 0);
        this.l_hip = new Arc("l_hip", this.torso_node, this.lu_leg_node, l_hip_location);
        this.torso_node.children_arcs.push(this.l_hip);
    
        let ll_leg_transform2 = Mat4.scale(.2, 1.1, .2);
        ll_leg_transform2.pre_multiply(Mat4.translation(-0.025, -0.3, 0));
        this.ll_leg_node = new Node("ll_leg", sphere_shape, ll_leg_transform2);
    
        const l_knee_location = Mat4.translation(0, -2.4, 0);
        this.l_knee = new Arc("l_knee", this.lu_leg_node, this.ll_leg_node, l_knee_location);
        this.lu_leg_node.children_arcs.push(this.l_knee);
    
        let l_foot_transform = Mat4.scale(.3, .2, .4);
        l_foot_transform.pre_multiply(Mat4.translation(0, 0.5, 0.2));
        this.l_foot_node = new Node("l_foot", sphere_shape, l_foot_transform);
    
        const l_ankle_location = Mat4.translation(0, -2, 0);
        this.l_ankle = new Arc("l_ankle", this.ll_leg_node, this.l_foot_node, l_ankle_location);
        this.ll_leg_node.children_arcs.push(this.l_ankle);
    
        // here I only use 7 dof
        this.dof = 7;
        this.Jacobian = null;
        this.theta = [0, 0, 0, 0, 0, 0, 0];
        this.apply_theta();
    }

    // mapping from global theta to each joint theta
    apply_theta() {
        this.r_shoulder.update_articulation(this.theta.slice(0, 3));
        this.r_elbow.update_articulation(this.theta.slice(3, 5));
        this.r_wrist.update_articulation(this.theta.slice(5, 7));
    }


    calculate_Jacobian() {
        let J = new Array(3);
        for (let i = 0; i < 3; i++) {
        J[i] = new Array(this.dof);
        }

        // TODO: Implement your Jacobian here
        const Δt = 0.0005;//Lowering can cause D = 0 errors
        const curr_end_effector_pos = this.get_end_effector_position();

        for (let i = 0; i < this.dof; i++) {
            this.theta[i] += Δt;
            this.apply_theta();

            const shiftedPos = this.get_end_effector_position();
            const dx = (shiftedPos[0] - curr_end_effector_pos[0]) / Δt;
            const dy = (shiftedPos[1] - curr_end_effector_pos[1]) / Δt;
            const dz = (shiftedPos[2] - curr_end_effector_pos[2]) / Δt;

            [ J[0][i], J[1][i], J[2][i] ] = [dx, dy, dz];


            this.theta[i] -= Δt;
            this.apply_theta();
        }

        return J;  // 3x7 in my case.
    }
    
    
    calculate_delta_theta(J, dx) {
        const A = math.multiply(math.transpose(J), J);
        console.log(A);
        const b = math.multiply(math.transpose(J), dx);
        console.log(b);
        const x = math.lusolve(A, b)
        console.log(x);

        return x;
    }

    get_end_effector_position() {
        // in this example, we only have one end effector.
        this.matrix_stack = [];
        this._rec_update(this.root, Mat4.identity());
        const v = this.end_effector.global_position; // vec4
        return vec3(v[0], v[1], v[2]);
    }

    attempt_motion(goal_pos, max_steps = 175, precision = 0.005, step_size = 0.1) {
    
        let localEffPos = this.get_end_effector_position();
        let iteration   = 0;
    
        while (true) {
            if (iteration >= max_steps) {
                break;
            }
    
            const posOffset = this._get_scaled_offset(localEffPos, goal_pos, step_size);
    
            if (posOffset.norm() <= precision) {
                // console.log(`Needde ${iteration} steps.`);
                break;
            }
    
            const bigJ       = this.calculate_Jacobian();
            const pseudoInv  = this._compute_pseudoinverse(bigJ);
    
            const deltaTheta = math.multiply(pseudoInv, [
                [posOffset[0]],
                [posOffset[1]],
                [posOffset[2]]
            ]);
    
            this._apply_delta_theta(deltaTheta);
    
            localEffPos.add_by(posOffset);
    
            iteration++;
        }
    }


    
    _get_scaled_offset(currentPos, targetPos, rate) {
        const rawOffset = targetPos.minus(currentPos);
        return rawOffset.times(rate);
    }

    _compute_pseudoinverse(J) {
        const J_t    = math.transpose(J); 
        const JJ_t   = math.multiply(J, J_t); 
        const invJJt = math.inv(JJ_t);  
        return math.multiply(J_t, invJJt); 
    }

    _apply_delta_theta(dTheta) {
        for (let i = 0; i < this.theta.length; i++) {
            this.theta[i] += parseFloat(dTheta[i]);
        }
        this.apply_theta();
    }
    

    _rec_update(arc, matrix) {

        if (!arc) return;

        const queue = [];
        queue.push({ arc, matrix: matrix.copy() });

        while (queue.length > 0) {
            const { arc: currentArc, matrix: localMatrix } = queue.shift();
            const combined = currentArc.location_matrix.times(currentArc.articulation_matrix);
            localMatrix.post_multiply(combined);

            this.matrix_stack.push(localMatrix.copy());

            if (currentArc.end_effector) {
                currentArc.end_effector.global_position =
                    localMatrix.times(currentArc.end_effector.local_position);
            }

            const childNode = currentArc.child_node;
            localMatrix.post_multiply(childNode.transform_matrix);
            const snapshot = this.matrix_stack.pop();

            for (const nextArc of childNode.children_arcs) {
                queue.push({ arc: nextArc, matrix: snapshot.copy() });
            }
        }
    }


    draw(webgl_manager, uniforms, material) {
        this.matrix_stack = [];
        this._rec_draw(this.root, Mat4.identity(), webgl_manager, uniforms, material);
    }

    _rec_draw(arc, matrix, webgl_manager, uniforms, material) {
        if (arc !== null) {
            const L = arc.location_matrix;
            const A = arc.articulation_matrix;
            matrix.post_multiply(L.times(A));
            this.matrix_stack.push(matrix.copy());

            const node = arc.child_node;
            const T = node.transform_matrix;
            matrix.post_multiply(T);
            node.shape.draw(webgl_manager, uniforms, matrix, material);

            matrix = this.matrix_stack.pop();
            for (const next_arc of node.children_arcs) {
                this.matrix_stack.push(matrix.copy());
                this._rec_draw(next_arc, matrix, webgl_manager, uniforms, material);
                matrix = this.matrix_stack.pop();
            }
        }
    }

    debug(arc=null, id=null) {

        // this.theta = this.theta.map(x => x + 0.01);
        // this.apply_theta();
        const J = this.calculate_Jacobian();
        let dx = [[0], [-0.02], [0]];
        if (id === 2)
            dx = [[-0.02], [0], [0]];
        const dtheta = this.calculate_delta_theta(J, dx);
        this.theta = this.theta.map((v, i) => v + dtheta[i][0]);
        this.apply_theta();
    }
}

class Node {
    constructor(name, shape, transform) {
        this.name = name;
        this.shape = shape;
        this.transform_matrix = transform;
        this.parent_arc = null;
        this.children_arcs = [];
    }
}

class Arc {
    constructor(name, parent, child, location) {
        this.name = name;
        this.parent_node = parent;
        this.child_node = child;
        this.location_matrix = location;
        this.articulation_matrix = Mat4.identity();
        this.end_effector = null;
        this.dof = {
            Rx: false,
            Ry: false,
            Rz: false,
        }
    }

    // Here I only implement rotational DOF
    set_dof(x, y, z) {
        this.dof.Rx = x;
        this.dof.Ry = y;
        this.dof.Rz = z;
    }

    update_articulation(theta) {
        this.articulation_matrix = Mat4.identity();
        let index = 0;
        if (this.dof.Rx) {
            this.articulation_matrix.pre_multiply(Mat4.rotation(theta[index], 1, 0, 0));
            index += 1;
        }
        if (this.dof.Ry) {
            this.articulation_matrix.pre_multiply(Mat4.rotation(theta[index], 0, 1, 0));
            index += 1;
        }
        if (this.dof.Rz) {
            this.articulation_matrix.pre_multiply(Mat4.rotation(theta[index], 0, 0, 1));
        }
    }

}

class End_Effector {
    constructor(name, parent, local_position) {
        this.name = name;
        this.parent = parent;
        this.local_position = local_position;
        this.global_position = null;
    }
}