import * as T from 'three';
import { OrbitControls, OutlineEffect, TextGeometry} from 'three/examples/jsm/Addons.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { deltaTime, max, step, vec3 } from 'three/tsl';
import { Mesh, Quaternion, Matrix4 } from 'three/webgpu';
import { Arc, End_Effector} from './Model/heirarchy.js';
import { PlayerModel } from './Model/model.js';
import { integrateCollisionSystem } from './Model/collision.js';
import {euler, symplectic, verlet, proj, calcSlideSpeed, player_mass, npc_mass, gravity, mu} from './Model/physics.js';
import {Vector3} from "three";

// Updates : Use speace to Right Punch; F to Left Punch
// QE to Rotate (Needed to test that IK works after rotating)
const hidden = new T.MeshToonMaterial({visible: false})
const shades = new Uint8Array( 40 );
for ( let c = 0; c <= shades.length; c ++ ) {
    shades[ c ] = ( c /shades.length) * 256;
}
const gradientMap = new T.DataTexture( shades, shades.length, 1, T.RedFormat );
gradientMap.needsUpdate = true;
function color( r = null, g = null, b = null) {
    if (r == null) r = Math.random() * 256;
    if (g == null) g = Math.random() * 256;
    if (b == null) b = Math.random() * 256;
    r /= 256;
    g /= 256;
    b /= 256
    let diffuseColor = new T.Color(r, g, b);
    return new T.MeshToonMaterial( {
        visible: true,
        color: diffuseColor,
        gradientMap: gradientMap
    } );
}

function v3(x = 0, y = 0, z = 0) {
    if(x instanceof T.Vector3) return new T.Vector3(x.x, x.y, x.z);
    return new T.Vector3(x, y, z);
}

const shapes = {
    ball: (rad = 5) => {return new T.SphereGeometry(rad)},
    box: (x = 1, y = 1, z = 1) => {return new T.BoxGeometry(x, y, z)},
    tube: (rad_top = 5, rad_bot = 5, height = 10) => {return new T.CylinderGeometry(
        rad_top, rad_bot, height
    )},
}

const identity = () => {let m = new Matrix4; return m.identity()}; 

const translation = (x, y, z) => {
    if(x instanceof T.Vector3) return identity().makeTranslation(x.x, x.y, x.z);
    return identity().makeTranslation(x, y, z)
};

function make_obj(model = shapes.ball(5), material = color(), matrix = identity()){
    let obj = new T.Mesh(model, material);
    obj.applyMatrix4(matrix);
    return obj;
}

function set_pos(obj, x, y, z) {
    if(x instanceof T.Vector3) {
        obj.position.x = x.x;
        obj.position.y = x.y;
        obj.position.z = x.z;
    } else {
        obj.position.x = x;
        obj.position.y = y;
        obj.position.z = z;
    }
}

// ^ Pulled from the old heirarchy.js since they were used by this file

// Needed for modelling ArticulatedHuman NPCs
class Vector4 {
    constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
}

// Base Character class that both main character and NPCs will inherit from
class Character {
    constructor(scene, position = new T.Vector3(0, 0, 0), scale = 1.0) {
        this.scene = scene;
        this.position = position.clone();
        this.scale = scale;
        this.matrixStack = [];
    }

    update(time, dt) {
        // Base update method - to be overridden
    }
    
    draw() {
        // Base draw method - to be overridden 
    }
    
    checkBoundaries(arenaSize) {
        // Base boundary check - to be overridden
    }
}

// Main character (now using PlayerModel)
class MainCharacter extends Character {
    constructor(scene, position = new T.Vector3(0, 0, 0), scale = 1.0) {
        //Main changes are here
        super(scene, position, scale);
        this.player = new PlayerModel(scene, position);
        this.l_ball = make_obj(shapes.ball(1.5), color(255, 0, 0));
        this.r_ball = make_obj(shapes.ball(1.5), color(0, 0, 255));
        this.scene.add(this.l_ball);
        this.scene.add(this.r_ball);
        
        this.state = {
            punchPhase: {
                left: 0,
                right: 0
            },
            isPunching: {
                left: false,
                right: false
            },
            lastPunchTime: 0,
            punchCooldown: 0.5, // Reduce?
            punchSpeed: 1.5 + Math.random(),    // Speed multiplier; in order to make the punch knockback velocity non-trivial, we randomize the speed in [1.5,2.5]
            manualTarget: new T.Vector3(0, 20, 5) // Starting pos
        };
        
        this.movement = {
            rotation: 0,
            rotationSpeed: 2
        };
        
        this.setupInputHandlers();
    }
    
