import {tiny, defs} from './examples/common.js';

const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// Handle basic matix ops
const math = {
  multiply: (a, b) => {
    if (Array.isArray(a[0])) {
      // Multiplication
      const result = Array(a.length).fill().map(() => Array(b[0].length).fill(0));
      return result.map((row, i) => {
        return row.map((val, j) => {
          return a[i].reduce((sum, elm, k) => sum + (elm * b[k][j]), 0);
        });
      });
    } else {
      // Vector multiplication
      return b.map((row) => {
        return row.reduce((sum, val, j) => sum + (val * a[j]), 0);
      });
    }
  },
  transpose: (matrix) => {
    return matrix[0].map((col, i) => matrix.map(row => row[i]));
  },
  inv: (matrix) => {
    // 3x3 matrix inversion
    if (matrix.length === 3 && matrix[0].length === 3) {
      const det = matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
                  matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
                  matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
      
      if (det === 0) {
        throw new Error("Matrix is singular and cannot be inverted");
      }
      
      const invDet = 1 / det;
      
      const result = [
        [(matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) * invDet, 
         (matrix[0][2] * matrix[2][1] - matrix[0][1] * matrix[2][2]) * invDet, 
         (matrix[0][1] * matrix[1][2] - matrix[0][2] * matrix[1][1]) * invDet],
        [(matrix[1][2] * matrix[2][0] - matrix[1][0] * matrix[2][2]) * invDet, 
         (matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0]) * invDet, 
         (matrix[0][2] * matrix[1][0] - matrix[0][0] * matrix[1][2]) * invDet],
        [(matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]) * invDet, 
         (matrix[0][1] * matrix[2][0] - matrix[0][0] * matrix[2][1]) * invDet, 
         (matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]) * invDet]
      ];
      
      return result;
    }
    
    throw new Error("Only 3x3 matrix inversion is implemented");
  },
  lusolve: (A, b) => {
    // Solve eqn of the form Ax = b
    // For our simplified case, we'll just use a direct approach
    // This is a very simplified approximation and won't work for all cases
    const n = A.length;
    const result = Array(n).fill(0).map(() => [0]);
    
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += A[i][j] * result[j][0];
      }
      result[i][0] = (b[i][0] - sum) / A[i][i];
    }
    
    return result;
  }
};

const shapes = {
    'sphere': new defs.Subdivision_Sphere(5),
};

