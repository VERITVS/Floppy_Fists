import * as T from 'three'
import {shapes, color, translation, v3, hidden, identity} from './helpers'

class Arc {
    constructor(name, scene, position, parent = null) {
        this.name = name;
        this.scene = scene;
        this.group = new T.Group();
        this.group.position.set(position.x, position.y, position.z);
        this.parent = parent;
        this.children = [];
        this.dof = { x: false, y: false, z: false }; // Degrees of Freedom

        if (parent) {
            parent.group.add(this.group);
            parent.children.push(this);
        } else {
            scene.add(this.group);
        }
    }

    set_dof(x, y, z) {
        this.dof = { x, y, z };
    }

    add_shape(geometry = shapes.ball(), mat = color(), transform = new T.Matrix4().identity()) {
        let mesh = new T.Mesh(geometry, mat);
        mesh.applyMatrix4(transform);
        this.group.add(mesh);
    }

    rotate(x = 0, y = 0, z = 0) {
        if (this.dof.x) this.group.rotation.x += x;
        if (this.dof.y) this.group.rotation.y += y;
        if (this.dof.z) this.group.rotation.z += z;
    }

    getWorldPosition() {
        let worldPosition = v3();
        this.group.getWorldPosition(worldPosition);
        return worldPosition;
    }
}



class End_Effector extends Arc {
    constructor(name, scene, position, parent) {
        super(name, scene, position, parent);
        this.smoothFactor = 0.2; // Determines how smoothly joints rotate (0 = instant, 1 = very slow)
        this.maxAngleChange = T.MathUtils.degToRad(5); // Limits max rotation per frame (prevents erratic behavior)
    }

    solve_ik(targetPosition) {
        let chain = [];
        let current = this;

        // Build the chain of joints from end effector to root
        while (current.parent) {
            chain.push(current);
            current = current.parent;
        }
        chain.reverse(); // Solve from root to end effector

        let maxIterations = 10;
        let tolerance = 0.02;

        for (let i = 0; i < maxIterations; i++) {
            let endPos = this.getWorldPosition();
            if (endPos.distanceTo(targetPosition) < tolerance) break; // Stop if close enough

            for (let joint of chain) {
                let jointPos = joint.getWorldPosition();
                let toEnd = v3().subVectors(endPos, jointPos);
                let toTarget = v3().subVectors(targetPosition, jointPos);

                // Compute rotation axis
                let axis = v3().crossVectors(toEnd, toTarget).normalize();
                let angle = toEnd.angleTo(toTarget);

                // Apply smoothing to prevent erratic behavior
                let smoothedAngle = T.MathUtils.lerp(0, angle, this.smoothFactor);
                smoothedAngle = Math.min(smoothedAngle, this.maxAngleChange); // Limit max rotation per frame

                if (joint.dof.z) joint.group.rotateOnAxis(axis, smoothedAngle);

                endPos = this.getWorldPosition(); // Update end position after rotation
            }
        }
    }

    getWorldPosition() {
        let position = v3();
        this.group.getWorldPosition(position);
        return position;
    }
}


