import * as T from 'three'
import { Matrix4 } from 'three/webgpu';
import {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos, signed_angle} from './defs.js'
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
        this.core.set_dof(false, true, false)
        let core_transform = new T.Matrix4();
        core_transform.makeRotationZ(T.MathUtils.degToRad(90)); // Step 1: Apply rotation // Step 2: Apply translation
        this.core.add_shape( shapes.tube(body_depth * 1.25 / 2, body_depth  * 1.25 / 2, body_width / 3), body_color, core_transform);
        this.core.set_length(0);

        this.body = new Arc("body", this.scene, translation(0, joint_size, 0), this.core);
        this.body.set_dof(false, true, false)
        this.body.add_shape(shapes.ball(1
        ), body_color)
        this.body.add_shape(shapes.box(body_width - body_depth, body_height, body_depth), body_color, translation(0, body_height/2, 0));
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(body_width/4, body_height/2, 0))
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(-body_width/4, body_height/2, 0))
        core_transform.makeRotationZ(T.MathUtils.degToRad(90)) 
            .premultiply(new T.Matrix4().makeTranslation(0, body_height - body_depth/4, 0));
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
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) 
            .premultiply(new T.Matrix4().makeTranslation(arm_length * upper_arm_ratio / 2, 0, 0)); 
        this.r_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length * upper_arm_ratio), r_color, arm_transform);
        this.r_arm.set_length(arm_length * upper_arm_ratio);

        this.r_fore = new Arc("r_fore", this.scene, translation(arm_length * upper_arm_ratio, 0, 0), this.r_arm);
        this.r_fore.set_dof(true, true, false);
        this.r_fore.add_shape(shapes.ball(joint_size), body_color)
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) 
            .premultiply(new T.Matrix4().makeTranslation(arm_length * fore_arm_ratio / 2, 0, 0)); 
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
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) 
            .premultiply(new T.Matrix4().makeTranslation(-arm_length * upper_arm_ratio / 2, 0, 0)); 
        this.l_arm.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length * upper_arm_ratio), l_color, arm_transform);
        this.l_arm.set_length(arm_length * upper_arm_ratio);

        this.l_fore = new Arc("l_fore", this.scene, translation(-arm_length * upper_arm_ratio, 0, 0), this.l_arm);
        this.l_fore.set_dof(true, true, false);
        this.l_fore.add_shape(shapes.ball(joint_size), body_color)
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90)) 
            .premultiply(new T.Matrix4().makeTranslation(-arm_length * fore_arm_ratio / 2, 0, 0)); 
        this.l_fore.add_shape( shapes.tube(body_depth / 2, body_depth / 2, arm_length * fore_arm_ratio), l_color, arm_transform);
        this.l_fore.set_length(arm_length * fore_arm_ratio);
        
        this.l_end = new End_Effector("l_end", this.scene, translation(-arm_length * fore_arm_ratio, 0, 0), this.l_fore)
        this.l_end.set_dof(false, false, false);
        this.l_end.add_shape(shapes.ball(hand_size), body_color);
        this.l_end.set_length(0);

        // LEGS
        this.r_thigh = new Arc("r_thigh", this.scene, translation(body_width/2 - joint_size, 0,0), this.core) 
        this.r_thigh.set_dof(true, false, true)
        this.r_thigh.add_shape(shapes.ball(leg_size), body_color) 
        let leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0));
        this.r_thigh.add_shape( shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);
        this.r_thigh.set_articulation([0,0,0])

        this.r_shin = new Arc("r_shin", this.scene, translation(0, -leg_length/2,0), this.r_thigh) 
        this.r_shin.set_dof(true, false, false);
        this.r_shin.add_shape(shapes.ball(leg_size * 1.05), body_color) 
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); 
        this.r_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        this.r_foot = new Arc("r_foot", this.scene, translation(0, -leg_length/2, 0), this.r_shin);
        this.r_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);

        this.l_thigh = new Arc("l_thigh", this.scene, translation(-body_width/2 + joint_size, 0,0), this.core) 
        this.l_thigh.set_dof(true, false, true)
        this.l_thigh.add_shape(shapes.ball(leg_size), body_color) 
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); 
        this.l_thigh.add_shape( shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        this.l_shin = new Arc("l_shin", this.scene, translation(0, -leg_length/2,0), this.l_thigh) 
        this.l_shin.set_dof(true, false, false);
        this.l_shin.add_shape(shapes.ball(leg_size * 1.05), body_color) 
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0)); 
        this.l_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);

        this.l_foot = new Arc("l_foot", this.scene, translation(0, -leg_length/2, 0), this.l_shin);
        this.l_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);

        this.norm = new Arc("norm", this.scene, translation(0, 0, -5), this.head);
        this.norm.add_shape(shapes.ball(1), hidden)

        this.core_norm = new Arc("core_norm", this.scene, translation(5, 0, 0), this.core);
        this.core_norm.add_shape(shapes.ball(1), hidden)

        this.front = new Arc("core_norm", this.scene, translation(0, 0, -5), this.core);
        this.front.add_shape(shapes.ball(1), hidden)


        this.r_arm.set_articulation([Math.PI/2, 0, 0])
        this.r_fore.set_articulation([0, 0])
        this.l_arm.set_articulation([0, 0 ,0])
        // Defining Path Positions

        this.facing_angle = 0;

        this.r_arm_rotation = [0, 0, 0]; // Stores [Rx, Ry, Rz]
        this.l_arm_rotation = [0, 0, 0];    
        // Add points and tangents

        this.cam = new Arc("cam", this.scene, translation(10, 0, 15), this.core);
        // this.cam.add_shape(shapes.ball(1), color());
        
        this.poses = {
            p_beg: {x: body_width/2, y: 4, z: - arm_length * 0.25},
            v_beg: {x: 15, y: -20, z: -10},
            v_end: {x: -15, y: 10, z: 0},
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
        this.r_punch_start_pos = this.r_end.get_global_position();
        this.l_punch_start_pos = this.l_end.get_global_position();
        // Get Positions
    
        this.pose = {
            close_r_arm: [Math.PI/2, 0, -2],
            // close_r_fore: [0,0],
            close_r_fore: [0, Math.PI * 0.8],
            close_l_arm: [Math.PI/2, 0, 2],
            close_l_fore: [0, 0],
            close_l_fore: [0, Math.PI * -0.8],
            open_arm: [0, 0, 0],
            open_fore: [0, 0]
        }
        let p = this.pose;
        let time = 0;

        this.r_time = 0; // Keeps Track of Punch Time
        this.l_time = 0; // Set to 2 to reset punch

    }

    add_punch() {
        // Reset Punch Time if punch time is available
        // Full extended punch = 2
        if(this.r_time <= 0) {
            this.r_punch_start_pos = this.r_arm.get_global_position();
            this.r_time = 2;
        } else if (this.l_time <= 0 && this.r_time < 1.75) {
            this.l_punch_start_pos = this.r_arm.get_global_position();
            this.l_time = 2;
        }
    }

    do_punch(dt, speed = 5, sway = null, t = 0) {
        let l_sway = 0;
        let r_sway = 0;
        if (sway) l_sway = Math.sin(t * 3) * sway;
        if (sway) r_sway = Math.cos(t * 3) * sway;

        let r_time = 0;
        let l_time = 0;
        if (this.r_time > 0) {
            this.r_time -= dt * speed;
            r_time = (this.r_time > 1) ? 2 - this.r_time : this.r_time;
        }
        if (this.l_time > 0) {
            this.l_time -= dt * speed;
            l_time = (this.l_time > 1) ? 2 - this.l_time : this.l_time;
        }

        // Set Positions
        let open_ra = [Math.PI/2, null, 0];
        let close_ra = [l_sway, null, r_sway];
        let open_la = [0, null, 0];
        let close_la = [0 + r_sway, null, 0 + l_sway];
        let cur_ra = [this.r_arm.dof.Rx, null, this.r_arm.dof.Rz];
        let cur_la = [this.l_arm.dof.Rx, null, this.l_arm.dof.Rz];

        let open_fore = [0 ,0];
        let close_rf = [0, 2];
        let close_lf = [0, -2];
        let cur_rf = [this.r_fore.dof.Rx, this.r_fore.dof.Ry];
        let cur_lf = [this.l_fore.dof.Rx, this.l_fore.dof.Ry];

        let smoothing_factor = 1;
        let smooth_ra = lerp(cur_ra, lerp(close_ra, open_ra, r_time), smoothing_factor);
        let smooth_rf = lerp(cur_rf, lerp(close_rf, open_fore, r_time), smoothing_factor);
        let smooth_la = lerp(cur_la, lerp(close_la, open_la, l_time), smoothing_factor);
        let smooth_lf = lerp(cur_lf, lerp(close_lf, open_fore, l_time), smoothing_factor);
        
        this.r_arm.set_articulation(smooth_ra);
        this.r_fore.set_articulation(smooth_rf);
        this.l_arm.set_articulation(smooth_la);
        this.l_fore.set_articulation(smooth_lf);
    }    
    

    get_front_norm(is_limb = true) { // Gets front facing of either head if limb, or core if non-limb
        const head = (is_limb) ? this.head.get_global_position() : this.core.get_global_position();
        const front = (is_limb) ? this.norm.get_global_position() : this.core_norm.get_global_position();

        return v3(front.x - head.x, front.y - head.y, front.z - head.z).normalize();
    }
    
    target(target, sway, time) { // Expects a target position
        this.body_target(target)
        this.r_arm_target(target, 1.1, sway, time);
        this.l_arm_target(target, 1.1, sway, time);
    }

    body_target(target) {
        let head = this.core.get_global_position();
        let norm = this.core_norm.get_global_position();
        let v_arm = v3(norm.x - head.x, 0, norm.z - head.z); 
        let v_tar = v3(target.x - head.x, 0, target.z - head.z); 

        const offset = Math.PI/2 * 0.3;
        const min_ang = 0 + offset;
        const max_ang = Math.PI - offset;

        let new_angle = signed_angle(v_arm, v_tar, v3(0, 1, 0));
        
        this.body.set_articulation([new_angle - Math.PI/2])
    }

    move_legs(t, speed_multiplier = 1) {
        t *= speed_multiplier;
        this.r_thigh.set_articulation([(0) * 0.5, Math.sin(t * 5) * 0.2])
        this.l_thigh.set_articulation([(0) * 0.5, Math.cos(t * 5) * 0.2])
        this.r_shin.set_articulation([(Math.cos(t*4 + 0.25) - 0.8) * 0.5]);
        this.l_shin.set_articulation([(Math.sin(t*4 - 0.25) - 0.8) * 0.5]);

        let l_height = this.l_foot.get_global_position().y;
        let r_height = this.r_foot.get_global_position().y

        let lowest = (l_height < r_height) ? l_height : r_height;
        this.move_by(0, -lowest + 0.5, 0);
    }

    r_arm_target(target, ang_mult = 1, sway = null, t = 0) {
        let r_arm_pos = this.head.get_global_position();
        let r_fore_pos = this.r_arm.get_global_position();
        let v_arm = v3(r_fore_pos.x - r_arm_pos.x, 0, r_fore_pos.z - r_arm_pos.z); 
        let v_tar = v3(target.x - r_arm_pos.x, 0, target.z - r_arm_pos.z); 
        let new_angle = signed_angle(v_arm, v_tar, v3(0, 1, 0)) * ang_mult;

        let sway_offset = 0;
        if (sway) sway_offset = Math.cos(t * 3) * sway;
        this.r_arm.set_articulation([this.r_arm.dof.Rx, new_angle + sway_offset, this.r_arm.dof.Rz])
    }

    l_arm_target(target, ang_mult = 1, sway = null, t = 0) {
        let l_arm_pos = this.head.get_global_position();
        let l_fore_pos = this.l_arm.get_global_position();
        let v_arm = v3(l_fore_pos.x - l_arm_pos.x, 0, l_fore_pos.z - l_arm_pos.z); 
        let v_tar = v3(target.x - l_arm_pos.x, 0, target.z - l_arm_pos.z); 
        let new_angle = signed_angle(v_arm, v_tar, v3(0, 1, 0)) * ang_mult;

        let sway_offset = 0;
        if (sway) sway_offset = Math.sin(t * 3) * sway;
        this.l_arm.set_articulation([this.l_arm.dof.Rx, new_angle + sway_offset, this.l_arm.dof.Rz])
    }

    is_infront(point) {
        const head = this.head.get_global_position();
        const norm = this.get_front_norm();
        // n dot (a - p)
        const diff = v3(point.x - head.x, 0, point.z - head.z);
        const result = norm.dot(diff);


        return (result >= 0);
    }

    get_pos_r_hand() {
        return this.r_end.get_global_position();
    }

    get_pos_l_hand() {
        return this.l_end.get_global_position();
    }

    move_by(x = 0, y = 0, z = 0, rotate = false) {
        if(x instanceof T.Vector3) {
            z = x.z;
            y = x.y;
            x = x.x;
        }
        let core = this.core.get_global_position();
        this.core.node.core.position.x = core.x + x
        this.core.node.core.position.y = core.y + y
        this.core.node.core.position.z = core.z + z

        if(!this.cam.hasOwnProperty('position')) return;
        this.cam.position.y = 15 - core.y - this.cam.position.y;
    }

    move_to(x = null, y = null, z = null) {  
        x = (x == null) ? this.core.node.core.position.x : x; 
        y = (y == null) ? this.core.node.core.position.y : y; 
        z = (z == null) ? this.core.node.core.position.z : z;

        this.core.node.core.position.x = x;
        this.core.node.core.position.y = y;
        this.core.node.core.position.z = z;
    }

    rotate(y) { // Set rotation to face a certain direction
        this.core.set_articulation([y])
    }

    checkBoundaries(arenaSize) {
        const position = this.core.get_global_position();
        
        if (Math.abs(position.x) > arenaSize * 0.9) {
            const clampedX = Math.sign(position.x) * arenaSize * 0.9;
            const deltaX = clampedX - position.x;
            this.player.move_by(deltaX, 0, 0);
        }
        
        if (Math.abs(position.z) > arenaSize * 0.9) {
            const clampedZ = Math.sign(position.z) * arenaSize * 0.9;
            const deltaZ = clampedZ - position.z;
            this.player.move_by(0, 0, deltaZ);
        }
    }
}

function lerp(theta_1, theta_2, amt = 0) {
    if(amt > 1) amt = 1;
    if(amt < 0) amt = 0;  
    let n_theta = [];

    for (let i = 0; i < theta_1.length; i++) {
        if(theta_1[i] == null || theta_2[i] == null) {
            n_theta.push(null);
            continue;
        }
        let ang = theta_1[i] * (1 - amt) + theta_2[i] * amt;
        n_theta.push(ang);
    }

    return n_theta;
}