    setupInputHandlers() {
        this.keys = {};
        
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            if (e.key === ' ' && !this.state.isPunching.right) {
                this.startPunch('right');
            }
            
            if (e.key.toLowerCase() === 'f' && !this.state.isPunching.left) {
                this.startPunch('left');
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }
    
    startPunch(hand) {
        const currentTime = performance.now() / 1000;
        
        // Check cooldown
        if (currentTime - this.state.lastPunchTime < this.state.punchCooldown) {
            return;
        }
        
        this.state.isPunching[hand] = true;
        this.state.punchPhase[hand] = 0;
        this.state.lastPunchTime = currentTime;

        //re-randomize the punch speed per punch
        this.state.punchSpeed = 1.5 + Math.random();
    }
    
    updatePunches(dt) {
        if (this.state.isPunching.right) {
            this.state.punchPhase.right += dt * this.state.punchSpeed;
            
            if (this.state.punchPhase.right >= 1) {
                this.state.punchPhase.right = 0;
                this.state.isPunching.right = false;
            } else {
                //From model.js
                const punchAnim = this.state.punchPhase.right;
                const target = this.player.get_r_punch_pos(punchAnim);
                
                set_pos(this.r_ball, target);
                this.player.move_r(target);// IK Step
            }
        } else {
            //Not punching -> Go to neutral pos
            const worldMatrix = this.player.core.node.core.matrixWorld;
            const rightRestPos = new T.Vector3(5, 20, 3).applyMatrix4(worldMatrix);
            this.player.move_r(rightRestPos);
            set_pos(this.r_ball, rightRestPos);
        }
    

        if (this.state.isPunching.left) {
            this.state.punchPhase.left += dt * this.state.punchSpeed;
            
            if (this.state.punchPhase.left >= 1) {
                this.state.punchPhase.left = 0;
                this.state.isPunching.left = false;
            } else {
                const punchAnim = this.state.punchPhase.left;
                const targetPos = this.player.get_l_punch_pos(punchAnim);
                set_pos(this.l_ball, targetPos);
                this.player.move_l(targetPos);
            }
        }
        else {
            const worldMatrix = this.player.core.node.core.matrixWorld;
            const leftRestPos = new T.Vector3(5, 20, -3).applyMatrix4(worldMatrix);
            this.player.move_l(leftRestPos);
            set_pos(this.l_ball, leftRestPos);
        }
    }
    
    updateMovement(dt) {
        this.movement.rotation = 0;
        
        if (this.keys['q']) this.movement.rotation += 1;
        if (this.keys['e']) this.movement.rotation -= 1;
        
        const rotationAmount = this.movement.rotation * this.movement.rotationSpeed * dt;
        if (rotationAmount !== 0) {
            this.player.rotate(rotationAmount);
        }
    }
    
    // Check if character hit arena boundaries and update direction
    checkBoundaries(arenaSize) {
        const position = this.player.core.get_global_position();
        
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

    //main character's update function
    update(time, dt) {
        this.updateMovement(dt);
        this.updatePunches(dt);
    }
}

//NPC Character implementation (based on my work for assignment 2)
class NPCCharacter extends Character {
    constructor(scene, position = new T.Vector3(0, 0, 0), scale = 0.75) {
        super(scene, position, scale);
        this.objectsCreated = false;

        //walking
        this.animPhase = Math.random() * Math.PI * 2;
        this.animSpeed = 0.5 + Math.random() * 1.0;
        this.moveSpeed = 0.05 + Math.random() * 0.1;
        this.moveDir = new T.Vector3(
            Math.random() * 2 - 1,
            0,
            Math.random() * 2 - 1
        ).normalize();

        //James's part: sliding
        this.isSliding = false;
        this.slideSpeed = 0;
        this.slideDir = new T.Vector3(
            0,
            0,
            0
        ).normalize();
        //MAGNITUDE of: current velocity x, current velocity z, previous position x, previous position z
        //note that current positions are simply this.position.x, this.position.z
        //we will use integration methods to simulate the two dimensions separately and independently
        this.cvx = 0;
        this.cvz = 0;
        this.ppx = 0;
        this.ppz = 0;

        this.dof = 7;
        this.theta = [0, 0, 0, 0, 0, 0, 0]; 
        
        this.createCharacter();
        this.applyTheta(); 
    }
    
    static EndEffector = class {
        constructor(name, parent, localPosition) {
            this.name = name;
            this.parent = parent;
            this.localPosition = localPosition; 
            this.globalPosition = new Vector4(); 
        }
    }

    static Node = class {
        constructor(name, shape, transform) {
            this.name = name;
            this.shape = shape;
            this.transformMatrix = transform;
            this.parentArc = null;
            this.childrenArcs = [];
            this.object3D = null;
        }
    }

    static Arc = class {
        constructor(name, parent, child, location) {
            this.name = name;
            this.parentNode = parent;
            this.childNode = child;
            this.locationMatrix = location || new T.Matrix4().identity();
            this.articulationMatrix = new T.Matrix4().identity();
            this.endEffector = null;
            this.dof = {
                Rx: false,
                Ry: false,
                Rz: false
            };
        }

        setDof(x, y, z) {
            this.dof.Rx = x;
            this.dof.Ry = y;
            this.dof.Rz = z;
        }

        updateArticulation(theta) {
            this.articulationMatrix = new T.Matrix4().identity();
            let index = 0;
            
            if (this.dof.Rx) {
                const rotX = new T.Matrix4().makeRotationX(theta[index]);
                this.articulationMatrix.premultiply(rotX);
                index += 1;
            }
            
            if (this.dof.Ry) {
                const rotY = new T.Matrix4().makeRotationY(theta[index]);
                this.articulationMatrix.premultiply(rotY);
                index += 1;
            }
            
            if (this.dof.Rz) {
                const rotZ = new T.Matrix4().makeRotationZ(theta[index]);
                this.articulationMatrix.premultiply(rotZ);
            }
        }
    }
    
    createCharacter() {
        // Create a basic human figure with articulated limbs
        
        const figureTransform = new T.Matrix4().identity()
            .multiply(new T.Matrix4().makeScale(this.scale, this.scale, this.scale))
            .multiply(new T.Matrix4().makeTranslation(this.position.x, this.position.y + 6.5, this.position.z));
        
        // Torso
        const torsoTransform = new T.Matrix4().makeScale(1, 2.2, 0.5);
        this.torsoNode = new NPCCharacter.Node("torso", shapes.ball(1), torsoTransform);
        
        // Root -> Toso
        this.root = new NPCCharacter.Arc("root", null, this.torsoNode, figureTransform);
        
        // Head
        let headTransform = new T.Matrix4().makeScale(0.6, 0.6, 0.6)
            .premultiply(new T.Matrix4().makeTranslation(0, 0.1, 0));
        this.headNode = new NPCCharacter.Node("head", shapes.ball(1), headTransform);
        
        const neckLocation = new T.Matrix4().makeTranslation(0, 2.5, 0);
        this.neck = new NPCCharacter.Arc("neck", this.torsoNode, this.headNode, neckLocation);
        this.torsoNode.childrenArcs.push(this.neck);
        
        // Create right upper arm
        let ruArmTransform = new T.Matrix4().makeScale(1.2, 0.2, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(1.1, -0.25, 0));
        this.ruArmNode = new NPCCharacter.Node("ru_arm", shapes.ball(1), ruArmTransform);
        
        const rShoulderLocation = new T.Matrix4().makeTranslation(0.6, 2, 0);
        this.rShoulder = new NPCCharacter.Arc("r_shoulder", this.torsoNode, this.ruArmNode, rShoulderLocation);
        this.torsoNode.childrenArcs.push(this.rShoulder);
        this.rShoulder.setDof(true, true, true);
        
        // Create right lower arm
        let rlArmTransform = new T.Matrix4().makeScale(1, 0.2, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(0.9, -0.25, 0));
        this.rlArmNode = new NPCCharacter.Node("rl_arm", shapes.ball(1), rlArmTransform);
        
        const rElbowLocation = new T.Matrix4().makeTranslation(2.4, 0, 0);
        this.rElbow = new NPCCharacter.Arc("r_elbow", this.ruArmNode, this.rlArmNode, rElbowLocation);
        this.ruArmNode.childrenArcs.push(this.rElbow);
        this.rElbow.setDof(true, true, false);
        
        // Create right hand
        let rHandTransform = new T.Matrix4().makeScale(0.4, 0.3, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(0.2, -0.25, 0));
        this.rHandNode = new NPCCharacter.Node("r_hand", shapes.ball(1), rHandTransform);
        
        const rWristLocation = new T.Matrix4().makeTranslation(2, 0, 0);
        this.rWrist = new NPCCharacter.Arc("r_wrist", this.rlArmNode, this.rHandNode, rWristLocation);
        this.rlArmNode.childrenArcs.push(this.rWrist);
        this.rWrist.setDof(true, false, true);
        
        // Create end effector for the right hand
        const rHandEndLocalPos = new Vector4(0.8, 0, 0, 1);
        this.endEffector = new NPCCharacter.EndEffector("right_hand", this.rWrist, rHandEndLocalPos);
        this.rWrist.endEffector = this.endEffector;
        
        // Create left upper arm (mirrored)
        let luArmTransform = new T.Matrix4().makeScale(1.2, 0.2, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(-1.1, -0.25, 0));
        this.luArmNode = new NPCCharacter.Node("lu_arm", shapes.ball(1), luArmTransform);
        
        const lShoulderLocation = new T.Matrix4().makeTranslation(-0.6, 2, 0);
        this.lShoulder = new NPCCharacter.Arc("l_shoulder", this.torsoNode, this.luArmNode, lShoulderLocation);
        this.torsoNode.childrenArcs.push(this.lShoulder);
        this.lShoulder.setDof(true, true, true);
        
        // Create left lower arm
        let llArmTransform = new T.Matrix4().makeScale(1, 0.2, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(-0.9, -0.25, 0));
        this.llArmNode = new NPCCharacter.Node("ll_arm", shapes.ball(1), llArmTransform);
        
        const lElbowLocation = new T.Matrix4().makeTranslation(-2.4, 0, 0);
        this.lElbow = new NPCCharacter.Arc("l_elbow", this.luArmNode, this.llArmNode, lElbowLocation);
        this.luArmNode.childrenArcs.push(this.lElbow);
        this.lElbow.setDof(true, true, false);
        
        // Create left hand
        let lHandTransform = new T.Matrix4().makeScale(0.4, 0.3, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(-0.2, -0.25, 0));
        this.lHandNode = new NPCCharacter.Node("l_hand", shapes.ball(1), lHandTransform);
        
        const lWristLocation = new T.Matrix4().makeTranslation(-2, 0, 0);
        this.lWrist = new NPCCharacter.Arc("l_wrist", this.llArmNode, this.lHandNode, lWristLocation);
        this.llArmNode.childrenArcs.push(this.lWrist);
        this.lWrist.setDof(true, false, true);
        
        // Create right upper leg
        let ruLegTransform = new T.Matrix4().makeScale(0.2, 1.1, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(0.025, -0.55, 0));
        this.ruLegNode = new NPCCharacter.Node("ru_leg", shapes.ball(1), ruLegTransform);
        
        const rHipLocation = new T.Matrix4().makeTranslation(0.3, -2.6, 0);
        this.rHip = new NPCCharacter.Arc("r_hip", this.torsoNode, this.ruLegNode, rHipLocation);
        this.torsoNode.childrenArcs.push(this.rHip);
        this.rHip.setDof(true, true, true);
        
        // Create right lower leg
        let rlLegTransform = new T.Matrix4().makeScale(0.2, 1.1, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(0.025, -0.3, 0));
        this.rlLegNode = new NPCCharacter.Node("rl_leg", shapes.ball(1), rlLegTransform);
        
        const rKneeLocation = new T.Matrix4().makeTranslation(0, -2.4, 0);
        this.rKnee = new NPCCharacter.Arc("r_knee", this.ruLegNode, this.rlLegNode, rKneeLocation);
        this.ruLegNode.childrenArcs.push(this.rKnee);
        this.rKnee.setDof(true, false, false);
        
        // Create right foot
        let rFootTransform = new T.Matrix4().makeScale(0.3, 0.2, 0.4)
            .premultiply(new T.Matrix4().makeTranslation(0, 0.5, 0.2));
        this.rFootNode = new NPCCharacter.Node("r_foot", shapes.ball(1), rFootTransform);
        
        const rAnkleLocation = new T.Matrix4().makeTranslation(0, -2, 0);
        this.rAnkle = new NPCCharacter.Arc("r_ankle", this.rlLegNode, this.rFootNode, rAnkleLocation);
        this.rlLegNode.childrenArcs.push(this.rAnkle);
        this.rAnkle.setDof(true, true, false);
        
        // Create left upper leg (mirrored)
        let luLegTransform = new T.Matrix4().makeScale(0.2, 1.1, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(-0.025, -0.55, 0));
        this.luLegNode = new NPCCharacter.Node("lu_leg", shapes.ball(1), luLegTransform);
        
        const lHipLocation = new T.Matrix4().makeTranslation(-0.3, -2.6, 0);
        this.lHip = new NPCCharacter.Arc("l_hip", this.torsoNode, this.luLegNode, lHipLocation);
        this.torsoNode.childrenArcs.push(this.lHip);
        this.lHip.setDof(true, true, true);
        
        // Create left lower leg
        let llLegTransform = new T.Matrix4().makeScale(0.2, 1.1, 0.2)
            .premultiply(new T.Matrix4().makeTranslation(-0.025, -0.3, 0));
        this.llLegNode = new NPCCharacter.Node("ll_leg", shapes.ball(1), llLegTransform);
        
        const lKneeLocation = new T.Matrix4().makeTranslation(0, -2.4, 0);
        this.lKnee = new NPCCharacter.Arc("l_knee", this.luLegNode, this.llLegNode, lKneeLocation);
        this.luLegNode.childrenArcs.push(this.lKnee);
        this.lKnee.setDof(true, false, false);
        
        // Create left foot
        let lFootTransform = new T.Matrix4().makeScale(0.3, 0.2, 0.4)
            .premultiply(new T.Matrix4().makeTranslation(0, 0.5, 0.2));
        this.lFootNode = new NPCCharacter.Node("l_foot", shapes.ball(1), lFootTransform);
        
        const lAnkleLocation = new T.Matrix4().makeTranslation(0, -2, 0);
        this.lAnkle = new NPCCharacter.Arc("l_ankle", this.llLegNode, this.lFootNode, lAnkleLocation);
        this.llLegNode.childrenArcs.push(this.lAnkle);
        this.lAnkle.setDof(true, true, false);
    }
    
    applyTheta() {
        this.rShoulder.updateArticulation(this.theta.slice(0, 3));
        this.lShoulder.updateArticulation([this.theta[0], -this.theta[1], -this.theta[2]]);
        this.rHip.updateArticulation([this.theta[0] * 0.5, 0, 0]);
        this.lHip.updateArticulation([-this.theta[0] * 0.5, 0, 0]);
    }
    
    multiplyVector4(matrix, vector) {
        const x = matrix.elements[0] * vector.x + matrix.elements[4] * vector.y + 
                  matrix.elements[8] * vector.z + matrix.elements[12] * vector.w;
        const y = matrix.elements[1] * vector.x + matrix.elements[5] * vector.y + 
                  matrix.elements[9] * vector.z + matrix.elements[13] * vector.w;
        const z = matrix.elements[2] * vector.x + matrix.elements[6] * vector.y + 
                  matrix.elements[10] * vector.z + matrix.elements[14] * vector.w;
        const w = matrix.elements[3] * vector.x + matrix.elements[7] * vector.y + 
                  matrix.elements[11] * vector.z + matrix.elements[15] * vector.w;
        
        return new Vector4(x, y, z, w);
    }
    
    getEndEffectorPosition() {
        this.matrixStack = [];
        this._recUpdate(this.root, new T.Matrix4().identity());
        const v = this.endEffector.globalPosition;
        return new T.Vector3(v.x, v.y, v.z);
    }
    
    _recUpdate(arc, matrix) {
        if (!arc) return;
        
        const queue = [];
        queue.push({ arc, matrix: matrix.clone() });
        
        while (queue.length > 0) {
            const { arc: currentArc, matrix: localMatrix } = queue.shift();
            
            const combined = new T.Matrix4().multiplyMatrices(
                currentArc.locationMatrix,
                currentArc.articulationMatrix
            );
            
            const newMatrix = localMatrix.clone().multiply(combined);
            this.matrixStack.push(newMatrix.clone());
            
            if (currentArc.endEffector) {
                // Convert local position to global
                const localPos = currentArc.endEffector.localPosition;
                currentArc.endEffector.globalPosition = this.multiplyVector4(newMatrix, localPos);
            }
            
            const childNode = currentArc.childNode;
            if (childNode) {
                const nodeMatrix = newMatrix.clone().multiply(childNode.transformMatrix);
                const snapshot = this.matrixStack.pop();
                
                for (const nextArc of childNode.childrenArcs) {
                    queue.push({ arc: nextArc, matrix: snapshot.clone() });
                }
            }
        }
    }
    
    createMeshes() {
        const hue = 25 + Math.random() * 10; // Skin tone hue variation
        const skinTone = new T.Color().setHSL(hue/360, 0.3 + Math.random() * 0.2, 0.7 + Math.random() * 0.2);
        const bodyMaterial = new T.MeshPhongMaterial({ color: skinTone });
        
        // Function to create and add a mesh for a node
        const createNodeMesh = (node, material) => {
            if (!node.object3D) {
                const geometry = (node.shape.constructor.name === 'SphereGeometry' || 
                    node.shape.type === 'SphereGeometry' || 
                    node.shape.type === 'ball') 
                    ? new T.SphereGeometry(1, 16, 16) 
                    : new T.BoxGeometry(1, 1, 1);
                
                const mesh = new T.Mesh(geometry, material.clone());
                mesh.matrixAutoUpdate = false;
                this.scene.add(mesh);
                node.object3D = mesh;
            }
        };
        
        // Create meshes for all nodes
        createNodeMesh(this.torsoNode, bodyMaterial);
        createNodeMesh(this.headNode, bodyMaterial);
        createNodeMesh(this.ruArmNode, bodyMaterial);
        createNodeMesh(this.rlArmNode, bodyMaterial);
        createNodeMesh(this.rHandNode, bodyMaterial);
        createNodeMesh(this.luArmNode, bodyMaterial);
        createNodeMesh(this.llArmNode, bodyMaterial);
        createNodeMesh(this.lHandNode, bodyMaterial);
        createNodeMesh(this.ruLegNode, bodyMaterial);
        createNodeMesh(this.rlLegNode, bodyMaterial);
        createNodeMesh(this.rFootNode, bodyMaterial);
        createNodeMesh(this.luLegNode, bodyMaterial);
        createNodeMesh(this.llLegNode, bodyMaterial);
        createNodeMesh(this.lFootNode, bodyMaterial);
        
        this.objectsCreated = true;
    }
    
    // Draw the character
    draw() {
        if (!this.objectsCreated) {
            this.createMeshes();
        }
        
        this.matrixStack = [];
        this._recDraw(this.root, new T.Matrix4().identity());
    }
    
    _recDraw(arc, matrix) {
        if (arc !== null) {
            const L = arc.locationMatrix;
            const A = arc.articulationMatrix;
            
            // Combine matrices
            const combined = new T.Matrix4().multiplyMatrices(L, A);
            const newMatrix = matrix.clone().multiply(combined);
            this.matrixStack.push(newMatrix.clone());
            
            const node = arc.childNode;
            if (node) {
                const T = node.transformMatrix;
                const finalMatrix = newMatrix.clone().multiply(T);
                
                if (node.object3D) {
                    node.object3D.matrix.copy(finalMatrix);
                }
                
                const parentMatrix = this.matrixStack.pop();
                for (const nextArc of node.childrenArcs) {
                    this.matrixStack.push(parentMatrix.clone());
                    this._recDraw(nextArc, parentMatrix);
                    this.matrixStack.pop();
                }
            }
        }
    }
    
    // Update character animation for NPCs
    //NPC update function
    update(time, dt) {
        // Walking animation
        this.theta[0] = Math.sin(time * this.animSpeed + this.animPhase) * 0.5;  // Main arm swing
        this.theta[1] = Math.cos(time * this.animSpeed + this.animPhase) * 0.2;  // Minor side swing
        this.theta[2] = Math.sin(time * this.animSpeed + this.animPhase + Math.PI/4) * 0.2;  // Arm rotation
        
        this.applyTheta();

        //James's part:
        // Move the character if under normal moving mode
        if (this.isSliding === false) {
            this.position.x += this.moveDir.x * this.moveSpeed * dt * 30;
            this.position.z += this.moveDir.z * this.moveSpeed * dt * 30;
        }
        // Position under sliding mode is calculated completely based on another velocity vector generated by punch
        // position integrated with one of the integration methods
        else {
            //the acceleration is a vector with same components on both x and z; it is calculated as a = F/mass = mu * N / mass = mu * mass * gravity / mass = mu * gravity.
            //it is always negative, since it's always in reverse direction of velocity and the velocity magnitude (speed) is always non-negative
            let ca = gravity * mu;
            //note that here cvx is a directed velocity value, which means it could either be positive or negative, and acceleration should always be opposite sign
            //we can use either forward euler or symplectic integration to simulate the next positions; here we use symplectic because it is good for fast, continuous movement
            //verlet integration is not very fitting to simulate this type of motion (it is good at simulating systems where certain quantities are conserved and motions are periodic and predictable, such as planetary motions), and it is kind of buggy here, so we will not use it
            // let valx = euler(this.position.x, this.cvx, ca * (this.cvx >= 0? -1 : 1), dt * 30);
            // let valz = euler(this.position.z, this.cvz, ca * (this.cvx >= 0? -1 : 1), dt * 30);
            let valx = symplectic(this.position.x, this.cvx, ca * (this.cvx >= 0? -1 : 1), dt * 30);
            let valz = symplectic(this.position.z, this.cvz, ca * (this.cvx >= 0? -1 : 1), dt * 30);
            console.log(`Sliding occuring; valx: ${valx}`)
            //if after this frame, the velocity in either x or z dimension will change direction, the sliding stops, and NPC start to move at moveSpeed in direction moveDir again (their default randomized walking speed)
            //we reset slideSpeed, slideDir, and isSliding.
            if (valx[1] * this.cvx < 0 || valz[1] * this.cvz < 0) {
                this.isSliding = false;
                this.slideSpeed = 0;
                this.slideDir = new T.Vector3(0,0,0).normalize();
                //and in this frame, since no sliding motion is performed, we just move normally as in walking
                this.position.x += this.moveDir.x * this.moveSpeed * dt * 30;
                this.position.z += this.moveDir.z * this.moveSpeed * dt * 30;
            }
            else {
                this.ppx = this.position.x;
                this.ppz = this.position.z;
                this.position.x = valx[0];
                this.cvx = valx[1];
                this.position.z = valz[0];
                this.cvz = valz[1];
            }
        }
        // Update root location to reflect new position
        this.root.locationMatrix = new T.Matrix4().makeScale(this.scale, this.scale, this.scale)
            .premultiply(new T.Matrix4().makeTranslation(this.position.x, this.position.y + 6.5, this.position.z));
        
        // Rotate to face movement direction
        if (this.moveDir.x !== 0 || this.moveDir.z !== 0) {
            const angle = Math.atan2(this.moveDir.x, this.moveDir.z);
            const rotationMatrix = new T.Matrix4().makeRotationY(angle);
            
            // Combine position and rotation
            const posMatrix = new T.Matrix4().makeTranslation(
                this.position.x, 
                this.position.y + 19.5,
                this.position.z
            );
            
            this.root.locationMatrix = new T.Matrix4().multiplyMatrices(posMatrix, rotationMatrix)
                .multiply(new T.Matrix4().makeScale(this.scale, this.scale, this.scale));
        }
    }
    
    // Check if character hit arena boundaries and update direction
    checkBoundaries(arenaSize) {
        if (Math.abs(this.position.x) > arenaSize * 0.85) {
            this.moveDir.x = -this.moveDir.x;
            this.position.x = Math.sign(this.position.x) * arenaSize * 0.85;
        }
        
        if (Math.abs(this.position.z) > arenaSize * 0.85) {
            this.moveDir.z = -this.moveDir.z;
            this.position.z = Math.sign(this.position.z) * arenaSize * 0.85;
        }
        
        if (Math.random() < 0.005) {
            this.moveDir.x += (Math.random() * 0.4 - 0.2);
            this.moveDir.z += (Math.random() * 0.4 - 0.2);
            this.moveDir.normalize();
        }
    }
}

export class FloppyFists {
    constructor() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);
    
        this.camera = new T.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
        this.camera.position.set(0.0, 60, 80);
    
        this.scene = new T.Scene();
        this.scene.background = new T.Color(0x444488);
    
        this.renderer = new T.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setAnimationLoop(this.animate.bind(this));
        this.container.appendChild(this.renderer.domElement);

        const shades = new Uint8Array(40);

        for (let c = 0; c <= shades.length; c++) {
            shades[c] = (c/shades.length) * 256;
        }
        this.gradientMap = new T.DataTexture(shades, shades.length, 1, T.RedFormat);
        this.gradientMap.needsUpdate = true;

        // Instructions overlay
        this.createInstructions();

        // Lights
        this.setupLights();
        this.effect = new OutlineEffect(this.renderer);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = 30;
        this.controls.maxDistance = 2000;
        this.controls.maxPolarAngle = Math.PI/2 - 0.05;
        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.clock = new T.Clock();
        this.lightTime = 0;
        this.arenaSize = 400;
        this.arenaHeight = 200;
        
        // Initialize arena here
        this.createArena();
        
        // Create main character using PlayerModel
        this.mainCharacter = new MainCharacter(this.scene);
        
        // Fix character orientation to face -Z initially
        this.mainCharacter.player.rotate(Math.PI);
        
        // Create NPCs
        this.npcs = [];
        this.createNPCs(12);
        
        this.init();
    }
    
