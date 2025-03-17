import * as T from 'three';

/**
 *    Main design of BVH Tree (Does not account for cylinders (arms on the NPCs) since I added those later)
 * -> Approximate all limbs by a sphere with a certain radius
 * -> Build BVH Tree by gathering all the collidable objects; and create an Axis Aligned Bounding Box (AABB) around them
 * -> Recursively build all the child BVH nodes in this manner
 * 
 * 
 *                           BVHNode (All Collidable Objects)
 *                                  /            \
 *                                 /              \
 *              BVHNode (Player + NPCs 1-3)      BVHNode (NPCs 4-12)
 *                     /          \                /          \
 *                    /            \              /            \
 *         BVHNode (Player+NPC1)  BVHNode (NPCs 2-3)           <Similar subdivision>
 *            /           \           /         \
 *           /             \         /           \
 *    BVHNode (Player)  BVHNode(NPC1)  BVHNode(NPC2)  BVHNode(NPC3)
 *    [Player.Body]     [NPC1.Torso]   [NPC2.Torso]   [NPC3.Torso]
 *    [Player.Head]     [NPC1.Head]    [NPC2.Head]    [NPC3.Head]
 *    [Player.R_Hand]   [NPC1.R_Hand]  [NPC2.R_Hand]  [NPC3.R_Hand]
 *    [Player.L_Hand]   [NPC1.L_Hand]  [NPC2.L_Hand]  [NPC3.L_Hand]
 * 
 *    Collision Detection (i.e. what happens every frame)
 * 
 * -> Call createBVHNode
 * -> Create AABB to cover all the spheres
 * -> Keep splitting along the longest axis along the median until you arrive at a node with 4 objects, this is leaf node
 * -> If all objects are on the same side force an even split
 * 
 * Also added cylinders specifically for the 
 * 
 * 
 * 
 *  Efficiency : For 12 NPCs with arenaSize (in scene.js) set to 400 there are about 2 collisions per frame
 *  As arenaSize is reduced there is more lag
 * 
 */


export class CollisionSystem {
    constructor() {
        this.collidableObjects = [];
        this.bvh = null;
        this.collisionPairs = [];
        this.substepCount = 4;
        this.lastUpdateTime = 0;
        this.collisionEvents = []; // @ James; can use this to see b/w what the collisions are occuring
        this.debugMode = true; 
        this.initialized = false;
        this.initializationAttempts = 0;
    }

    addCharacter(character, type) {
        const collidableParts = this.extractCollidableParts(character, type); //Extract relevant meshes
        this.collidableObjects.push(...collidableParts);
        this.buildBVH();
    }

    extractCollidableParts(character, type) {
        const parts = [];
        
        if (type === 'main') {
            this.extractPlayerModelParts(character.player, parts, character);
        } 
        else if (type === 'npc') {
            this.extractNPCParts(character, parts, character);
        }
        
        return parts;
    }
    extractPlayerModelParts(playerModel, parts, owner) {
        // console.log(playerModel)
        const bodyParts = [
            { node: playerModel.body.node, name: 'body', radius: 3.5 },
            { node: playerModel.head.node, name: 'head', radius: 2.0 },  
            { node: playerModel.r_end.node, name: 'right_hand', radius: 2.7 }, 
            { node: playerModel.l_end.node, name: 'left_hand', radius: 2.7 }
            //All these values can be adjusted as necessary
        ];

        
        
        for (const part of bodyParts) {
            if (part.node && part.node.core) {
                parts.push({
                    node: part.node,
                    name: part.name,
                    radius: part.radius,
                    owner: owner,
                    type: 'main'
                });
            }
        }
    }
    
