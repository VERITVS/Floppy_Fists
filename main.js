import * as THREE from 'three';
import { OrbitControls, OutlineEffect, TextGeometry} from 'three/examples/jsm/Addons.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { color, deltaTime, max, step, vec3 } from 'three/tsl';
import { Mesh, Quaternion } from 'three/webgpu';

let container, stats;

let camera, scene, renderer, effect;
let particleLight;

// CONST
let meshes = [];
let time_rot_offset = 0;


const max_Spheres = 10;
const layers = 10;
const radius = 100;
const height = radius * 5;

// Initialize Scene
function init( font ) { 
    container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.set( 0.0, 400, 400 * 3.5 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x444488 );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( animate );
    container.appendChild( renderer.domElement );

    /*
    *               SHAPES
    */

    const cubeWidth = 500;
    const numberOfSpheresPerSide = 4;


    const shape = {
        ball : (radius = 100) =>  {return new THREE.SphereGeometry(radius, radius, radius)}, 
        box: (size = 100) =>  {return new THREE.BoxGeometry(size, size, size)}
    }


    /*
    *               MATERIALS
    */
    const colors = new Uint8Array( 40 ); // How many shadedportions in the sphere
    for ( let c = 0; c <= colors.length; c ++ ) {   // Make a rainbow out of the colors
        colors[ c ] = ( c /colors.length) * 256;
    }
    const gradientMap = new THREE.DataTexture( colors, colors.length, 1, THREE.RedFormat );
    gradientMap.needsUpdate = true;
    const TOON = (r = null, g = null, b = null) => {
        if (r == null) r = Math.random() * 256;
        if (g == null) g = Math.random() * 256;
        if (b == null) b = Math.random() * 256;
        r /= 256;
        g /= 256;
        b /= 256
        let diffuseColor = new THREE.Color(r, g, b);
        return new THREE.MeshToonMaterial( {
            color: diffuseColor,
            gradientMap: gradientMap
        } );
    }
    // Making rings
    for(let y = 0; y < layers; y++) {
        for (let x = 0; x < max_Spheres; x++) {
            let color_r = (Math.cos(x * Math.PI * 2 / max_Spheres) )* 128;
            let color_g = (Math.cos(x * Math.PI * 2 / max_Spheres + 2 * Math.PI / 3))* 128;
            let color_b = ((Math.cos(x * Math.PI * 2 / max_Spheres + 4 * Math.PI / 3)))* 128;
            let mesh = new Mesh(shape.box(50), TOON(color_r,color_g, color_b));
            let num_mesh = x / max_Spheres;
            let angle = 2 * Math.PI * (num_mesh);

            mesh.oscillate = radius;
            mesh.position.x = mesh.oscillate * Math.cos(angle);
            mesh.position.z = mesh.oscillate * - Math.sin(angle);
            mesh.position.y = height * y / layers;
            meshes.push(mesh);

            let quat = new Quaternion();
            quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            mesh.applyQuaternion(quat)
            scene.add(mesh);
        }
    }


    //



//

function animate() {
    render();
}


// Animate Scene
function render() {
    const timer = (Date.now() - init_time) * 0.00025 ;
    const dt = deltaTime;
    console.log(dt)
    particleLight.position.x = Math.sin( timer * 7 ) * 300;
    particleLight.position.y = Math.cos( timer * 5 ) * 400;
    particleLight.position.z = Math.cos( timer * 3 ) * 300;

    let new_radius = 100 * (Math.sin(timer * 5) + 2) ;
    meshes.forEach(element => {
        element.position.x = element.position.x * new_radius / element.oscillate;
        element.position.z = element.position.z * new_radius / element.oscillate;
        // element.applyQuaternion(new Quaternion(0, 0.0499792, 0, 0.9987503))
        element.oscillate = new_radius;
    });

    time_rot_offset = timer
    if (time_rot_offset > 2 * Math.PI) time_rot_offset -= 2 * Math.PI;
    for (let y = 0; y < layers; y++) {
        for (let x = 0; x < max_Spheres; x++) {
            const mesh = meshes[x + y * max_Spheres];
            let num_mesh = ((x + time_rot_offset) % max_Spheres) / max_Spheres;
            let angle = 2 * Math.PI * (num_mesh);

            mesh.position.x = mesh.oscillate * Math.cos(angle);
            mesh.position.z = mesh.oscillate * - Math.sin(angle);
            let quat = new Quaternion();
            quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.00025);
            mesh.applyQuaternion(quat)
        }
    }
    effect.render( scene, camera );
    }
}

// init()
// 

import { FloppyFists } from './scene';
let sc = new FloppyFists();
sc.init();