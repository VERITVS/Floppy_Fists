import * as T from 'three'
import { Matrix4 } from 'three/webgpu';
import {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos} from './defs.js'
import { Arc, End_Effector } from './heirarchy.js';

export class PlayerModel {
    constructor(scene, position = v3(0, 0, 0)) {
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
        position = v3(position.x, position.y + leg_length + leg_size, position.z);

        this.scene = scene

        this.core = new Arc("core", this.scene, translation(position.x, position.y, position.z))
        this.core.set_dof(false, false, false)
        let core_transform = new T.Matrix4();
        core_transform.makeRotationZ(T.MathUtils.degToRad(90)); // Step 1: Apply rotation // Step 2: Apply translation
        this.core.add_shape( shapes.tube(body_depth * 1.25 / 2, body_depth  * 1.25 / 2, body_width / 3), body_color, core_transform);

        this.body = new Arc("body", this.scene, translation(0, joint_size, 0), this.core);
        this.body.set_dof(false, false, false)
        this.body.add_shape(shapes.ball(1
        ), body_color)
        this.body.add_shape(shapes.box(body_width - body_depth, body_height, body_depth), body_color, translation(0, body_height/2, 0));
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(body_width/4, body_height/2, 0))
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(-body_width/4, body_height/2, 0))
        core_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(0, body_height - body_depth/4, 0)); // Step 2: Apply translation
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_width), body_color, core_transform)

        this.head = new Arc("head", this.scene, translation(0, body_height + head_size, 0), this.body); 
        this.head.add_shape(shapes.ball(head_size), body_color, translation(0, 0, 0))
        this.head.add_shape(shapes.ball(head_size).scale(1, 0.2, 1), l_color, translation(0, head_size/2, 0))
        this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(0.25), l_color, translation( 0.75, 0, head_size));;
        this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(-0.25), l_color, translation( 0.75, 0, head_size));;

        // ARMS
        this.r_arm = new Arc("r_arm", this.scene, translation(body_width/2 + joint_size/2, body_height - joint_size / 2, 0), this.body);
        this.r_arm.set_dof(true, true, true);
        this.r_arm.add_shape(shapes.ball(joint_size), body_color);
        let arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(arm_length / 4, 0, 0)); // Step 2: Apply translation
        this.r_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), r_color, arm_transform);

        this.r_fore = new Arc("r_fore", this.scene, translation(arm_length/2, 0, 0), this.r_arm);
        this.r_fore.set_dof(true, true, false);
        this.r_fore.add_shape(shapes.ball(joint_size), body_color)
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(arm_length / 4, 0, 0)); // Step 2: Apply translation
        this.r_fore.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), r_color, arm_transform);

        this.r_end = new End_Effector("r_end", this.scene, translation(arm_length/2, 0, 0), this.r_fore)
        this.r_end.set_dof(false, false, false)
        this.r_end.add_shape(shapes.ball(hand_size), body_color)
        
        this.l_arm = new Arc("l_arm", this.scene, translation(-body_width/2 - joint_size/2, body_height - joint_size / 2 , 0), this.body);
        this.l_arm.set_dof(true, true, true);
        this.l_arm.add_shape(shapes.ball(joint_size), body_color);
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(-arm_length / 4, 0, 0)); // Step 2: Apply translation
        this.l_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), l_color, arm_transform);

        this.l_fore = new Arc("l_fore", this.scene, translation(-arm_length/2, 0, 0), this.l_arm);
        this.l_fore.set_dof(true, true, false);
        this.l_fore.add_shape(shapes.ball(joint_size), body_color)
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(-arm_length / 4, 0, 0)); // Step 2: Apply translation
        this.l_fore.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length / 2), l_color, arm_transform);
        
        this.l_end = new End_Effector("l_end", this.scene, translation(-arm_length/2, 0, 0), this.l_fore)
        this.l_end.set_dof(false, false, false);
        this.l_end.add_shape(shapes.ball(hand_size), body_color)

        // LEGS
        this.r_thigh = new Arc("r_thigh", this.scene, translation(body_width/2 - joint_size, 0,0), this.core) 
        this.r_thigh.add_shape(shapes.ball(leg_size), body_color) 
        let leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        this.r_thigh.add_shape( shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);

        this.r_shin = new Arc("r_shin", this.scene, translation(0, -leg_length/2,0), this.r_thigh) 
        this.r_shin.add_shape(shapes.ball(leg_size * 1.05), body_color) 
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        this.r_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        this.r_foot = new Arc("r_foot", this.scene, translation(0, -leg_length/2, 0), this.r_shin);
        this.r_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);

        this.l_thigh = new Arc("l_thigh", this.scene, translation(-body_width/2 + joint_size, 0,0), this.core) 
        this.l_thigh.add_shape(shapes.ball(leg_size), body_color) 
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        this.l_thigh.add_shape( shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        this.l_shin = new Arc("l_shin", this.scene, translation(0, -leg_length/2,0), this.l_thigh) 
        this.l_shin.add_shape(shapes.ball(leg_size * 1.05), body_color) 
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); // Step 2: Apply translation
        this.l_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);

        this.l_foot = new Arc("l_foot", this.scene, translation(0, -leg_length/2, 0), this.l_shin);
        this.l_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);

    }

    get_pos_r_hand() {
        return this.r_end.get_global_position();
    }

    get_pos_l_hand() {
        return this.l_end.get_global_position();
    }

    move_r(target) {
        this.r_end.solve_ik(target)
    }

    move_l(target) {
        this.l_end.solve_ik(target)
    }
}