    createInstructions() {
        const instructions = document.createElement('div');
        instructions.style.position = 'absolute';
        instructions.style.top = '10px';
        instructions.style.width = '100%';
        instructions.style.textAlign = 'center';
        instructions.style.color = '#ffffff';
        instructions.style.fontFamily = 'Arial, sans-serif';
        instructions.style.fontWeight = 'bold';
        instructions.style.textShadow = '1px 1px 2px black';
        instructions.innerHTML = 
            'QE - Rotate | SPACE - Right Punch | F - Left Punch';
        document.body.appendChild(instructions);
    }
    
    setupLights() {
        //Main light
        this.particleLight = new T.Mesh(
            new T.SphereGeometry(2, 8, 8),
            new T.MeshBasicMaterial({ color: 0xffffff })
        );
        this.scene.add(this.particleLight);
        this.scene.add(new T.AmbientLight(0xa1a1a1, 3));
        
        // Point light
        this.pointLight = new T.PointLight(0xffffff, 2, 800, 0);
        this.particleLight.add(this.pointLight);
        
        // Colored lights
        this.redSpotlight = new T.SpotLight(0xff2222, 50, 100, Math.PI/6, 0.5);
        this.redSpotlight.position.set(40, 40, 40);
        this.scene.add(this.redSpotlight);
        
        this.blueSpotlight = new T.SpotLight(0x2222ff, 50, 100, Math.PI/6, 0.5);
        this.blueSpotlight.position.set(-40, 40, -40);
        this.scene.add(this.blueSpotlight);
    }
    