    extractNPCParts(npcCharacter, parts, owner) {
        if (!npcCharacter.objectsCreated) {
            npcCharacter.createMeshes();
        }
        
        const bodyParts = [
            { node: npcCharacter.torsoNode, name: 'torso', radius: 2 * npcCharacter.scale },
            { node: npcCharacter.headNode, name: 'head', radius: 1 * npcCharacter.scale },
            { node: npcCharacter.rHandNode, name: 'right_hand', radius: 1.0 * npcCharacter.scale },
            { node: npcCharacter.lHandNode, name: 'left_hand', radius: 1.0 * npcCharacter.scale }
        ];
        
        for (const part of bodyParts) {
            if (part.node) {
                parts.push({
                    node: part.node,
                    name: part.name,
                    radius: part.radius,
                    owner: owner,
                    type: 'npc'
                });
            }
        }
        
        // This part adds the cylindrical sections
        this.addArmCollisionVolumes(npcCharacter, parts, owner);
    }

    addArmCollisionVolumes(npcCharacter, parts, owner) {
        if (!npcCharacter.headNode || !npcCharacter.rHandNode || !npcCharacter.lHandNode) {
            return;
        }
        
        parts.push({
            node: {
                headNode: npcCharacter.headNode,
                handNode: npcCharacter.rHandNode,
                isCuboid: true
            },
            name: 'right_arm',
            radius: 0.7 * npcCharacter.scale, // Can be scaled
            length: 10 * npcCharacter.scale, 
            owner: owner,
            type: 'npc',
            isCuboidArm: true,
            isRightArm: true
        });
        
        parts.push({
            node: {
                headNode: npcCharacter.headNode,
                handNode: npcCharacter.lHandNode,
                isCuboid: true
            },
            name: 'left_arm',
            radius: 0.7 * npcCharacter.scale,
            length: 10 * npcCharacter.scale, 
            owner: owner,
            type: 'npc',
            isCuboidArm: true,
            isRightArm: false
        });
    }

    // Creates the node for hierarchical space partitioning
    createBVHNode(objects, depth = 0, maxDepth = 10) {
        if (objects.length === 0) {
            return null;
        }
        
        const node = {
            boundingBox: this.computeBoundingBox(objects),
            objects: objects.length <= 4 || depth >= maxDepth ? [...objects] : [],
            left: null,
            right: null
        };
        
        if (node.objects.length > 0) {
            return node;
        }
        
        const extents = {
            x: node.boundingBox.max.x - node.boundingBox.min.x,
            y: node.boundingBox.max.y - node.boundingBox.min.y,
            z: node.boundingBox.max.z - node.boundingBox.min.z
        };
        
        const axis = extents.x > extents.y ? 
                    (extents.x > extents.z ? 'x' : 'z') : 
                    (extents.y > extents.z ? 'y' : 'z');
        
        const midValue = this.computeMedianValue(objects, axis);
        const leftObjects = [];
        const rightObjects = [];
        
        for (const obj of objects) {
            const position = this.getObjectPosition(obj);
            if (position[axis] < midValue) {
                leftObjects.push(obj);
            } 
            else {
                rightObjects.push(obj);
            }
        }
        
        // Ensure no emptry children
        if (leftObjects.length === 0 || rightObjects.length === 0) {
            const halfIndex = Math.floor(objects.length / 2);
            leftObjects.length = 0;
            rightObjects.length = 0;
            
            for (let i = 0; i < objects.length; i++) {
                if (i < halfIndex) {
                    leftObjects.push(objects[i]);
                } 
                else {
                    rightObjects.push(objects[i]);
                }
            }
        }

        // Builds recursively
        node.left = this.createBVHNode(leftObjects, depth + 1, maxDepth);
        node.right = this.createBVHNode(rightObjects, depth + 1, maxDepth);
        
        return node;
    }
    
    buildBVH() {
        if (this.collidableObjects.length === 0) {
            this.bvh = null;
            return;
        }
        
        this.bvh = this.createBVHNode(this.collidableObjects);
    }
    
    updateBVH() {
        this.buildBVH();
    } // Rebuilds at every step
    
