import * as T from 'three';
import { OrbitControls, OutlineEffect, TextGeometry} from 'three/examples/jsm/Addons.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { deltaTime, max, step, vec3 } from 'three/tsl';
import { Mesh, Quaternion } from 'three/webgpu';
import { hidden, color, Node, Arc, identity, translation, make_obj, shapes, End_Effector} from './Model/heirarchy.js';

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

// Main character (Reuven's model)
class MainCharacter extends Character {
    constructor(scene, position = new T.Vector3(0, 0, 0), scale = 1.0) {
        super(scene, position, scale);
        this.createCharacter();
    }
    
    createCharacter() {
        const body_width = 5;
        const body_depth = 1.75;
        const body_height = 7.5;
        const arm_length = 9.0;
        const leg_length = 13.0;
        const joint_size = body_depth/2 * 1.05;
        const leg_size = joint_size * 1.35;
        const hand_size = joint_size;
        const head_size = body_width/2.5;

        const l_color = color(0, 0, 0);
        const r_color = color(255, 255, 255);
        const body_color = color(255 * 0.3, 0, 0);

        this.core = new Arc("core", this.scene, translation(0, leg_length + leg_size, 0));
        let core_transform = new T.Matrix4();
        core_transform.makeRotationZ(T.MathUtils.degToRad(90));
        this.core.add_shape(shapes.tube(body_depth * 1.25 / 2, body_depth * 1.25 / 2, body_width / 3), body_color, core_transform);

        this.body = new Arc("body", this.scene, translation(0, body_height/2 + joint_size/2, 0), this.core);
        this.body.add_shape(shapes.box(body_width - body_depth, body_height, body_depth), body_color);
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(body_width/3, 0, 0));
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_height), body_color, translation(-body_width/3, 0, 0));
        core_transform.makeRotationZ(T.MathUtils.degToRad(90))
            .premultiply(new T.Matrix4().makeTranslation(0, body_height/2 - body_depth/4, 0));
        this.body.add_shape(shapes.tube(body_depth/2, body_depth/2, body_width), body_color, core_transform);

        this.head = new Arc("head", this.scene, translation(0, body_height/2 + head_size, 0), this.body); 
        this.head.add_shape(shapes.ball(head_size), body_color, translation(0, 0, 0));
        this.head.add_shape(shapes.ball(head_size).scale(1, 0.2, 1), l_color, translation(0, head_size/2, 0));
        this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(0.25), l_color, translation(0.75, 0, head_size));
        this.head.add_shape(shapes.box(0.25, 2, 0.25).rotateZ(-0.25), l_color, translation(0.75, 0, head_size));

        // ARMS
        this.r_arm = new Arc("r_arm", this.scene, translation(body_width/2 + joint_size/2, body_height/2 - joint_size/2, 0), this.body);
        this.r_arm.set_dof(true, true, true);
        this.r_arm.add_shape(shapes.ball(joint_size), body_color);
        let arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90))
            .premultiply(new T.Matrix4().makeTranslation(arm_length/4, 0, 0));
        this.r_arm.add_shape(shapes.tube(body_depth/2, body_depth/2, arm_length/2), r_color, arm_transform);

        this.r_fore = new Arc("r_fore", this.scene, translation(arm_length/2, 0, 0), this.r_arm);
        this.r_fore.set_dof(true, true, false);
        this.r_fore.add_shape(shapes.ball(joint_size), body_color);
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90))
            .premultiply(new T.Matrix4().makeTranslation(arm_length/4, 0, 0));
        this.r_fore.add_shape(shapes.tube(body_depth/2, body_depth/2, arm_length/2), r_color, arm_transform);

        this.r_hand = new Arc("r_hand", this.scene, translation(arm_length/2, 0, 0), this.r_fore);
        this.r_hand.add_shape(shapes.ball(hand_size), body_color);

        this.l_arm = new Arc("l_arm", this.scene, translation(-body_width/2 - joint_size/2, body_height/2 - joint_size/2, 0), this.body);
        this.l_arm.set_dof(true, true, true);
        this.l_arm.add_shape(shapes.ball(joint_size), body_color);
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90))
            .premultiply(new T.Matrix4().makeTranslation(-arm_length/4, 0, 0));
        this.l_arm.add_shape(shapes.tube(body_depth/2, body_depth/2, arm_length/2), l_color, arm_transform);

        this.l_fore = new Arc("l_fore", this.scene, translation(-arm_length/2, 0, 0), this.l_arm);
        this.l_fore.set_dof(true, true, false);
        this.l_fore.add_shape(shapes.ball(joint_size), body_color);
        arm_transform = new T.Matrix4();
        arm_transform.makeRotationZ(T.MathUtils.degToRad(90))
            .premultiply(new T.Matrix4().makeTranslation(-arm_length/4, 0, 0));
        this.l_fore.add_shape(shapes.tube(body_depth/2, body_depth/2, arm_length/2), l_color, arm_transform);
        
        this.l_hand = new Arc("l_hand", this.scene, translation(-arm_length/2, 0, 0), this.l_fore);
        this.l_hand.add_shape(shapes.ball(hand_size), body_color);

        // LEGS
        this.r_thigh = new Arc("r_thigh", this.scene, translation(body_width/2 - joint_size, 0, 0), this.core);
        this.r_thigh.add_shape(shapes.ball(leg_size), body_color);
        let leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0));
        this.r_thigh.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);

        this.r_shin = new Arc("r_shin", this.scene, translation(0, -leg_length/2, 0), this.r_thigh);
        this.r_shin.add_shape(shapes.ball(leg_size * 1.05), body_color);
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0));
        this.r_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        this.r_foot = new Arc("r_foot", this.scene, translation(0, -leg_length/2, 0), this.r_shin);
        this.r_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);

        this.l_thigh = new Arc("l_thigh", this.scene, translation(-body_width/2 + joint_size, 0, 0), this.core);
        this.l_thigh.add_shape(shapes.ball(leg_size), body_color);
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0));
        this.l_thigh.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), r_color, leg_transform);

        this.l_shin = new Arc("l_shin", this.scene, translation(0, -leg_length/2, 0), this.l_thigh);
        this.l_shin.add_shape(shapes.ball(leg_size * 1.05), body_color);
        leg_transform = new T.Matrix4();
        leg_transform.premultiply(new T.Matrix4().makeTranslation(0, -leg_length/4, 0));
        this.l_shin.add_shape(shapes.tube(leg_size, leg_size, leg_length/2), l_color, leg_transform);

        this.l_foot = new Arc("l_foot", this.scene, translation(0, -leg_length/2, 0), this.l_shin);
        this.l_foot.add_shape(shapes.ball(leg_size * 1.05), body_color);
    }
    
    update(time, dt) {
        // Tries to use the same procedural animation for animating the arms (It doesn't really work)
        if (this.r_fore) {
            this.r_fore.set_articulation([0, Math.sin(time), 0]);
            this.l_fore.set_articulation([0, Math.sin(time + Math.PI), 0]);
        }
    }

    draw() {
        // Handled by Arc
    }

    checkBoundaries(arenaSize) {
        // Needed once main character starts moving
    }
}