    createArena() {
        const wallThickness = 1;
        
        // Floor
        const floorMaterial = color(60, 60, 70);
        const floor = make_obj(
            shapes.box(this.arenaSize*2, 1, this.arenaSize*2),
            floorMaterial,
            translation(0, -1, 0)
        );
        this.scene.add(floor);
        
        // Ceiling
        const ceilingMaterial = color(40, 40, 50);
        const ceiling = make_obj(
            shapes.box(this.arenaSize*2, 1, this.arenaSize*2),
            ceilingMaterial,
            translation(0, this.arenaHeight, 0)
        );
        this.scene.add(ceiling);
        
        // Walls
        const wallMaterial = color(20, 100, 150);
        wallMaterial.transparent = true;
        wallMaterial.opacity = 0.7;
        
        const northWall = make_obj(
            shapes.box(this.arenaSize*2, this.arenaHeight, wallThickness),
            wallMaterial,
            translation(0, this.arenaHeight/2, -this.arenaSize)
        );
        this.scene.add(northWall);
        
        const southWall = make_obj(
            shapes.box(this.arenaSize*2, this.arenaHeight, wallThickness),
            wallMaterial,
            translation(0, this.arenaHeight/2, this.arenaSize)
        );
        this.scene.add(southWall);
        
        const eastWall = make_obj(
            shapes.box(wallThickness, this.arenaHeight, this.arenaSize*2),
            wallMaterial,
            translation(this.arenaSize, this.arenaHeight/2, 0)
        );
        this.scene.add(eastWall);
        
        const westWall = make_obj(
            shapes.box(wallThickness, this.arenaHeight, this.arenaSize*2),
            wallMaterial,
            translation(-this.arenaSize, this.arenaHeight/2, 0)
        );

        this.scene.add(westWall);
        
        this.addCornerPillars();
        this.addLightStrips();
        this.addFloorMarkers();
        this.addCeilingLights();
    }
    
