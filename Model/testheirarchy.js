import * as T from 'three';
import { Object3D, Matrix4 } from 'three/webgpu';
export {End_Effector, Arc, translation}


export const hidden = new T.MeshToonMaterial({visible: false})
export const shades = new Uint8Array( 40 ); // How many shadedportions in the sphere
for ( let c = 0; c <= shades.length; c ++ ) {   // Make a rainbow out of the colors
    shades[ c ] = ( c /shades.length) * 256;
}
const gradientMap = new T.DataTexture( shades, shades.length, 1, T.RedFormat );
gradientMap.needsUpdate = true;
export function color( r = null, g = null, b = null) {
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
export const shapes = {
    ball: (rad = 5) => {return new T.SphereGeometry(rad)},
    box: (x = 1, y = 1, z = 1) => {return new T.BoxGeometry(x, y, z)},
    tube: (rad_top = 5, rad_bot = 5, height = 10) => {return new T.CylinderGeometry(
        rad_top, rad_bot, height
    )},
}

const v3 = (x, y, z) => {return new T.Vector3(x, y, z)}
const m4 = new Matrix4;
export const identity = () => {let m = new Matrix4; return m.identity()}; 
const translation = (x, y, z) => {
    if(x instanceof T.Vector3) return identity().makeTranslation(x.x, x.y, x.z);
    return identity().makeTranslation(x, y, z)
};

export function make_obj(model = shapes.ball(5), material = color(), matrix = identity()){
    let obj = new T.Mesh(model, material);
    obj.applyMatrix4(matrix);
    return obj;
}

function set_pos(element, x = null, y = null, z = null) {
    if(x instanceof T.Vector3) {
        element.position.x = x.x;
        element.position.y = x.y;
        element.position.z = x.z;
        return
    }

    if(x) element.position.x = x;
    if(y) element.position.y = y;
    if(z) element.position.z = z;
}
  
  // Minimal Node class which wraps a T.Object3D.
class Node {
    constructor(parent, scene) {
      this.parent = parent;
      this.children = [];
      this.core = new T.Object3D();
      // Ensure the object's matrix is manually updated
      this.core.matrixAutoUpdate = false;
      if (scene) {
        scene.add(this.core);
      }
    }
  }
  
  // Arc class definition
  class Arc {
    constructor(id, scene, location = new T.Matrix4().identity(), parent = null) {
      this.id = id;
      this.parent = parent;
      if (parent) {
        parent.children.push(this);
      }
      this.scene = scene;
      this.children = [];
      this.node = new Node(parent, this.scene);
      // Apply the given transformation matrix to the node’s core.
      this.node.core.applyMatrix4(location);
  
      // Extract the local translation.
      // Note: In T.js, the translation components are stored in elements 12, 13, 14.
      this.loc_matrix = translation(
        location.elements[12],
        location.elements[13],
        location.elements[14]
      );
  
      // Articulation matrix starts as identity.
      this.art_matrix = new T.Matrix4().identity();
  
      // Define degrees-of-freedom flags and initial angles (in degrees)
      this.is_dof = {
        Tx: false, Ty: false, Tz: false,
        Rx: true,  Ry: true,  Rz: true
      };
      this.dof = { Rx: 0, Ry: 0, Rz: 0 };
    }
  
    // Returns the world position of the node.
    get_global_position() {
      return this.node.core.getWorldPosition(new T.Vector3());
    }
  
    // Sets the degrees of freedom angles (in degrees) for the rotational axes.
    set_dof(x, y, z) {
      if (this.is_dof.Rx) this.dof.Rx = x;
      if (this.is_dof.Ry) this.dof.Ry = y;
      if (this.is_dof.Rz) this.dof.Rz = z;
    }
  
    // Computes the articulation matrix based on current DOF and applies it.
    set_articulation() {
      // Create an Euler rotation from the DOF values.
      const euler = new T.Euler(
        T.Math.degToRad(this.dof.Rx),
        T.Math.degToRad(this.dof.Ry),
        T.Math.degToRad(this.dof.Rz),
        'XYZ'
      );
      // Update the articulation matrix from the Euler angles.
      this.art_matrix.makeRotationFromEuler(euler);
  
      // Combine the articulation and local translation matrices.
      const combined = new T.Matrix4();
      combined.multiplyMatrices(this.art_matrix, this.loc_matrix);
  
      // Update the node's transformation.
      this.node.core.matrix.copy(combined);
      this.node.core.matrix.decompose(
        this.node.core.position,
        this.node.core.quaternion,
        this.node.core.scale
      );
      this.node.core.matrixWorldNeedsUpdate = true;
    }
  
    // Increments the rotational degrees of freedom by the provided delta values (in degrees)
    inc_articulation(deltaX, deltaY, deltaZ) {
      if (this.is_dof.Rx) this.dof.Rx += deltaX;
      if (this.is_dof.Ry) this.dof.Ry += deltaY;
      if (this.is_dof.Rz) this.dof.Rz += deltaZ;
      this.set_articulation();
    }
  }
  
  // EndEffector class extends Arc and adds inverse kinematics targeting.
  class End_Effector extends Arc {
    constructor(id, scene, location = new T.Matrix4().identity(), parent = null) {
      super(id, scene, location, parent);
    }
  
    // The target function implements a simple CCD IK algorithm.
    // It iterates over the chain of joints (from end effector's parent to the base)
    // and adjusts each joint to reduce the error between the end effector and the target.
    target(target_position) {
      const maxIterations = 20;   // Maximum CCD iterations.
      const threshold = 0.01;     // Convergence threshold (in world units).
      let iteration = 0;
      let distance = this.get_global_position().distanceTo(target_position);
  
      // Build the joint chain: starting from the end effector and moving up the hierarchy.
      let chain = [];
      let joint = this;
      while (joint) {
        chain.push(joint);
        joint = joint.parent;
      }
      // chain[0] is the end effector, chain[1] its parent, etc.
  
      // Perform CCD iterations until the end effector is close enough to the target.
      while (distance > threshold && iteration < maxIterations) {
        // Loop over the joints from the one immediately before the end effector upward.
        // We skip chain[0] because that's the end effector itself.
        for (let i = 1; i < chain.length; i++) {
          const joint = chain[i];
          const jointPos = joint.get_global_position();
          const effectorPos = this.get_global_position();
  
          // Vectors from the current joint to the end effector and to the target.
          const toEffector = new T.Vector3().subVectors(effectorPos, jointPos);
          const toTarget = new T.Vector3().subVectors(target_position, jointPos);
  
          // If either vector is too small, skip this joint.
          if (toEffector.length() < 1e-6 || toTarget.length() < 1e-6) continue;
  
          toEffector.normalize();
          toTarget.normalize();
  
          // Compute the angle between the two vectors.
          let angle = Math.acos(T.Math.clamp(toEffector.dot(toTarget), -1, 1));
  
          // Calculate the rotation axis (in world space).
          let axis = new T.Vector3().crossVectors(toEffector, toTarget);
          if (axis.length() < 1e-6 || angle < 1e-3) continue;
          axis.normalize();
  
          // Create a quaternion representing the required rotation.
          const deltaQuat = new T.Quaternion().setFromAxisAngle(axis, angle);
          const deltaMatrix = new T.Matrix4().makeRotationFromQuaternion(deltaQuat);
  
          // Update the joint's articulation matrix.
          // Here we pre-multiply to apply the new rotation on top of the current one.
          joint.art_matrix.premultiply(deltaMatrix);
  
          // Update the node's transformation: combine articulation and local translation.
          const combined = new T.Matrix4();
          combined.multiplyMatrices(joint.art_matrix, joint.loc_matrix);
          joint.node.core.matrix.copy(combined);
          joint.node.core.matrix.decompose(
            joint.node.core.position,
            joint.node.core.quaternion,
            joint.node.core.scale
          );
          joint.node.core.matrixWorldNeedsUpdate = true;
        }
        distance = this.get_global_position().distanceTo(target_position);
        iteration++;
      }
  
      console.log(`IK finished in ${iteration} iterations; final error: ${distance}`);
      return distance;
    }
  }
  