export
const Articulated_Human = 
class Articulated_Human {
    constructor() {
             const sphere_shape = shapes.sphere;

        // torso node
        const torso_transform = Mat4.scale(1, 2.5, 1);
        this.torso_node = new Node("torso", sphere_shape, torso_transform);
        // root->torso
        const root_location = Mat4.translation(-1, 4, 1);
        this.root = new Arc("root", null, this.torso_node, root_location);

        // head node
        let head_transform = Mat4.scale(.6, .6, .6);
        head_transform.pre_multiply(Mat4.translation(0, .6, 0));
        this.head_node = new Node("head", sphere_shape, head_transform);
        // torso->neck->head
        const neck_location = Mat4.translation(0, 2.5, 0);
        this.neck = new Arc("neck", this.torso_node, this.head_node, neck_location);
        this.torso_node.children_arcs.push(this.neck);

        // right upper arm node
        let ru_arm_transform = Mat4.scale(1.2, .2, .2);
        ru_arm_transform.pre_multiply(Mat4.translation(1.2, 0, 0));
        this.ru_arm_node = new Node("ru_arm", sphere_shape, ru_arm_transform);
        // torso->r_shoulder->ru_arm
        const r_shoulder_location = Mat4.translation(0.6, 2, 0);
        this.r_shoulder = new Arc("r_shoulder", this.torso_node, this.ru_arm_node, r_shoulder_location);
        this.torso_node.children_arcs.push(this.r_shoulder)
        this.r_shoulder.set_dof(true, true, true);

        // left upper arm node
        let lu_arm_transform = Mat4.scale(1.2, .2, .2);
        lu_arm_transform.pre_multiply(Mat4.translation(-1.2, 0, 0));
        this.lu_arm_node = new Node("lu_arm", sphere_shape, lu_arm_transform);
        // torso->r_shoulder->ru_arm
        const l_shoulder_location = Mat4.translation(-0.6, 2, 0);
        this.l_shoulder = new Arc("l_shoulder", this.torso_node, this.lu_arm_node, l_shoulder_location);
        this.torso_node.children_arcs.push(this.l_shoulder)
        this.l_shoulder.set_dof(true, true, true);


        // right lower arm node
        let rl_arm_transform = Mat4.scale(1, .2, .2);
        rl_arm_transform.pre_multiply(Mat4.translation(1, 0, 0));
        this.rl_arm_node = new Node("rl_arm", sphere_shape, rl_arm_transform);
        // ru_arm->r_elbow->rl_arm
        const r_elbow_location = Mat4.translation(2.4, 0, 0);
        this.r_elbow = new Arc("r_elbow", this.ru_arm_node, this.rl_arm_node, r_elbow_location);
        this.ru_arm_node.children_arcs.push(this.r_elbow)
        this.r_elbow.set_dof(true, true, false);

        // left lower arm node
        let ll_arm_transform = Mat4.scale(1, .2, .2);
        ll_arm_transform.pre_multiply(Mat4.translation(-1, 0, 0));
        this.ll_arm_node = new Node("ll_arm", sphere_shape, ll_arm_transform);
        // ru_arm->r_elbow->rl_arm
        const l_elbow_location = Mat4.translation(-2.4, 0, 0);
        this.l_elbow = new Arc("l_elbow", this.lu_arm_node, this.ll_arm_node, l_elbow_location);
        this.lu_arm_node.children_arcs.push(this.l_elbow)
        this.l_elbow.set_dof(true, true, false);



        // right hand node
        let r_hand_transform = Mat4.scale(.4, .3, .2);
        r_hand_transform.pre_multiply(Mat4.translation(0.4, 0, 0));
        this.r_hand_node = new Node("r_hand", sphere_shape, r_hand_transform);
        // rl_arm->r_wrist->r_hand
        const r_wrist_location = Mat4.translation(2, 0, 0);
        this.r_wrist = new Arc("r_wrist", this.rl_arm_node, this.r_hand_node, r_wrist_location);
        this.rl_arm_node.children_arcs.push(this.r_wrist);
        this.r_wrist.set_dof(true, false, true);

        // left hand node
        let l_hand_transform = Mat4.scale(.4, .3, .2);
        l_hand_transform.pre_multiply(Mat4.translation(-0.2, 0, 0));
        this.l_hand_node = new Node("l_hand", sphere_shape, l_hand_transform);
        // ll_arm->r_wrist->r_hand
        const l_wrist_location = Mat4.translation(-2, 0, 0);
        this.l_wrist = new Arc("l_wrist", this.ll_arm_node, this.l_hand_node, l_wrist_location);
        this.ll_arm_node.children_arcs.push(this.l_wrist);
        this.l_wrist.set_dof(true, false, true);

         // left upper leg
        let lu_leg_transform = Mat4.scale(0.2, 1.2, .2);
        lu_leg_transform.pre_multiply(Mat4.translation(0.4, -1.5, 0));
        this.lu_leg_node = new Node("lu_leg", sphere_shape, lu_leg_transform);
        // torso->r_shoulder->ru_arm
        const l_hip_location = Mat4.translation(-0.6, -2, 0);
        this.lu_hip = new Arc("l_hip", this.torso_node, this.lu_leg_node, l_hip_location);
        this.torso_node.children_arcs.push(this.lu_hip)

        // left lower leg
        let ll_leg_transform = Mat4.scale(0.2, 1.2, .2);
        ll_leg_transform.pre_multiply(Mat4.translation(1, 0.5, 0));
        this.ll_leg_node = new Node("ll_leg", sphere_shape, ll_leg_transform);
        // torso->r_shoulder->ru_arm
        const l_keen_location = Mat4.translation(-0.6, -4, 0);
        this.l_kneen = new Arc("l_kneen", this.lu_leg_node, this.ll_leg_node, l_keen_location);
        this.lu_leg_node.children_arcs.push(this.l_kneen);

        //left feet 
        let l_feet_transform = Mat4.scale(.4, .3, .2);
        l_feet_transform.pre_multiply(Mat4.translation(1, -3, 0));
        this.l_feet_node = new Node("l_feet", sphere_shape, l_feet_transform);
        // torso->r_shoulder->ru_arm
        const l_anckle_location = Mat4.translation(0, 2.5, 0);
        this.l_anckle= new Arc("l_anckle", this.ll_leg_node, this.l_feet_node, l_anckle_location);
        this.ll_leg_node.children_arcs.push(this.l_anckle);

        // right upper leg
        let ru_leg_transform = Mat4.scale(0.2, 1.2, .2);
        ru_leg_transform.pre_multiply(Mat4.translation(1, -1.5, 0));
        this.ru_leg_node = new Node("lu_leg", sphere_shape, ru_leg_transform);
        // torso->r_shoulder->ru_arm
        const r_hip_location = Mat4.translation(-0.5, -2, 0);
        this.ru_hip = new Arc("l_hip", this.torso_node, this.ru_leg_node, r_hip_location);
        this.torso_node.children_arcs.push(this.ru_hip)
        this.ru_hip.set_dof(true, true, true);

         // right lower leg
        let rl_leg_transform = Mat4.scale(0.2, 1.2, .2);
        rl_leg_transform.pre_multiply(Mat4.translation(1.5, 0.5, 0));
        this.rl_leg_node = new Node("rl_leg", sphere_shape, rl_leg_transform);
        // torso->r_shoulder->ru_arm
        const r_keen_location = Mat4.translation(-0.5, -4, 0);
        this.r_kneen = new Arc("r_kneen", this.ru_leg_node, this.rl_leg_node, r_keen_location);
        this.ru_leg_node.children_arcs.push(this.r_kneen)
        
        //right feet 
        let r_feet_transform = Mat4.scale(.4, .3, .2);
        r_feet_transform.pre_multiply(Mat4.translation(0.4, -3, 0));
        this.r_feet_node = new Node("l_feet", sphere_shape, r_feet_transform);
        // torso->r_shoulder->ru_arm
        const r_anckle_location = Mat4.translation(1, 2.5, 0);
        this.r_anckle = new Arc("l_kneen", this.rl_leg_node, this.r_feet_node,r_anckle_location);
        this.rl_leg_node.children_arcs.push(this.r_anckle);

        // add the only end-effector
        const r_hand_end_local_pos = vec4(0.8, 0, 0, 1);
        this.end_effector = new End_Effector("right_hand", this.r_wrist, r_hand_end_local_pos);
        this.r_wrist.end_effector = this.end_effector;

        // here I only use 7 dof
        this.dof = 7;
        this.Jacobian = null;
        this.theta = [0, 0, 0, 0, 0, 0, 0];
        this.apply_theta();
    }