    addCornerPillars() {
        const pillarMaterial = color(150, 50, 20);
        const pillarSize = 5;
        const pillarHeight = this.arenaHeight;
        const cornerOffset = this.arenaSize - pillarSize/2;
        
        const pillarPositions = [
            [cornerOffset, 0, cornerOffset],
            [-cornerOffset, 0, cornerOffset],
            [cornerOffset, 0, -cornerOffset],
            [-cornerOffset, 0, -cornerOffset]
        ];
        
        for (const pos of pillarPositions) {
            const pillar = make_obj(
                shapes.tube(pillarSize, pillarSize, pillarHeight),
                pillarMaterial,
                translation(pos[0], pillarHeight/2, pos[2])
            );
            this.scene.add(pillar);
        }
    }
    
    addLightStrips() {
        const stripHeight = 0.5;
        const stripY = this.arenaHeight * 0.7;
        const stripMaterial = color(20, 150, 255);
        
        const northStrip = make_obj(
            shapes.box(this.arenaSize*1.6, stripHeight, 0.1),
            stripMaterial,
            translation(0, stripY, -this.arenaSize + 0.6)
        );
        this.scene.add(northStrip);
        
        const southStrip = make_obj(
            shapes.box(this.arenaSize*1.6, stripHeight, 0.1),
            stripMaterial,
            translation(0, stripY, this.arenaSize - 0.6)
        );
        this.scene.add(southStrip);
        
        const eastStrip = make_obj(
            shapes.box(0.1, stripHeight, this.arenaSize*1.6),
            stripMaterial,
            translation(this.arenaSize - 0.6, stripY, 0)
        );
        this.scene.add(eastStrip);
        
        const westStrip = make_obj(
            shapes.box(0.1, stripHeight, this.arenaSize*1.6),
            stripMaterial,
            translation(-this.arenaSize + 0.6, stripY, 0)
        );
        this.scene.add(westStrip);
    }
    