    computeBoundingBox(objects) {
        const min = new T.Vector3(Infinity, Infinity, Infinity);
        const max = new T.Vector3(-Infinity, -Infinity, -Infinity);
        
        for (const obj of objects) {
            const position = this.getObjectPosition(obj);
            const radius = obj.radius || 1.0;
            
            min.x = Math.min(min.x, position.x - radius);
            min.y = Math.min(min.y, position.y - radius);
            min.z = Math.min(min.z, position.z - radius);
            
            max.x = Math.max(max.x, position.x + radius);
            max.y = Math.max(max.y, position.y + radius);
            max.z = Math.max(max.z, position.z + radius);
        }
        
        return { min, max };
    }
    
    computeMedianValue(objects, axis) {
        const values = objects.map(obj => this.getObjectPosition(obj)[axis]);
        values.sort((a, b) => a - b);
        
        const mid = Math.floor(values.length / 2);
        if (values.length % 2 === 0) {
            return (values[mid - 1] + values[mid]) / 2;
        }
        return values[mid];
    }
    
    // Gets the world position
    getObjectPosition(obj) {
        if (obj.tempPosition) return obj.tempPosition;
        
        if (obj.isCuboidArm) {// Should be cylindrical arm not cuboidal
            return this.getArmCuboidCenter(obj);
        }
        
        const position = new T.Vector3();
        
        if (obj.node) {
            if (obj.type === 'main') {
                if (obj.node.core) {
                    obj.node.core.getWorldPosition(position);
                    if (this.debugMode && !obj.debugSphere) {
                        this.createDebugSphere(obj, position);
                    } 
                    else if (this.debugMode && obj.debugSphere) {
                        obj.debugSphere.position.copy(position);
                    }
                }
            } 
            else if (obj.type === 'npc') {
                if (obj.node.object3D) {
                    obj.node.object3D.getWorldPosition(position);
                    
                    // Draws the spheres on the screen
                    if (this.debugMode && !obj.debugSphere) {
                        this.createDebugSphere(obj, position);
                    } 
                    else if (this.debugMode && obj.debugSphere) {
                        obj.debugSphere.position.copy(position);
                    }
                } 
                else {
                    if (obj.owner && obj.owner.position) {
                        position.copy(obj.owner.position);
                        
                        if (obj.name === 'head') {
                            position.y += 7.0 * obj.owner.scale; 
                        } 
                        else if (obj.name === 'right_hand') {
                            position.x += 3.0 * obj.owner.scale;
                            position.y += 2.0 * obj.owner.scale;
                        } 
                        else if (obj.name === 'left_hand') {
                            position.x -= 3.0 * obj.owner.scale;
                            position.y += 2.0 * obj.owner.scale;
                        }
                    }
                }
            }
        }
        
        return position;
    }

    getArmCuboidCenter(obj) {
        const position = new T.Vector3();
        
        if (!obj.node || !obj.node.headNode || !obj.node.handNode) return position;
        
        const headPos = new T.Vector3();
        if (obj.node.headNode.object3D) {
            obj.node.headNode.object3D.getWorldPosition(headPos);
            headPos.y -= 1.0 * obj.owner.scale;
        }
        
        const handPos = new T.Vector3();
        if (obj.node.handNode.object3D) {
            obj.node.handNode.object3D.getWorldPosition(handPos);
        }
        
        position.lerpVectors(headPos, handPos, 0.5);
        
        // Draws the cylindrical arms
        if (this.debugMode && !obj.debugCuboid) {
            this.createArmCuboidDebug(obj, headPos, handPos);
        } 
        else if (this.debugMode && obj.debugCuboid) {
            this.updateArmCuboidDebug(obj, headPos, handPos);
        }
        
        return position;
    }