    // mapping from global theta to each joint theta
    apply_theta() {
        this.r_shoulder.update_articulation(this.theta.slice(0, 3));
        this.r_elbow.update_articulation(this.theta.slice(3, 5));
        this.r_wrist.update_articulation(this.theta.slice(5, 7));
    }

    get_joint_positions() {
        // This will hold the global position of each joint
        let joint_positions = [];

        // Start from the root and recursively find each joint's position
        this._rec_joint_positions(this.root, Mat4.identity(), joint_positions);

        return joint_positions;
    }

    _rec_joint_positions(arc, accumulated_matrix, joint_positions) {
        if (!arc) return;

        // Apply the current arc's local transformation and articulation to the accumulated matrix
        const L = arc.location_matrix; // Local transformation (translation)
        const A = arc.articulation_matrix; // Current articulation (rotation)
        let current_matrix = accumulated_matrix.times(L).times(A);

        // Store the global position for the current joint
        // Assuming the joint position is the origin of the local coordinate system
        joint_positions.push(current_matrix.times(vec4(0, 0, 0, 1)).to3());

        // Recursively update the positions of the child joints
        for (const child_arc of arc.child_node.children_arcs) {
            this._rec_joint_positions(child_arc, current_matrix, joint_positions);
        }
    }
    

    //Not used currentlt
    calculate_Jacobian() {
        let J = new Array(3);
        for (let i = 0; i < 3; i++) {
            J[i] = new Array(this.dof);
        }

        // Implement Jacobian calculation with finite differences
        const dt = 0.001;
        const curr_end_effector_pos = this.get_end_effector_position();

        for (let i = 0; i < this.dof; i++) {
            this.theta[i] = this.theta[i] + dt;
            this.apply_theta();

            let n_end_pos = this.get_end_effector_position();

            J[0][i] = (n_end_pos[0] - curr_end_effector_pos[0]) / dt;
            J[1][i] = (n_end_pos[1] - curr_end_effector_pos[1]) / dt;
            J[2][i] = (n_end_pos[2] - curr_end_effector_pos[2]) / dt;

            this.theta[i] = this.theta[i] - dt;
            this.apply_theta();
        }
        return J; // 3x7 in my case.
    }
    