export class Model {
    constructor(scene) {
        this.scene = scene;
        const body_width = 5;
        const body_depth = 1.75;
        const body_height = 7.5;
        const arm_length = 9.0;
        const leg_length = 13.0;
        const joint_size = body_depth/2  * 1.05;
        const leg_size = joint_size * 1.35;
        const hand_size = joint_size;
        const head_size = body_width/2.5;

        const l_color = color(0, 0, 0);
        const r_color = color(255, 255, 255);
        const body_color = color(255 * 0.3, 0, 0);

        this.core = new Arc("core", this.scene, translation(0, leg_length + leg_size, 0))
        console.log(this.core)
        let core_transform = identity();
        core_transform.makeRotationZ(T.MathUtils.degToRad(90)); // Step 1: Apply rotation // Step 2: Apply translation
        this.core.add_shape( shapes.tube(body_depth * 1.25 / 2, body_depth  * 1.25 / 2, body_width / 3), body_color);
        this.core.add_shape(shapes.ball(5), color())
        console.log(this.core)

        // this.body = new Arc("body", this.scene, translation(0, body_height/2 + joint_size/2, 0), this.core);
        // this.body.add_shape(shapes.box(body_width - body_depth, body_height, body_depth), body_color);
        // this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(body_width/3, 0, 0))
        // this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(-body_width/3, 0, 0))
        // core_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
        //     .premultiply(new T.Matrix4().makeTranslation(0, body_height/2 - body_depth/4, 0)); // Step 2: Apply translation
        // this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_width), body_color, core_transform)

        // this.head = new Arc("head", this.scene, translation(0, body_height/2 + head_size, 0), this.body); 
        // this.head.add_shape(shapes.ball(head_size), body_color, translation(0, 0, 0))
        // this.head.add_shape(shapes.ball(head_size).scale(1, 0.2, 1), l_color, translation(0, head_size/2, 0))
        // this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(0.25), l_color, translation( 0.75, 0, head_size));;
        // this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(-0.25), l_color, translation( 0.75, 0, head_size));;


        // // ARMS
        // this.r_arm = new Arc("r_arm", this.scene, translation(body_width/2 + joint_size/2, body_height/2 - joint_size / 2, 0), this.body);
        // this.r_arm.set_dof(true, true, true);
        // this.r_arm.add_shape(shapes.ball(joint_size), body_color);
        // let arm_transform = new T.Matrix4();
        // arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
        //     .premultiply(new T.Matrix4().makeTranslation(arm_length / 4, 0, 0)); // Step 2: Apply translation
        // this.r_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), r_color, arm_transform);

        // this.r_fore = new Arc("r_fore", this.scene, translation(arm_length/2, 0, 0), this.r_arm);
        // this.r_fore.set_dof(true, true, false);
        // this.r_fore.add_shape(shapes.ball(joint_size), body_color)
        // arm_transform = new T.Matrix4();
        // arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
        //     .premultiply(new T.Matrix4().makeTranslation(arm_length / 4, 0, 0)); // Step 2: Apply translation
        // this.r_fore.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), r_color, arm_transform);

        // this.r_hand = new Arc("r_hand", this.scene, translation(arm_length/2, 0, 0), this.r_fore);
        // this.r_hand.add_shape(shapes.ball(hand_size), body_color)

        // this.l_arm = new Arc("l_arm", this.scene, translation(-body_width/2 - joint_size/2, body_height/2 - joint_size / 2 , 0), this.body);
        // this.l_arm.set_dof(true, true, true);
        // this.l_arm.add_shape(shapes.ball(joint_size), body_color);
        // arm_transform = new T.Matrix4();
        // arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
        //     .premultiply(new T.Matrix4().makeTranslation(-arm_length / 4, 0, 0)); // Step 2: Apply translation
        // this.l_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), l_color, arm_transform);

        // this.l_fore = new Arc("l_fore", this.scene, translation(-arm_length/2, 0, 0), this.l_arm);
        // this.l_fore.set_dof(true, true, false);
        // this.l_fore.add_shape(shapes.ball(joint_size), body_color)
        // arm_transform = new T.Matrix4();
        // arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
        //     .premultiply(new T.Matrix4().makeTranslation(-arm_length / 4, 0, 0)); // Step 2: Apply translation
        // this.l_fore.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), l_color, arm_transform);
        
        // this.l_hand = new Arc("l_hand", this.scene, translation(-arm_length/2, 0, 0), this.l_fore);
        // this.l_hand.add_shape(shapes.ball(hand_size), body_color)

        // // LEGS
        // this.r_thigh = new Arc("r_thigh", this.scene, translation(body_width/2 - joint_size, 0,0), this.core) 
        // this.r_thigh.add_shape(shapes.ball(leg_size), body_color) 
        // let leg_transform = new T.Matrix4();
        // leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        // this.r_thigh.add_shape( shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);

        // this.r_shin = new Arc("r_shin", this.scene, translation(0, -leg_length/2,0), this.r_thigh) 
        // this.r_shin.add_shape(shapes.ball(leg_size * 1.05), body_color) 
        // leg_transform = new T.Matrix4();
        // leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        // this.r_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        // this.r_foot = new Arc("r_foot", this.scene, translation(0, -leg_length/2, 0), this.r_shin);
        // this.r_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);

        // this.l_thigh = new Arc("l_thigh", this.scene, translation(-body_width/2 + joint_size, 0,0), this.core) 
        // this.l_thigh.add_shape(shapes.ball(leg_size), body_color) 
        // leg_transform = new T.Matrix4();
        // leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        // this.l_thigh.add_shape( shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        // this.l_shin = new Arc("l_shin", this.scene, translation(0, -leg_length/2,0), this.l_thigh) 
        // this.l_shin.add_shape(shapes.ball(leg_size * 1.05), body_color) 
        // leg_transform = new T.Matrix4();
        // leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        // this.l_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);

        // this.l_foot = new Arc("l_foot", this.scene, translation(0, -leg_length/2, 0), this.l_shin);
        // this.l_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);

        // // End Effectors
        // this.r_end = new End_Effector("r_end", this.scene, v3(0, 0, 0), this.r_hand);
        // // this.r_end.add_shape(shapes.ball)
        // this.l_end = new End_Effector("l_end", this.scene, v3(0, 0, 0), this.l_hand);
    }

    move_end_effector(targetPos) {
        // this.r_end.solve_ik(targetPos);
    }
}