//NPC Charactr implementation (based on my work for assignment 2)
class NPCCharacter extends Character {
    constructor(scene, position = new T.Vector3(0, 0, 0), scale = 0.75) {
        super(scene, position, scale);
        this.objectsCreated = false;
        
        this.animPhase = Math.random() * Math.PI * 2;
        this.animSpeed = 0.5 + Math.random() * 1.0;
        this.moveSpeed = 0.05 + Math.random() * 0.1;
        this.moveDir = new T.Vector3(
            Math.random() * 2 - 1,
            0,
            Math.random() * 2 - 1
        ).normalize();
        
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
        // Delete? Not really used
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
    update(time, dt) {
        // Walking animation
        this.theta[0] = Math.sin(time * this.animSpeed + this.animPhase) * 0.5;  // Main arm swing
        this.theta[1] = Math.cos(time * this.animSpeed + this.animPhase) * 0.2;  // Minor side swing
        this.theta[2] = Math.sin(time * this.animSpeed + this.animPhase + Math.PI/4) * 0.2;  // Arm rotation
        
        this.applyTheta();
        
        // Move the character
        this.position.x += this.moveDir.x * this.moveSpeed * dt * 30;
        this.position.z += this.moveDir.z * this.moveSpeed * dt * 30;
        
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
        this.scene.background = new T.Color(0x222233);
    
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

        // Lights
        this.setupLights();
        this.effect = new OutlineEffect(this.renderer);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = 30;
        this.controls.maxDistance = 2000;
        this.controls.maxPolarAngle = Math.PI - 0.05;
        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.clock = new T.Clock();
        this.lightTime = 0;
        this.arenaSize = 400;
        this.arenaHeight = 200;
        
        // Initialize arena here
        this.createArena();
        this.mainCharacter = new MainCharacter(this.scene);
        this.npcs = [];
        this.createNPCs(12);
        
        this.init();
    }
    
    setupLights() {
        //Main light
        this.particleLight = new T.Mesh(
            new T.SphereGeometry(2, 8, 8),
            new T.MeshBasicMaterial({ color: 0xffffff })
        );
        this.scene.add(this.particleLight);
        this.scene.add(new T.AmbientLight(0x555566, 3));
        
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
            
            // Alternate colors (Remove?)
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
        
        // Target ball
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
        
        this.circle.position.x = Math.cos(this.t) * this.arenaSize * 0.5;
        this.circle.position.z = Math.sin(this.t * 0.7) * this.arenaSize * 0.5;
        
        this.mainCharacter.update(this.t, dt);
        
        for (const npc of this.npcs) {
            npc.update(this.t, dt);
            npc.checkBoundaries(this.arenaSize);
            npc.draw();
        }
 
        this.effect.render(this.scene, this.camera);
    }
}