    calculate_delta_theta(J, dx) {
        const A = math.multiply(math.transpose(J), J);
        let dy = [dx[0], dx[1], dx[2]];
        let dxTrans = math.transpose(dy);
        const b = math.multiply(math.transpose(J), dxTrans);
        const x = math.lusolve(A, b);

        return x;
    }

    get_end_effector_position() {
        this.matrix_stack = [];
        this._rec_update(this.root, Mat4.identity());
        const v = this.end_effector.global_position; // vec4
        return vec3(v[0], v[1], v[2]);
    }

    perform_ik(target_position, max_iterations = 100, tolerance = 0.01, learning_rate = 0.3) {
        let current_position = this.get_end_effector_position();

        for (let iteration = 0; iteration < max_iterations; iteration++) {
            // Calculate the error vector (dx) between current and target positions
            let dx = (target_position.minus(current_position)).times(learning_rate);
            
            // Check if we are close enough to the target
            if (dx.norm() < tolerance) {
                break;
            }
            
            // Calculate the Jacobian
            let J = this.calculate_Jacobian();
            let J_plus = math.multiply(math.transpose(J), math.inv(math.multiply(J, math.transpose(J))));
            let delta_theta = math.multiply(J_plus, [[dx[0]], [dx[1]], [dx[2]]]);
            
            // Update the joint angles based on delta_theta
            for (let i = 0; i < this.theta.length; i++) {
                this.theta[i] = parseFloat(this.theta[i]) + parseFloat(delta_theta[i]);
            }
            
            // Apply the updated joint angles
            this.apply_theta();
            current_position.add_by(dx);
        }
    }
    
    // Simplified IK for better performance
    perform_simplified_ik(target_position, max_iterations = 5) {
        const start_pos = this.get_end_effector_position();
        const direction = target_position.minus(start_pos).normalized();
        const distance = target_position.minus(start_pos).norm();
        
        // Skip small movements
        if (distance < 0.05) return;
        
        // Apply reduced iterations for performance
        for (let i = 0; i < max_iterations; i++) {
            // Simplified jacobian approximation with predefined weights
            const weights = [0.5, 0.5, 0.5, 0.3, 0.3, 0.2, 0.2];
            
            // Apply weighted changes to joints based on direction
            for (let j = 0; j < this.theta.length; j++) {
                // Apply adjustment based on direction and joint influence
                this.theta[j] += direction[j % 3] * weights[j] * 0.05;
            }
            
            this.apply_theta();
        }
    }