    addFloorMarkers() {
        const centerCircle = make_obj(
            shapes.tube(10, 10, 0.2),
            color(200, 200, 50),
            translation(0, 0.05, 0)
        );
        this.scene.add(centerCircle);
        
        const markerCount = 16;
        const markerDistance = this.arenaSize * 0.9;
        const markerSize = 3;
        
        for (let i = 0; i < markerCount; i++) {
            const angle = (i / markerCount) * Math.PI * 2;
            const x = Math.cos(angle) * markerDistance;
            const z = Math.sin(angle) * markerDistance;
            
            const markerColor = (i % 4 === 0) 
                ? color(200, 50, 50) 
                : color(100, 100, 100);
            
            const marker = make_obj(
                shapes.box(markerSize, 0.1, markerSize/2),
                markerColor,
                translation(x, 0.1, z)
            );
            
            marker.rotateY(angle);
            
            this.scene.add(marker);
        }
    }
    
    addCeilingLights() {
        const centralLight = make_obj(
            shapes.tube(8, 8, 1),
            color(255, 255, 200),
            translation(0, this.arenaHeight - 0.6, 0)
        );
        this.scene.add(centralLight);
        
        // Spot lights
        const spotlightCount = 8;
        const spotlightRadius = 1;
        const spotlightDistance = this.arenaSize * 0.85;
        
        for (let i = 0; i < spotlightCount; i++) {
            const angle = (i / spotlightCount) * Math.PI * 2;
            const x = Math.cos(angle) * spotlightDistance;
            const z = Math.sin(angle) * spotlightDistance;
            
            // Alternate colors
            const spotColor = (i % 2 === 0)
                ? color(200, 50, 50)
                : color(50, 50, 200);
            
            const spotlight = make_obj(
                shapes.ball(spotlightRadius),
                spotColor,
                translation(x, this.arenaHeight - 0.6, z)
            );
            
            this.scene.add(spotlight);
        }
    }
    