    // Represents the arms using cylinders
    createArmCuboidDebug(obj, headPos, handPos) {
        const direction = new T.Vector3().subVectors(handPos, headPos);
        const length = direction.length();
        const radius = obj.radius * 0.5;
        
        const geometry = new T.CylinderGeometry(radius, radius, length, 8);        
        const material = new T.MeshBasicMaterial({
            color: obj.isRightArm ? 0xff8c00 : 0x9932cc,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        obj.debugCuboid = new T.Mesh(geometry, material);
        
        const midpoint = new T.Vector3().lerpVectors(headPos, handPos, 0.5);
        obj.debugCuboid.position.copy(midpoint);
        if (length > 0.001) {
            direction.normalize();
            obj.debugCuboid.quaternion.setFromUnitVectors(
                new T.Vector3(0, 1, 0),
                direction
            );
        }

        if (obj.owner && obj.owner.scene) {
            obj.owner.scene.add(obj.debugCuboid);
        }
    }

    updateArmCuboidDebug(obj, headPos, handPos) {
        if (!obj.debugCuboid) return;

        const direction = new T.Vector3().subVectors(handPos, headPos);
        const newLength = direction.length();
        const midpoint = new T.Vector3().lerpVectors(headPos, handPos, 0.5);
        obj.debugCuboid.position.copy(midpoint);
        obj.debugCuboid.scale.y = newLength / obj.debugCuboid.geometry.parameters.height;
        
        if (newLength > 0.001) {
            direction.normalize();
            
            obj.debugCuboid.quaternion.setFromUnitVectors(
                new T.Vector3(0, 1, 0), 
                direction
            );
        }
    }
    
    createDebugSphere(obj, position) {
        const geometry = new T.SphereGeometry(obj.radius, 16, 8);
        const material = new T.MeshBasicMaterial({ 
            color: obj.type === 'main' ? 0x00ff00 : 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        obj.debugSphere = new T.Mesh(geometry, material);
        obj.debugSphere.position.copy(position);
        
        if (obj.owner && obj.owner.scene) {
            obj.owner.scene.add(obj.debugSphere);
        }
    }
    
    checkBoundingBoxOverlap(box1, box2) {
        return (
            box1.min.x <= box2.max.x && box1.max.x >= box2.min.x &&
            box1.min.y <= box2.max.y && box1.max.y >= box2.min.y &&
            box1.min.z <= box2.max.z && box1.max.z >= box2.min.z
        );
    }
    
    findPotentialCollisions(node1, node2) {
        if (!node1 || !node2) return [];
        
        if (!this.checkBoundingBoxOverlap(node1.boundingBox, node2.boundingBox)) {
            return [];
        }
        
        const pairs = [];
        
        // If there are leafs check object to object collisions
        if (node1.objects.length > 0 && node2.objects.length > 0) {
            for (const obj1 of node1.objects) {
                for (const obj2 of node2.objects) {
                    if (obj1.owner !== obj2.owner) {
                        pairs.push([obj1, obj2]);// Avoids self collisions 
                    }
                }
            }
            return pairs;
        }
        
        if (node1.objects.length > 0) {
            return [
                ...this.findPotentialCollisions(node1, node2.left),
                ...this.findPotentialCollisions(node1, node2.right)
            ];
        }
        
        if (node2.objects.length > 0) {
            return [
                ...this.findPotentialCollisions(node1.left, node2),
                ...this.findPotentialCollisions(node1.right, node2)
            ];
        }
        
        return [
            ...this.findPotentialCollisions(node1.left, node2.left),
            ...this.findPotentialCollisions(node1.left, node2.right),
            ...this.findPotentialCollisions(node1.right, node2.left),
            ...this.findPotentialCollisions(node1.right, node2.right)
        ];

        // Recusrses till you find children
    }
    
    findSelfCollisions(node) {
        if (!node) return [];
        
        const pairs = [];
        
        const objects = node.objects;
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                if (objects[i].owner !== objects[j].owner) {
                    pairs.push([objects[i], objects[j]]);
                }
            }
        }
        
        if (node.left) {
            pairs.push(...this.findSelfCollisions(node.left));
        }
        
        if (node.right) {
            pairs.push(...this.findSelfCollisions(node.right));
        }

        if (node.left && node.right) {
            pairs.push(...this.findPotentialCollisions(node.left, node.right));
        }
        
        return pairs;
    }

    checkSphereCollision(obj1, obj2, margin = 1.0) {
        if (obj1.isCuboidArm || obj2.isCuboidArm) {// CD for cylindrical arms
            return this.checkCuboidSphereCollision(
                obj1.isCuboidArm ? obj1 : obj2,
                obj1.isCuboidArm ? obj2 : obj1,
                margin
            );
        }

        // CD for spheres

        const pos1 = this.getObjectPosition(obj1);
        const pos2 = this.getObjectPosition(obj2);
        
        const radius1 = (obj1.radius || 1.0) * margin;
        const radius2 = (obj2.radius || 1.0) * margin;
        
        const distanceSquared = pos1.distanceToSquared(pos2);
        const minDistance = radius1 + radius2;
        
        return distanceSquared < minDistance * minDistance;
    }

    checkCuboidSphereCollision(cuboidObj, sphereObj, margin = 1.0) {
        if (!cuboidObj.node || !cuboidObj.node.headNode || !cuboidObj.node.handNode) {
            return false;
        }

        const headPos = new T.Vector3();
        if (cuboidObj.node.headNode.object3D) {
            cuboidObj.node.headNode.object3D.getWorldPosition(headPos);
            headPos.y -= 1.5 * cuboidObj.owner.scale;
        }
        
        const handPos = new T.Vector3();
        if (cuboidObj.node.handNode.object3D) {
            cuboidObj.node.handNode.object3D.getWorldPosition(handPos);
        }
        
        const spherePos = this.getObjectPosition(sphereObj);
        const sphereRadius = (sphereObj.radius || 1.0) * margin;
        const cuboidRadius = (cuboidObj.radius || 0.7) * margin;
        
        const armDir = new T.Vector3().subVectors(handPos, headPos);
        const armLength = armDir.length();
        
        if (armLength < 0.001) {
            return headPos.distanceTo(spherePos) < (sphereRadius + cuboidRadius);
        }
        
        armDir.normalize();
        
        const headToSphere = new T.Vector3().subVectors(spherePos, headPos);
        const projection = headToSphere.dot(armDir);
        
        let closestPoint = new T.Vector3();
        if (projection <= 0) {
            closestPoint.copy(headPos);
        } 
        else if (projection >= armLength) {
            closestPoint.copy(handPos);
        } 
        else {
            closestPoint.copy(armDir).multiplyScalar(projection).add(headPos);
        }
        
        const distance = closestPoint.distanceTo(spherePos);
        
        // Can be used to remove the rendering of the spheres and cylindders
        if (this.debugMode && Math.random() < 0.01) {
            // console.log("Arm collision check:", {
            //     headPos: headPos.toArray(),
            //     handPos: handPos.toArray(), 
            //     closestPoint: closestPoint.toArray(),
            //     spherePos: spherePos.toArray(),
            //     distance: distance,
            //     threshold: (sphereRadius + cuboidRadius)
            // });
        }
        
        return distance < (sphereRadius + cuboidRadius); // Detect the collision
    }
    
    // Use if travelling at high velocities
    checkCollisionWithSubstepping(obj1, obj2, prevPos1, prevPos2, substepCount) {
        if (this.checkSphereCollision(obj1, obj2)) {
            return true;
        }
        
        const currPos1 = this.getObjectPosition(obj1);
        const currPos2 = this.getObjectPosition(obj2);
        
        for (let step = 1; step <= substepCount; step++) {
            const t = step / substepCount;
            
            const interpPos1 = prevPos1.clone().lerp(currPos1, t);
            const interpPos2 = prevPos2.clone().lerp(currPos2, t);
            
            const tempObj1 = { ...obj1, tempPosition: interpPos1 };
            const tempObj2 = { ...obj2, tempPosition: interpPos2 };

            const originalGetPos = this.getObjectPosition;
            this.getObjectPosition = (obj) => {
                if (obj.tempPosition) return obj.tempPosition;
                return originalGetPos.call(this, obj);
            };
            
            const collision = this.checkSphereCollision(tempObj1, tempObj2);
            this.getObjectPosition = originalGetPos;
            
            if (collision) {
                return true;
            }
        }
        
        return false;
    }
    
    storePreviousPositions() {
        for (const obj of this.collidableObjects) {
            obj.previousPosition = this.getObjectPosition(obj).clone();
        }
    }

    update(time, dt) {
        if (!this.initialized) {
            this.initializationAttempts++;
            
            if (this.collidableObjects.length > 0) {
                this.updateBVH();
                this.initialized = true;
            } 
            else if (this.initializationAttempts > 10) {
                // console.log("Reinit collision system");
                this.reinitializeSystem();
                this.initialized = true;
            }
        }
        
        this.updateBVH();
        let potentialPairs = [];
        
        if (this.bvh) {
            potentialPairs = this.findSelfCollisions(this.bvh);
            
            if (potentialPairs.length > 0) {
                // console.log(`Found ${potentialPairs.length} potential collision pairs`);
            }
        }
        
        this.collisionEvents = [];
        
        for (const [obj1, obj2] of potentialPairs) {
            if (this.checkSphereCollision(obj1, obj2)) {
                this.recordCollision(obj1, obj2);
                
                if (this.debugMode) { // Highlights the collision 
                    this.highlightCollision(obj1, obj2);
                }
            }
        }
        
        this.storePreviousPositions();
        this.lastUpdateTime = time;
        
        if (this.collisionEvents.length > 0) {
            // console.log(`Detected ${this.collisionEvents.length} collisions this frame`);
            for (const collision of this.collisionEvents) {
                // console.log(`Collision between ${collision.object1.type}:${collision.object1.part} and ${collision.object2.type}:${collision.object2.part}`);
            } // @ James -> Can use this to see b/w what the collision occured
        }
    }
    
    highlightCollision(obj1, obj2) {
        if (obj1.debugSphere) {
            const originalColor = obj1.debugSphere.material.color.clone();
            obj1.debugSphere.material.color.set(0xffff00);// Yellow
            
            setTimeout(() => {
                if (obj1.debugSphere) {
                    obj1.debugSphere.material.color.copy(originalColor);
                }
            }, 100);
        }
        
        if (obj2.debugSphere) {
            const originalColor = obj2.debugSphere.material.color.clone();
            obj2.debugSphere.material.color.set(0xffff00); // Yellow for collision
            
            setTimeout(() => {
                if (obj2.debugSphere) {
                    obj2.debugSphere.material.color.copy(originalColor);
                }
            }, 100);
        }
    }
    
    reinitializeSystem() {
        this.collidableObjects = [];
        let game = null;
        for (const obj of this.collidableObjects) {
            if (obj.owner && obj.owner.scene) {
                // Look for game object
                if (obj.owner.scene.parent && obj.owner.scene.parent.mainCharacter) {
                    game = obj.owner.scene.parent;
                    break;
                }
            }
        }
        
        if (game) {
            if (game.mainCharacter) {
                this.addCharacter(game.mainCharacter, 'main');
            }
            
            if (game.npcs && Array.isArray(game.npcs)) {
                for (const npc of game.npcs) {
                    this.addCharacter(npc, 'npc');
                }
            }
        }
    }
    
    recordCollision(obj1, obj2) {
        this.collisionEvents.push({
            object1: {
                owner: obj1.owner,
                part: obj1.name,
                type: obj1.type
            },
            object2: {
                owner: obj2.owner,
                part: obj2.name,
                type: obj2.type
            },
            time: this.lastUpdateTime
        });
    }
    

    // Old code; these fns are not used anymore but could be useful for physics so I left them in
    getCollisionEvents() {
        return this.collisionEvents;
    }
    
    hasCollision(character) {
        return this.collisionEvents.some(event => 
            event.object1.owner === character || 
            event.object2.owner === character
        );
    }

    getCollisionsForCharacter(character) {
        return this.collisionEvents.filter(event => 
            event.object1.owner === character || 
            event.object2.owner === character
        );
    }
    
    // Clear all tracked objects and reset (This is used)
    clear() {
        // Use to clear all drawings
        if (this.debugMode) {
            for (const obj of this.collidableObjects) {
                if (obj.debugSphere && obj.owner && obj.owner.scene) {
                    obj.owner.scene.remove(obj.debugSphere);
                    obj.debugSphere.geometry.dispose();
                    obj.debugSphere.material.dispose();
                    obj.debugSphere = null;
                }
                
                if (obj.debugCuboid && obj.owner && obj.owner.scene) {
                    obj.owner.scene.remove(obj.debugCuboid);
                    obj.debugCuboid.geometry.dispose();
                    obj.debugCuboid.material.dispose();
                    obj.debugCuboid = null;
                }
            }
        }
        
        this.collidableObjects = [];
        this.bvh = null;
        this.collisionEvents = [];
    }
}

// This is the fn called in scene.js
export function integrateCollisionSystem(game) {
    console.log("Creating BVH Hierarchies");
    const collisionSystem = new CollisionSystem();
    
    setTimeout(() => {
        console.log("Initializing collision system with characters");
        
        if (game.mainCharacter) {
            collisionSystem.addCharacter(game.mainCharacter, 'main');
        } 
        else {
            console.warn("Main character not found");
        }
        
        if (game.npcs && Array.isArray(game.npcs)) {
            let npcCount = 0;
            for (const npc of game.npcs) {
                if (npc) {
                    collisionSystem.addCharacter(npc, 'npc');
                    npcCount++;
                }
            }
            console.log(`Added ${npcCount} NPCs to collision system`);
        } 
        else {
            console.warn("No NPCs found");
        }
        
        collisionSystem.buildBVH();
    }, 1000); // Wait 1 second to ensure all objects are created
    
    const originalRender = game.render;
    game.render = function() {
        originalRender.call(game);
        
        if (game.collisionSystem && game.collisionSystem.collidableObjects.length > 0) {
            game.collisionSystem.update(game.t, game.clock.getDelta());
        }
    };
    
    game.testCollision = function() { //Use this in scene.js to bring NPCs close to player
        console.log("Manual collision test initiated");
        
        if (game.mainCharacter && game.npcs && game.npcs.length > 0) {
            const playerPos = game.mainCharacter.player.core.get_global_position();
            console.log("Player position:", playerPos);
            
            if (game.npcs[0]) {
                game.npcs[0].position.set(
                    playerPos.x + 5,
                    playerPos.y,
                    playerPos.z
                );
                console.log("Moved NPC to:", game.npcs[0].position);
                game.npcs[0].update(game.t, 0.16);
                game.npcs[0].draw();
                
                if (game.collisionSystem) {
                    game.collisionSystem.clear();
                    game.collisionSystem.addCharacter(game.mainCharacter, 'main');
                    for (const npc of game.npcs) {
                        game.collisionSystem.addCharacter(npc, 'npc');
                    }
                    game.collisionSystem.buildBVH();

                    game.collisionSystem.update(game.t, 0.16);
                    
                    const events = game.collisionSystem.getCollisionEvents();
                }
            }
        } 
        else 
        {
            console.warn("No characters");
        }
    };
    
    game.collisionSystem = collisionSystem;
    
    return collisionSystem;
}