    _rec_update(arc, matrix) {
        if (arc !== null) {
            const L = arc.location_matrix;
            const A = arc.articulation_matrix;
            matrix.post_multiply(L.times(A));
            this.matrix_stack.push(matrix.copy());

            if (arc.end_effector !== null) {
                arc.end_effector.global_position = matrix.times(arc.end_effector.local_position);
            }

            const node = arc.child_node;
            const T = node.transform_matrix;
            matrix.post_multiply(T);

            matrix = this.matrix_stack.pop();
            for (const next_arc of node.children_arcs) {
                this.matrix_stack.push(matrix.copy());
                this._rec_update(next_arc, matrix);
                matrix = this.matrix_stack.pop();
            }
        }
    }

    draw(webgl_manager, uniforms, material) {
        this.matrix_stack = [];
        this._rec_draw(this.root, Mat4.identity(), webgl_manager, uniforms, material);
    }

    _rec_draw(arc, matrix, webgl_manager, uniforms, material) {
        if (arc !== null) {
            const L = arc.location_matrix;
            const A = arc.articulation_matrix;
            matrix.post_multiply(L.times(A));
            this.matrix_stack.push(matrix.copy());

            const node = arc.child_node;
            const T = node.transform_matrix;
            matrix.post_multiply(T);
            node.shape.draw(webgl_manager, uniforms, matrix, material);

            matrix = this.matrix_stack.pop();
            for (const next_arc of node.children_arcs) {
                this.matrix_stack.push(matrix.copy());
                this._rec_draw(next_arc, matrix, webgl_manager, uniforms, material);
                matrix = this.matrix_stack.pop();
            }
        }
    }

    debug(arc=null, id=null) {
        const J = this.calculate_Jacobian();
        let dx = [[0], [-0.02], [0]];
        if (id === 2)
            dx = [[-0.02], [0], [0]];
        const dtheta = this.calculate_delta_theta(J, dx);
        this.theta = this.theta.map((v, i) => v + dtheta[i][0]);
        this.apply_theta();
    }
}

// NPC Manager to handle multiple human instances
export class NPCManager {
  constructor(maxNPCs = 10) {
    this.npcs = [];
    this.maxNPCs = maxNPCs;
    this.activeNPCs = 0;
    this.updateFrequency = 2; // Update every N frames
    this.currentFrame = 0;
    this.precomputedPositions = new Map(); // Cache for positions
  }

  // Initialize a pool of NPCs
  initializePool() {
    for (let i = 0; i < this.maxNPCs; i++) {
      // Create NPC but don't activate yet
      const npc = new OptimizedHuman();
      npc.active = false;
      npc.manager = this; // Reference to the manager for accessing shared resources
      this.npcs.push(npc);
    }
  }

  // Spawn a new NPC at a specific position
  spawnNPC(position) {
    if (this.activeNPCs >= this.maxNPCs) {
      console.warn("Maximum NPCs reached, cannot spawn more");
      return null;
    }

    // Find an inactive NPC in the pool
    for (let i = 0; i < this.maxNPCs; i++) {
      if (!this.npcs[i].active) {
        this.npcs[i].active = true;
        this.npcs[i].reset(position);
        this.activeNPCs++;
        return this.npcs[i];
      }
    }
  }

  // Remove an NPC (return it to the pool)
  removeNPC(npcId) {
    for (let i = 0; i < this.maxNPCs; i++) {
      if (this.npcs[i].id === npcId && this.npcs[i].active) {
        this.npcs[i].active = false;
        this.activeNPCs--;
        return true;
      }
    }
    return false;
  }