    createNPCs(count = 12) {
        for (let i = 0; i < count; i++) {
            // Calculate a random position within the arena
            const radius = Math.random() * this.arenaSize * 0.8;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const npc = new NPCCharacter(this.scene, new T.Vector3(x, 0, z), 3);
            this.npcs.push(npc);
        }
    }

    init() {
        this.t = 0;
        this.collisionSystem = integrateCollisionSystem(this); // collision.js used here
        // Target ball for tracking fist targets
        this.circle = new T.Mesh(
            new T.SphereGeometry(1, 16, 16),
            new T.MeshPhongMaterial({ color: 0xFFFF00 })
        );
        this.circle.position.set(0, 20, 0);
        this.scene.add(this.circle);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.render();
    }

    render() {
        let dt = this.clock.getDelta();
        this.t += dt;
        this.lightTime += dt;
        
        // Main light
        const lightX = Math.sin(this.t) * this.arenaSize * 0.7;
        const lightZ = Math.cos(this.t * 0.6) * this.arenaSize * 0.7;
        this.particleLight.position.set(lightX, 20, lightZ);
        
        // Spotlights
        this.redSpotlight.position.x = Math.sin(this.t * 0.3) * this.arenaSize * 0.8;
        this.redSpotlight.position.z = Math.cos(this.t * 0.4) * this.arenaSize * 0.8;
        
        this.blueSpotlight.position.x = -Math.sin(this.t * 0.4) * this.arenaSize * 0.8;
        this.blueSpotlight.position.z = -Math.cos(this.t * 0.3) * this.arenaSize * 0.8;
        
        // Circle movement - can use this to test targeting
        this.circle.position.x = Math.cos(this.t) * this.arenaSize * 0.5;
        this.circle.position.z = Math.sin(this.t * 0.7) * this.arenaSize * 0.5;
        
        // Update main character
        this.mainCharacter.update(this.t, dt);
        this.mainCharacter.checkBoundaries(this.arenaSize);

        //James's part: handle punch process; define initial knock-back speed & direction given by punch on collision
        //check collision, calculate collided NPC's increase in speed due to knockback, and start sliding
        if (this.collisionSystem.collisionEvents.length > 0) {
            for (const collision of this.collisionSystem.collisionEvents) {
                if (collision.object1.type === 'npc') {
                    //if this npc is already sliding (maybe punched already in previous frames), we skip its sliding state change
                    if (collision.object1.owner.isSliding === true) continue;
                    if (collision.object2.type === 'main') {
                        //object1 is npc and object2 is main
                        if ((collision.object2.part === 'right_hand' && this.mainCharacter.state.isPunching['right'] === true) || (collision.object2.part === 'left_hand' && this.mainCharacter.state.isPunching['left'] === true)) {
                            console.log(`${collision.object2.part} punch collision detected.\n`);
                            collision.object1.owner.isSliding = true;
                            console.log(`isSliding STATUS CHANGE: ${collision.object1.owner.isSliding}`);
                            //calculate force vector by assuming it to be the distance vector between main & npc's torso, from main to npc
                            let fx = collision.object1.owner.position.x - collision.object2.owner.position.x;
                            let fz = collision.object1.owner.position.z - collision.object2.owner.position.z;
                            console.log(`force vector direction: ${fx},0,${fz}`);
                            collision.object1.owner.slideDir = new T.Vector3(fx, 0, fz).normalize();
                            console.log(`normalized force vector direction: ${collision.object1.owner.slideDir.x},${collision.object1.owner.slideDir.y},${collision.object1.owner.slideDir.z}`);
                            let v2 = proj(collision.object1.owner.moveSpeed,collision.object1.owner.moveDir,collision.object1.owner.slideDir); //this is NPC's projected-speed's magnitude in the sliding direction
                            console.log(`moveSpeed:${collision.object1.owner.moveSpeed}, moveDir:(${collision.object1.owner.moveDir.x},${collision.object1.owner.moveDir.y},${collision.object1.owner.moveDir.z}), slideDir: (${collision.object1.owner.slideDir.x},${collision.object1.owner.slideDir.y},${collision.object1.owner.slideDir.z}), projected Speed Component along slideDir: ${v2}`);
                            collision.object1.owner.slideSpeed = calcSlideSpeed(collision.object2.owner.state.punchSpeed,v2);
                            console.log(`slideSpeed:${collision.object1.owner.slideSpeed}`);
                            //record previous positions of the npc at this frame; for verlet integration
                            collision.object1.owner.ppx = collision.object1.owner.position.x;
                            collision.object1.owner.ppz = collision.object1.owner.position.z;
                            //initialize current velocity for both x and z components
                            collision.object1.owner.cvx = collision.object1.owner.slideDir.x * collision.object1.owner.slideSpeed;
                            collision.object1.owner.cvz = collision.object1.owner.slideDir.z * collision.object1.owner.slideSpeed;
                        }
                    }
                }
                else {
                    //object 1 is main, object 2 is npc
                    if (collision.object2.type === 'npc') {
                        //if this npc is already sliding (maybe punched already in previous frames), we skip its sliding state change
                        if (collision.object2.owner.isSliding === true) continue;
                        if ((collision.object1.part === 'right_hand' && this.mainCharacter.state.isPunching['right'] === true) || (collision.object1.part === 'left_hand' && this.mainCharacter.state.isPunching['left'] === true)) {
                            console.log(`${collision.object2.part} punch collision detected.\n`);
                            collision.object2.owner.isSliding = true;
                            console.log(`isSliding STATUS CHANGE: ${collision.object2.owner.isSliding}`);
                            //calculate force vector by assuming it to be the distance vector between main & npc's torso, from main to npc
                            let fx = collision.object2.owner.position.x - collision.object1.owner.position.x;
                            let fz = collision.object2.owner.position.z - collision.object1.owner.position.z;
                            console.log(`force vector direction: ${fx},0,${fz}`);
                            collision.object2.owner.slideDir = new T.Vector3(fx, 0, fz).normalize();
                            console.log(`normalized force vector direction: ${collision.object2.owner.slideDir.x},${collision.object2.owner.slideDir.y},${collision.object2.owner.slideDir.z}`);
                            let v2 = proj(collision.object2.owner.moveSpeed,collision.object2.owner.moveDir,collision.object2.owner.slideDir); //this is NPC's projected-speed's magnitude in the sliding direction
                            console.log(`moveSpeed:${collision.object2.owner.moveSpeed}, moveDir:(${collision.object2.owner.moveDir.x},${collision.object2.owner.moveDir.y},${collision.object2.owner.moveDir.z}), slideDir: (${collision.object2.owner.slideDir.x},${collision.object2.owner.slideDir.y},${collision.object2.owner.slideDir.z}), projected Speed Component along slideDir: ${v2}`);
                            collision.object2.owner.slideSpeed = collision.object2.owner.moveSpeed + calcSlideSpeed(collision.object1.owner.state.punchSpeed,v2);
                            console.log(`slideSpeed:${collision.object2.owner.slideSpeed}`);
                            //record previous positions of the npc at this frame; for verlet integration
                            collision.object2.owner.ppx = collision.object2.owner.position.x;
                            collision.object2.owner.ppz = collision.object2.owner.position.z;
                            //initialize current velocity for both x and z components
                            collision.object2.owner.cvx = collision.object2.owner.slideDir.x * collision.object2.owner.slideSpeed;
                            collision.object2.owner.cvz = collision.object2.owner.slideDir.z * collision.object2.owner.slideSpeed;
                        }
                    }
                }
            }
        }
        
        // Update NPCs
        for (const npc of this.npcs) {
            npc.update(this.t, dt);
            npc.checkBoundaries(this.arenaSize);
            npc.draw();
        }
 
        this.effect.render(this.scene, this.camera);
    }
}