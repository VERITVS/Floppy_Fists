import * as T from 'three';
import { OrbitControls, OutlineEffect, TextGeometry} from 'three/examples/jsm/Addons.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { deltaTime, max, step, vec3 } from 'three/tsl';
import { Mesh, Quaternion } from 'three/webgpu';
import { hidden,  color, Node, Arc, identity, translation, make_obj, shapes, End_Effector} from './Model/heirarchy.js'
// import {Arc, End_Effector, color} from './Model/heirarchy'
// import {color, shapes} from './Test_Model/helpers.js'
// import {Model} from './Test_Model/heirarchy.js'

export class FloppyFists {
    // Initialize values to use in Scenes
    constructor () {
        /********************************************
         * 
         *  Setting Up Environment
         * 
         *******************************************/
        this.container = document.createElement( 'div' );
        document.body.appendChild( this.container );
    
        this.camera = new T.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
        this.camera.position.set( 0.0, 40,  50 );
    
        this.scene = new T.Scene();
        this.scene.background = new T.Color( 0x444488 );
    
        this.renderer = new T.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.setAnimationLoop(this.animate.bind(this));
        this.container.appendChild( this.renderer.domElement );


        /********************************************
         * 
         *  MATERIALS
         * 
         *******************************************/
        const shades = new Uint8Array( 40 ); // How many shadedportions in the sphere
        for ( let c = 0; c <= shades.length; c ++ ) {   // Make a rainbow out of the colors
            shades[ c ] = ( c /shades.length) * 256;
        }
        this.gradientMap = new T.DataTexture( shades, shades.length, 1, T.RedFormat );
        this.gradientMap.needsUpdate = true;

        // CALL TOON TO GET COLOR OF WHATEVER IS PASSED, NO ARGS = random color

        /********************************************
         * 
         *  SHAPES
         * 
         ********************************************


         /********************************************
         * 
         *  LIGHTS & EFFECTS
         * 
         *******************************************/
        this.particleLight = new T.Mesh(
                new T.SphereGeometry( 2, 8, 8 ),
                new T.MeshBasicMaterial( { color: 0xffffff } )
            );
        this.scene.add( this.particleLight );
        this.scene.add( new T.AmbientLight( 0xa1a1a1, 3 ) );

        this.pointLight = new T.PointLight( 0xffffff, 2, 800, 0 );
        this.particleLight.add( this.pointLight );

        this.effect = new OutlineEffect(this.renderer);

        /********************************************
         * 
         *  CONTROLS
         * 
         *******************************************/
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.minDistance = 30;
        this.controls.maxDistance = 2000;
        this.controls.maxPolarAngle = Math.PI/2 - 0.05;
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );


         /********************************************
         * 
         *  RUNTIME VARIABLES
         * 
         *******************************************/
        this.clock = new T.Clock();

        // this.model = new Model(this.scene)

         /********************************************
         * 
         *  TEST ENVIRONMENTS
         * 
         *******************************************/
        //  this.sample = new Node(this.scene, this.scene)
        //  this.sample.add_shape()
        //  this.sample.add_shape()

        // this.sample = new Arc("ex", this.scene)
        // this.sample.add_shape(shapes.ball(6), identity().makeTranslation(0, 0, 20), color())
        // this.sample.add_shape(shapes.box(20, 20, 0.1))
        // console.log("sample: ", this.sample.node)

        // this.sample2 = new Arc("ex2", this.scene, translation(0, 0, 40), this.sample)
        // this.sample2.add_shape(shapes.ball(6))

        // this.sample2 = new Arc("ex3", this.scene, translation(0, 0, 20), this.sample2)
        // this.sample2.add_shape(shapes.ball(6))

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
        let core_transform = new T.Matrix4();
        core_transform.makeRotationZ(T.MathUtils.degToRad(90)); // Step 1: Apply rotation // Step 2: Apply translation
        this.core.add_shape( shapes.tube(body_depth * 1.25 / 2, body_depth  * 1.25 / 2, body_width / 3), body_color, core_transform);