  // Update only active NPCs and stagger updates
  update(dt) {
    this.currentFrame++;
    
    // Only update on certain frames to distribute CPU load
    if (this.currentFrame % this.updateFrequency !== 0) {
      return;
    }
    
    // Distribute updates across NPCs
    const activeNPCs = this.npcs.filter(npc => npc.active);
    const updateCount = Math.min(3, activeNPCs.length); // Update max 3 NPCs per frame
    
    for (let i = 0; i < updateCount; i++) {
      const index = (this.currentFrame / this.updateFrequency + i) % activeNPCs.length;
      activeNPCs[index].update(dt * this.updateFrequency);
    }
  }

  // Draw all active NPCs
  draw(webgl_manager, uniforms, material) {
    for (const npc of this.npcs) {
      if (npc.active) {
        npc.draw(webgl_manager, uniforms, material);
      }
    }
  }

  // Pre-compute spline positions for common paths
  precomputePath(pathId, spline, steps = 100) {
    if (this.precomputedPositions.has(pathId)) {
      return; // Already computed
    }
    
    const positions = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      positions.push(spline.getPosition(t));
    }
    
    this.precomputedPositions.set(pathId, positions);
  }
  
  // Get a pre-computed position instead of calculating it
  getPrecomputedPosition(pathId, t) {
    if (!this.precomputedPositions.has(pathId)) {
      return null;
    }
    
    const positions = this.precomputedPositions.get(pathId);
    const index = Math.floor(t * (positions.length - 1));
    return positions[index];
  }
}

// Optimized Human class with performance improvements
export class OptimizedHuman extends Articulated_Human {
  constructor() {
    super();
    this.id = Math.random().toString(36).substr(2, 9);
    this.active = false;
    this.currentPath = null;
    this.pathPosition = 0;
    this.updateInterval = 0.05; // Only update IK every 50ms if used
    this.timeSinceLastUpdate = 0;
    this.useSimplifiedIK = true;
    this.lodLevel = 0; // 0-2 0 for HD
    this.manager = null;
    this.spline = null;
    
    // Pre-computed configurations for common poses
    this.commonPoses = {
      standing: [0, 0, 0, 0, 0, 0, 0],
      walking: [0.1, 0.2, 0, 0.3, 0.1, 0.1, 0],
      running: [0.2, 0.4, 0.1, 0.5, 0.2, 0.2, 0.1]
    };
  }
  
  reset(position) {
    // Reset to default pose
    this.theta = [...this.commonPoses.standing];
    this.apply_theta();
    this.pathPosition = 0;
    
    // Set position
    if (position) {
      this.root.location_matrix = Mat4.translation(position[0], position[1], position[2]);
    }
  }
  
  // Override update to use LOD and simplified calculations
  update(dt) {
    if (!this.active) return;
    
    this.timeSinceLastUpdate += dt;
    
    // Only update IK at specified intervals
    if (this.timeSinceLastUpdate >= this.updateInterval) {
      this.timeSinceLastUpdate = 0;
      
      if (this.currentPath) {
        this.pathPosition = (this.pathPosition + dt * 0.1) % 1.0;
        
        // Use precomputed positions if available
        let target;
        if (this.manager && this.manager.getPrecomputedPosition(this.currentPath, this.pathPosition)) {
          target = this.manager.getPrecomputedPosition(this.currentPath, this.pathPosition);
        } else if (this.spline) {
          target = this.spline.getPosition(this.pathPosition);
        }
        
        if (target) {
          // Use simplified IK for performance
          if (this.useSimplifiedIK) {
            this.perform_simplified_ik(target);
          } else {
            // Use fewer iterations for standard IK
            this.perform_ik(target, 5, 0.05, 0.3);
          }
        }
      }
    }
  }
  
  // LOD system for drawing
  setLODLevel(level) {
    this.lodLevel = Math.min(2, Math.max(0, level));
  }
  
