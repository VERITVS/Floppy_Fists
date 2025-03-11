import * as T from 'three'
import { Matrix4 } from 'three/webgpu';
import {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos} from './defs.js'
import { Arc, End_Effector } from './heirarchy.js';
import { HermiteCurve } from './hermite.js';

export class PlayerModel {
    constructor(scene, position = v3(0, 0, 0)) {
        const body_width = 5;
        const body_depth = 1.75;
        const body_height = 7.5;
        const arm_length = 12;
        const leg_length = 13.0;
        const joint_size = body_depth/2  * 1.05;
        const leg_size = joint_size * 1.35;
        const hand_size = joint_size;
        const head_size = body_width/2.5;
        const upper_arm_ratio = 5/9;
        const fore_arm_ratio = 4/9;

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
        this.core.set_length(0);

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
        this.body.set_length(0);

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
            .premultiply(new T.Matrix4().makeTranslation(arm_length * upper_arm_ratio / 2, 0, 0)); // Step 2: Apply translation
        this.r_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length * upper_arm_ratio), r_color, arm_transform);
        this.r_arm.set_length(arm_length * upper_arm_ratio);

        this.r_fore = new Arc("r_fore", this.scene, translation(arm_length * upper_arm_ratio, 0, 0), this.r_arm);
        this.r_fore.set_dof(true, true, false);
        this.r_fore.add_shape(shapes.ball(joint_size), body_color)
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(arm_length * fore_arm_ratio / 2, 0, 0)); // Step 2: Apply translation
        this.r_fore.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length * fore_arm_ratio), r_color, arm_transform);
        this.r_fore.set_length(arm_length * fore_arm_ratio);

        this.r_end = new End_Effector("r_end", this.scene, translation(arm_length * fore_arm_ratio, 0, 0), this.r_fore)
        this.r_end.set_dof(false, false, false)
        this.r_end.add_shape(shapes.ball(hand_size), body_color)
        this.r_end.set_length(0);
        
        this.l_arm = new Arc("l_arm", this.scene, translation(-body_width/2 - joint_size/2, body_height - joint_size / 2 , 0), this.body);
        this.l_arm.set_dof(true, true, true);
        this.l_arm.add_shape(shapes.ball(joint_size), body_color);
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(-arm_length * upper_arm_ratio / 2, 0, 0)); // Step 2: Apply translation
        this.l_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length * upper_arm_ratio), l_color, arm_transform);
        this.l_arm.set_length(arm_length * upper_arm_ratio);

        this.l_fore = new Arc("l_fore", this.scene, translation(-arm_length * upper_arm_ratio, 0, 0), this.l_arm);
        this.l_fore.set_dof(true, true, false);
        this.l_fore.add_shape(shapes.ball(joint_size), body_color)
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(-arm_length * fore_arm_ratio / 2, 0, 0)); // Step 2: Apply translation
        this.l_fore.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length * fore_arm_ratio), l_color, arm_transform);
        this.l_fore.set_length(arm_length * fore_arm_ratio);
        
        this.l_end = new End_Effector("l_end", this.scene, translation(-arm_length * fore_arm_ratio, 0, 0), this.l_fore)
        this.l_end.set_dof(false, false, false);
        this.l_end.add_shape(shapes.ball(hand_size), body_color);
        this.l_end.set_length(0);

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


        // Defining Path Positions
        const hermite_curve = new HermiteCurve(20);

        // Add points and tangents
        
        console.log('bel',this.core.node.core.getWorldPosition(v3(0,0,0)));
        // this.r_arm.set_articulation([0, Math.PI/2, 0]);
        this.poses = {
            p_beg: {x: body_width/2, y: 4, z: arm_length * 0.25},
            v_beg: {x: 10, y: 0, z: -10},
            v_end: {x: -10, y: 10, z: 0},
            p_end: {x: body_width/2, y: body_height, z:-arm_length * 0.75}
        };

        const r = this.poses.p_beg;
        const v_beg = this.poses.v_beg;
        const v_end = this.poses.v_end;
        const e = this.poses.p_end;
        
        /***********
        *
        *   DEFINING PUNCHES
        *
        ***********/
        this.r_punch = {};
        this.r_punch['mid_curve'] =  new HermiteCurve(20);
        this.r_punch['mid_curve'].add_point(r.x, r.y, -r.z, v_beg.x, v_beg.y, v_beg.z);
        this.r_punch['mid_curve'].add_point(e.x, e.y, e.z, v_end.x, v_end.y, v_end.z);
        this.r_punch['mid'] = this.r_punch['mid_curve'].create_line(),

        this.l_punch = {};
        this.l_punch['mid_curve'] =  new HermiteCurve(20);
        this.l_punch['mid_curve'].add_point(- r.x, r.y, -r.z, -v_beg.x, v_beg.y, v_beg.z);
        this.l_punch['mid_curve'].add_point(- e.x, e.y, e.z, -v_end.x, v_end.y, v_end.z);;
        this.l_punch['mid'] = this.l_punch['mid_curve'].create_line(),

        this.body.node.core.add(this.r_punch.mid);
        this.body.node.core.add(this.l_punch.mid);
    }

    get_pos_r_hand() {
        return this.r_end.get_global_position();
    }

    get_r_punch_pos(t, strike_path = 'mid_curve') {
        return this.r_punch[strike_path].get_pos(t,  this.core.node.core.matrixWorld)
    }

    get_pos_l_hand() {
        return this.l_end.get_global_position();
    }

    get_l_punch_pos(t, strike_path = 'mid_curve') {
        return this.l_punch[strike_path].get_pos(t,  this.core.node.core.matrixWorld)
    }

    move_r(target) {
        this.r_end.solve_ik(target)
    }

    move_l(target) {
        this.l_end.solve_ik(target)
    }

    move_by(x = 0, y = 0, z = 0) {
        this.core.node.core.translateX(x)
        this.core.node.core.translateY(y)
        this.core.node.core.translateZ(z)
    }

    rotate(y = 0) {
        this.core.node.core.rotateY(y)

    }
}