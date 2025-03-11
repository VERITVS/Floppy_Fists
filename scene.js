import * as T from 'three';
import { OrbitControls, OutlineEffect, TextGeometry} from 'three/examples/jsm/Addons.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { deltaTime, max, mx_fractal_noise_vec2, step, vec3 } from 'three/tsl';
import { Mesh, Quaternion } from 'three/webgpu';
import {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos} from './Model/defs.js'
import { Arc, End_Effector } from './Model/heirarchy.js';
import { PlayerModel} from './Model/model.js'



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


        let l_hand_pos = v3(0, 10, 10);
        // this.l_hand.node.model[0].getWorldPosition(l_hand_pos);
        console.log(l_hand_pos)
        this.circle = new T.Mesh(shapes.ball(2), color());
        set_pos(this.circle, l_hand_pos)
        this.scene.add(this.circle)

        // this.r_end = new End_Effector("r_end", this.scene, translation(0,0,0), this.r_hand)
        // this.r_end.solve_ik(l_hand_pos)

        this.player = new PlayerModel(this.scene)

        
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
        this.scene.add(this.circle);

        // FOLLOW HANDS
        this.l_ball = make_obj(shapes.ball(1.5), color(), this.player.get_pos_l_hand())
        this.r_ball = make_obj(shapes.ball(1.5), color(), this.player.get_pos_r_hand())
        this.scene.add(this.l_ball)
        this.scene.add(this.r_ball)
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
        // this.r_fore.set_articulation([0, 1, 1])
        // this.l_fore.set_articulation([0, 1, 0])
        if(this.l_ball != null) {
            set_pos(this.l_ball, this.player.get_pos_l_hand())
            set_pos(this.r_ball, this.player.get_pos_r_hand())
        }
        
        let rad = 4;
        let r_pos = this.player.r_arm.get_global_position()
        let l_pos = this.player.l_arm.get_global_position()

        // Some weird reason, target position needs z>0
        this.target_r = v3(r_pos.x + 2, r_pos.y + rad * (Math.cos(this.t) - 1), r_pos.z + 0.1);
        this.target_l = v3(l_pos.x - rad * Math.sin(this.t), l_pos.y + rad * Math.sin(this.t), l_pos.z + rad * Math.cos(this.t));
        // this.target = v3(11, 23, -1)
        if(this.l_ball != null) {
            set_pos(this.l_ball, this.target_l.x, this.target_l.y, this.target_l.z)
            set_pos(this.r_ball, this.target_r.x, this.target_r.y, this.target_r.z)
        }
        // this.player.r_fore.inc_articulation([0, 0.1, 0])
        this.player.move_r(this.target_r)
        this.player.move_l(this.target_l)

        this.effect.render(this.scene, this.camera);
    }

    hidden() {
        return new T.MeshToonMaterial({visible: false})
    }
}