        this.body = new Arc("body", this.scene, translation(0, body_height/2 + joint_size/2, 0), this.core);
        this.body.add_shape(shapes.box(body_width - body_depth, body_height, body_depth), body_color);
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(body_width/3, 0, 0))
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(-body_width/3, 0, 0))
        core_transform.makeRotationZ(T.MathUtils.degToRad(90)) // Step 1: Apply rotation
            .premultiply(new T.Matrix4().makeTranslation(0, body_height/2 - body_depth/4, 0)); // Step 2: Apply translation
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_width), body_color, core_transform)

        this.head = new Arc("head", this.scene, translation(0, body_height/2 + head_size, 0), this.body); 
        this.head.add_shape(shapes.ball(head_size), body_color, translation(0, 0, 0))
        this.head.add_shape(shapes.ball(head_size).scale(1, 0.2, 1), l_color, translation(0, head_size/2, 0))
        this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(0.25), l_color, translation( 0.75, 0, head_size));;
        this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(-0.25), l_color, translation( 0.75, 0, head_size));;


        // ARMS
        this.r_arm = new Arc("r_arm", this.scene, translation(body_width/2 + joint_size/2, body_height/2 - joint_size / 2, 0), this.body);
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

        this.r_hand = new Arc("r_hand", this.scene, translation(arm_length/2, 0, 0), this.r_fore);
        this.r_hand.add_shape(shapes.ball(hand_size), body_color)

        this.l_arm = new Arc("l_arm", this.scene, translation(-body_width/2 - joint_size/2, body_height/2 - joint_size / 2 , 0), this.body);
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
        
        this.l_hand = new Arc("l_hand", this.scene, translation(-arm_length/2, 0, 0), this.l_fore);
        this.l_hand.add_shape(shapes.ball(hand_size), body_color)

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
        

        let l_hand_pos = v3(0, 0, 0);
        this.l_hand.node.model[0].getWorldPosition(l_hand_pos);
        console.log(l_hand_pos)

        
        // let t_obj = make_obj(shapes.ball(1), color(255, 255, 255), translation(l_hand_pos))
        // this.scene.add(t_obj

        // console.log("sample2:", this.sample2.node.core)
    }

    // Initialize Environment 
    init() {
        /********************************************
         * 
         *  Setting Up Environment
         * 
         *******************************************/
        this.t = 0;
        
        // this.camera.position.set( 0.0, 300, 200 * 3.5 );
        let floor = new T.Mesh(shapes.box(1400, 0.1, 1400), color(120, 120, 120));
        this.scene.add(floor)

        this.circle = new T.Mesh(shapes.ball(0.11), color());
        set_pos(this.circle, 0, 0, 0);
        this.scene.add(this.circle);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    
    }

    // Called when animating
    animate() {
        this.render();
    }

    // Drawing Scene
    render() {
        let dt = this.clock.getDelta();
        this.t += dt;
        const light_pos = v3(Math.sin( this.t  ) * 100,  Math.cos( this.t * 0.8 ) * 200 + 20,  Math.cos( this.t * 0.6 ) * 100);
        set_pos(this.particleLight, light_pos.x, 20, light_pos.z);

        const min = (x, y) => {return (x > y) ? y : x}; 
        const max = (x, y) => {return (x < y) ? y : x}; 
        this.target = v3(Math.cos(this.t), 10, -1);
        set_pos(this.circle, this.target.x, this.target.y, this.target.z)
 
        this.r_fore.set_articulation([0, 1, 0])

        this.effect.render(this.scene, this.camera);
    }

    hidden() {
        return new T.MeshToonMaterial({visible: false})
    }
}

function set_pos(element, x = null, y = null, z = null) {
    if(x) element.position.x = x;
    if(y) element.position.y = y;
    if(z) element.position.z = z;
}

function v3(x = 0, y = 0, z = 0) {
    return new T.Vector3(x, y, z);
}