  // Override draw to use LOD
  draw(webgl_manager, uniforms, material) {
    if (!this.active) return;
    
    // Apply different detail levels based on distance
    if (this.lodLevel === 0) {
      // High detail - draw everything
      super.draw(webgl_manager, uniforms, material);
    } else if (this.lodLevel === 1) {
      // Medium detail - skip some parts
      this.matrix_stack = [];
      this._rec_draw_lod(this.root, Mat4.identity(), webgl_manager, uniforms, material, 1);
    } else {
      // Low detail - very simplified
      this.matrix_stack = [];
      this._rec_draw_lod(this.root, Mat4.identity(), webgl_manager, uniforms, material, 2);
    }
  }
  
  // LOD-based drawing
  _rec_draw_lod(arc, matrix, webgl_manager, uniforms, material, lod_level) {
    if (!arc) return;
    
    const L = arc.location_matrix;
    const A = arc.articulation_matrix;
    matrix.post_multiply(L.times(A));
    this.matrix_stack.push(matrix.copy());
    
    const node = arc.child_node;
    
    // Skip some nodes based on LOD level
    let should_draw = true;
    if (lod_level >= 1) {
      // Medium detail - skip fingers, toes
      if (node.name.includes("hand") || node.name.includes("feet")) {
        should_draw = false;
      }
    }
    if (lod_level >= 2) {
      // Low detail - only draw major body parts
      if (!["torso", "head", "ru_arm", "lu_arm", "ru_leg", "lu_leg"].includes(node.name)) {
        should_draw = false;
      }
    }
    
    if (should_draw) {
      const T = node.transform_matrix;
      matrix.post_multiply(T);
      node.shape.draw(webgl_manager, uniforms, matrix, material);
    }
    
    matrix = this.matrix_stack.pop();
    
    // Process children
    for (const next_arc of node.children_arcs) {
      this.matrix_stack.push(matrix.copy());
      this._rec_draw_lod(next_arc, matrix, webgl_manager, uniforms, material, lod_level);
      matrix = this.matrix_stack.pop();
    }
  }
  
  // Set movement along a spline path
  followPath(pathId, spline) {
    this.currentPath = pathId;
    this.spline = spline;
    this.pathPosition = 0;
  }
  
  // Apply a pre-defined pose instead of IK for simple animations
  applyPose(poseName) {
    if (this.commonPoses[poseName]) {
      this.theta = [...this.commonPoses[poseName]];
      this.apply_theta();
    }
  }
}

class Node {
    constructor(name, shape, transform) {
        this.name = name;
        this.shape = shape;
        this.transform_matrix = transform;
        this.parent_arc = null;
        this.children_arcs = [];
    }
}

class Arc {
    constructor(name, parent, child, location) {
        this.name = name;
        this.parent_node = parent;
        this.child_node = child;
        this.location_matrix = location;
        this.articulation_matrix = Mat4.identity();
        this.end_effector = null;
        this.dof = {
            Rx: false,
            Ry: false,
            Rz: false,
        }
    }

    // Here I only implement rotational DOF
    set_dof(x, y, z) {
        this.dof.Rx = x;
        this.dof.Ry = y;
        this.dof.Rz = z;
    }

    update_articulation(theta) {
        this.articulation_matrix = Mat4.identity();
        let index = 0;
        if (this.dof.Rx) {
            this.articulation_matrix.pre_multiply(Mat4.rotation(theta[index], 1, 0, 0));
            index += 1;
        }
        if (this.dof.Ry) {
            this.articulation_matrix.pre_multiply(Mat4.rotation(theta[index], 0, 1, 0));
            index += 1;
        }
        if (this.dof.Rz) {
            this.articulation_matrix.pre_multiply(Mat4.rotation(theta[index], 0, 0, 1));
        }
    }
}

class End_Effector {
    constructor(name, parent, local_position) {
        this.name = name;
        this.parent = parent;
        this.local_position = local_position;
        this.global_position = null;
    }
}