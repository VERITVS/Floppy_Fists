import {tiny, defs} from './examples/common.js';

import { Articulated_Human } from './human.js';


/**
 * TBD : Create PlayerHuman class which defines a ragdoll NPC which we can directly control
 * Create secondary motion algorithm for the ragdolls so that they can charge the player
 * Create animations for ragdolls when they take damage and another for the death animation (falling to the floor)
 * Collision detection using substepping and BVH Hierarchy
 * Implement guns or other weapons
 * More advanced enemy NPCs?
 * 
 */

const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

class HermitSpline {
  constructor() {
    this.controlPoints = [];
    this.tangents = [];
    this.size = 0;
    this.cachedPositions = null;
    this.cacheResolution = 1000; 
    this.needsRecompute = true;
  }

  addPoint(position, tangent) {
    if (this.controlPoints.length < 200) {
      this.controlPoints.push(position);
      this.tangents.push(tangent);
      this.size++;
      this.needsRecompute = true;
    } else {
      console.error("Maximum number of control points (200) reached.");
    }
  }

  setPoint(index, position) {
    if (index < this.controlPoints.length) {
      this.controlPoints[index] = position;
      this.needsRecompute = true;
    } else {
      console.error("Invalid control point index.");
    }
  }

  setTangent(index, tangent) {
    if (index < this.controlPoints.length) {
      this.tangents[index] = tangent;
      this.needsRecompute = true;
    } else {
      console.error("Invalid control point index.");
    }
  }

  precomputePositions() {
    if (!this.needsRecompute && this.cachedPositions) {
      return;
    }
    
    this.cachedPositions = new Array(this.cacheResolution + 1);
    
    for (let i = 0; i <= this.cacheResolution; i++) {
      const t = i / this.cacheResolution;
      this.cachedPositions[i] = this._calculatePosition(t);
    }
    
    this.needsRecompute = false;
  }

  getPosition(t) {
    t = Math.max(0, Math.min(1, t));
    
    if (this.cachedPositions && !this.needsRecompute) {
      const index = Math.floor(t * this.cacheResolution);
      return this.cachedPositions[index];
    }
    
    return this._calculatePosition(t);
  }

  _calculatePosition(t) {
    if (this.controlPoints.length === 0) {
      return vec3(0, 0, 0);
    }
    
    if (t <= 0) return this.controlPoints[0];
    if (t >= 1) return this.controlPoints[this.controlPoints.length - 1];
    
    const segmentCount = this.controlPoints.length - 1;
    const segment = Math.min(Math.floor(t * segmentCount), segmentCount - 1);
    const s = (t * segmentCount) - segment;
    
    const p0 = this.controlPoints[segment];
    const p1 = this.controlPoints[segment + 1];
    
    const segmentLength = 1.0 / segmentCount;
    const m0 = this.tangents[segment].times(segmentLength);
    const m1 = this.tangents[segment + 1].times(segmentLength);
    
    const h0 = 2*s*s*s - 3*s*s + 1;
    const h1 = s*s*s - 2*s*s + s;
    const h2 = -2*s*s*s + 3*s*s;
    const h3 = s*s*s - s*s;
    
    return p0.times(h0).plus(m0.times(h1)).plus(p1.times(h2)).plus(m1.times(h3));
  }

  addFigureEightPoint(x, y, z, tangentX, tangentY, tangentZ) {
    this.addPoint(vec3(x, y, z), vec3(tangentX, tangentY, tangentZ));
  }
}

class Curve_Shape extends Shape {
  constructor(curve_function, sample_count, curve_color = color(1, 0, 0, 1)) {
    super("position", "normal");
    this.material = { shader: new defs.Phong_Shader(), ambient: 1.0, color: curve_color };
    this.sample_count = sample_count;
    
    this.arrays.position = this.arrays.position || [];
    this.arrays.normal = this.arrays.normal || [];

    if (curve_function && this.sample_count) {
      for (let i = 0; i < this.sample_count + 1; i++) {
        let t = i / this.sample_count;
        this.arrays.position.push(curve_function(t));
        this.arrays.normal.push(vec3(0, 0, 0));
      }
    }
  }

  draw(webgl_manager, uniforms) {
    super.draw(webgl_manager, uniforms, Mat4.identity(), this.material, "LINE_STRIP");
  }
}

// New class to take an OOP approach to handling the ArticulatedHuman from assignment 2
class ArenaNPC_System {
  constructor(maxNPCs = 15) {
    this.npcs = [];
    this.maxNPCs = maxNPCs;
    this.activeNPCs = 0;
    this.currentFrame = 0;
    this.precomputedPositions = new Map();
    this.arenaSize = 40; // Adjust as you see fit
    this.arenaHeight = 100; // Adjust of you see fit
    this.splines = new Map();
    
    // Running pose - can be adjusted as well
    this.runningPose = {
      updateFrequency: 0.1,
      amplitude: 0.4,
      legPhaseOffset: Math.PI,
      armPhaseOffset: Math.PI * 0.5,
    };
    
    // Path generator
    this.pathIdCounter = 0;
  }
  
  initializePool() {
    console.log("Initializing Arena NPC pool with capacity:", this.maxNPCs);
    
    for (let i = 0; i < this.maxNPCs; i++) {
      const npc = new Articulated_Human();
      npc.active = false;
      npc.id = "npc-" + i;
      npc.pathPosition = 0;
      npc.currentPath = null;
      npc.spline = null;
      npc.speed = 0.05 + Math.random() * 0.1; // Speed
      npc.animPhase = Math.random() * Math.PI * 2; // Animation phase
      npc.pathUpdateNeeded = true;
      this.npcs.push(npc);
    }
  }
  
  createRandomPath() {
    const pathId = "path-" + (this.pathIdCounter++);
    const spline = new HermitSpline();
    
    // Pick random path
    const numPoints = 3 + Math.floor(Math.random() * 3); // 3-5 points (Increase?)
    const points = [];
    
    // Generate the points
    for (let i = 0; i < numPoints; i++) {
      const x = (Math.random() * 2 - 1) * this.arenaSize * 0.9; // Stay away from walls
      const z = (Math.random() * 2 - 1) * this.arenaSize * 0.9;
      points.push(vec3(x, 0, z));
    }
    
    for (let i = 0; i < numPoints; i++) {
      const prev = points[(i - 1 + numPoints) % numPoints];
      const curr = points[i];
      const next = points[(i + 1) % numPoints];
      
      // Calculate tangent as direction to next point
      const tangent = next.minus(prev).normalized().times(5);
      spline.addPoint(curr, tangent);
    }
    
    // Add the first point again to close the loop
    const firstTangent = points[1].minus(points[numPoints-1]).normalized().times(5);
    spline.addPoint(points[0], firstTangent);
    
    spline.precomputePositions();
    this.splines.set(pathId, spline);
    this.precomputePath(pathId, spline, 200);
    
    return pathId;
  }
  
  spawnNPCsInArena(count) {
    const spawnCount = Math.min(count, this.maxNPCs - this.activeNPCs);
    const spawnedNPCs = [];
    
    for (let i = 0; i < spawnCount; i++) {
      // Random position in the arena
      const x = (Math.random() * 2 - 1) * this.arenaSize * 0.8; // Stay further from walls
      const z = (Math.random() * 2 - 1) * this.arenaSize * 0.8;
      const position = vec3(x, 0, z);
      
      const npc = this.spawnNPC(position);
      if (npc) {
        // Creates a unique path for the current NPC, later we need to add a second path where this NPC will try to attack the player character
        const pathId = this.createRandomPath();
        this.setNPCPath(npc, pathId, this.splines.get(pathId));
        spawnedNPCs.push(npc);
      }
    }
    
    return spawnedNPCs;
  }
  
  spawnNPC(position) {
    if (this.activeNPCs >= this.maxNPCs) {
      console.warn("Maximum NPCs reached");
      return null;
    }
    
    for (let i = 0; i < this.npcs.length; i++) {
      if (!this.npcs[i].active) {
        this.npcs[i].active = true;
        
        // Adjust Y position to make NPC stand on the ground
        const y = 4; // Height from ground to NPC center 
        this.npcs[i].root.location_matrix = Mat4.translation(position[0], y, position[2]);
        
        this.activeNPCs++;
        console.log("Spawned NPC at position:", position);
        return this.npcs[i];
      }
    }
    return null;
  }
  
  removeNPC(id) {
    for (let i = 0; i < this.npcs.length; i++) {
      if (this.npcs[i].id === id && this.npcs[i].active) {
        this.npcs[i].active = false;
        this.activeNPCs--;
        return true;
      }
    }
    return false;
  }
  
  // Cache positions
  precomputePath(pathId, spline, steps = 100) {
    if (!pathId || !spline || this.precomputedPositions.has(pathId)) {
      return;
    }
    
    const positions = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      positions.push(spline.getPosition(t));
    }
    
    this.precomputedPositions.set(pathId, positions);
  }
  
  getPrecomputedPosition(pathId, t) {
    if (!this.precomputedPositions.has(pathId)) {
      return null;
    }
    
    const positions = this.precomputedPositions.get(pathId);
    const index = Math.floor(t * (positions.length - 1));
    return positions[index];
  }
  
  applyRunningAnimation(npc, time) {
    const phase = npc.animPhase + time * 5; // Animation phase
    
    //Set running pose with exaggerated movement for all NPCs
    const pose = this.runningPose;
    
    // Swing arms
    npc.theta[0] = Math.sin(phase) * pose.amplitude; // Right arm forward/back
    npc.theta[1] = Math.cos(phase) * (pose.amplitude * 0.5); // Right arm side-to-side

    // Trivial procedural walking algorithm, use sine and cosine curves to model arm/leg movements 
    // Use Math.PI as the offset so that corresponding limbs move opposite to each other
    // Enhance using more nodes(?)
    
    // Arm motion is opposite to one another
    if (npc.l_shoulder) {
      npc.l_shoulder.update_articulation([
        Math.sin(phase + pose.armPhaseOffset) * pose.amplitude,
        Math.cos(phase + pose.armPhaseOffset) * (pose.amplitude * 0.5),
        0
      ]);
    }
    
    // Right leg moves
    if (npc.ru_hip) {
      npc.ru_hip.update_articulation([
        Math.sin(phase + pose.legPhaseOffset) * pose.amplitude,
        0,
        0
      ]);
    }
    
    // Left leg moves opposite to right leg
    if (npc.lu_hip) {
      npc.lu_hip.update_articulation([
        Math.sin(phase + Math.PI + pose.legPhaseOffset) * pose.amplitude,
        0,
        0
      ]);
    }
    
    // Bent elbow while running
    if (npc.r_elbow) {
      npc.r_elbow.update_articulation([0.5, 0]);
    }
    
    if (npc.l_elbow) {
      npc.l_elbow.update_articulation([0.5, 0]);
    }
    
    // Apply rest of the updates
    npc.apply_theta();
  }
  
  generateNewPathForNPC(npc) {
    // Create path
    const pathId = this.createRandomPath();
    this.setNPCPath(npc, pathId, this.splines.get(pathId));
    npc.pathUpdateNeeded = false;
  }
  
  update(dt) {
    this.currentFrame++;
    
    // Group NPCs into batches for staggered updates
    const batchSize = Math.ceil(this.npcs.length / 4); // 4 batches
    const batchIndex = Math.floor(this.currentFrame / 2) % 4; // Rotate through batches
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, this.npcs.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      const npc = this.npcs[i];
      if (npc && npc.active) {
        try {
          if (npc.currentPath && npc.spline) {
            // Update path position based on speed
            npc.pathPosition = (npc.pathPosition + dt * npc.speed) % 1.0;
            
            // Periodically generate new paths
            if (Math.random() < 0.001) { // Small chance each update
              npc.pathUpdateNeeded = true;
            }
            
            // Generate new path if needed
            if (npc.pathUpdateNeeded) {
              this.generateNewPathForNPC(npc);
            }
            
            // Get target position
            let target;
            if (this.precomputedPositions.has(npc.currentPath)) {
              target = this.getPrecomputedPosition(npc.currentPath, npc.pathPosition);
            } else if (npc.spline) {
              target = npc.spline.getPosition(npc.pathPosition);
            }
            
            if (target) {
              // Get current position from root location
              const rootMat = npc.root.location_matrix;
              const currentPos = vec3(rootMat[0][3], rootMat[1][3], rootMat[2][3]);
              
              // Calculate direction for NPC to face
              const direction = vec3(target[0] - currentPos[0], 0, target[2] - currentPos[2]);
              
              if (direction.norm() > 0.01) {
                // Move towards target (simple approach without IK)
                const newPos = vec3(
                  currentPos[0] + direction[0] * dt * 2,
                  currentPos[1], // Keep same height
                  currentPos[2] + direction[2] * dt * 2
                );
                
                // Update position
                npc.root.location_matrix = Mat4.translation(newPos[0], newPos[1], newPos[2]);
                
                // Apply running animation
                this.applyRunningAnimation(npc, this.currentFrame * dt);
              }
            }
          } else {
            // Apply simpler animation for NPCs without paths
            this.applyRunningAnimation(npc, this.currentFrame * dt);
          }
        } catch (error) {
          console.error("Error updating NPC:", error);
        }
      }
    }
  }
  
  draw(webgl_manager, uniforms, material) {
    for (const npc of this.npcs) {
      if (npc && npc.active) {
        try {
          npc.draw(webgl_manager, uniforms, material);
        } catch (error) {
          console.error("Error drawing NPC:", error);
          npc.active = false;
          this.activeNPCs = Math.max(0, this.activeNPCs - 1);
        }
      }
    }
  }
  
  setNPCPath(npc, pathId, spline) {
    if (npc) {
      npc.currentPath = pathId;
      npc.spline = spline;
      npc.pathPosition = Math.random(); // Start at random position
      npc.pathUpdateNeeded = false;
    }
  }
}

export
const Assignment2_base = defs.Assignment2_base =
    class Assignment2_base extends Component
    {                                        
      constructor(){
        super();
        this.t_sim = 0; 
      }
      
      init()
      {
        console.log("Initializing Assignment2 Arena");

        this.hover = this.swarm = false;
        this.shapes = { 
          'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere(4),
          'axis' : new defs.Axis_Arrows() 
        };

        const basic = new defs.Basic_Shader();
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color(.9,.5,.9,1) };
        this.materials.metal = { shader: phong, ambient: .2, diffusivity: 1, specularity: 1, color: color(.9,.5,.9,1) };
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture("assets/rgb.jpg") };
        this.materials.floor = { shader: phong, ambient: .2, diffusivity: 0.8, specularity: 0.2, color: color(0.5, 0.5, 0.5, 1) };
        
        // Materials for enclosure
        this.materials.ceiling = { shader: phong, ambient: 0.1, diffusivity: 0.7, specularity: 0.3, color: color(0.3, 0.3, 0.4, 1) };
        this.materials.wall = { shader: phong, ambient: 0.15, diffusivity: 0.8, specularity: 0.2, color: color(0.2, 0.6, 0.7, 0.9) };
        this.materials.pillar = { shader: phong, ambient: 0.2, diffusivity: 0.9, specularity: 0.4, color: color(0.7, 0.3, 0.2, 1) };

        // Create arena NPC system with increased capacity
        this.npcSystem = new ArenaNPC_System(15);
        this.npcSystem.initializePool();
        
        // Spawn initial NPCs
        this.npcSystem.spawnNPCsInArena(12); // Start with 12 NPCs
        
        // Time for ceiling lights animation
        this.light_time = 0;
      }

      render_animation(caller)
      {                                        
        // Setup
        if(!caller.controls) { 
          this.animated_children.push(caller.controls = new defs.Movement_Controls({ uniforms: this.uniforms }));
          caller.controls.add_mouse_controls(caller.canvas);
          
          // Camera position adjusted for enclosed arena
          const cameraHeight = this.npcSystem.arenaHeight * 0.6;
          const cameraDistance = this.npcSystem.arenaSize * 0.4;
          Shader.assign_camera(Mat4.look_at(vec3(0, cameraHeight, cameraDistance), vec3(0, 5, 0), vec3(0, 1, 0)), this.uniforms);
        }
        
        this.uniforms.projection_transform = Mat4.perspective(Math.PI/4, caller.width/caller.height, 1, 200);

        // Animated lights
        const t = this.t = this.uniforms.animation_time/1000;
        this.light_time += 0.01;
        
        // Main arena light (constant)
        const main_light = vec4(0, this.npcSystem.arenaHeight * 0.8, 0, 1.0);
        
        // Moving spotlight effect
        const spotlight_x = Math.sin(this.light_time * 0.5) * this.npcSystem.arenaSize * 0.7;
        const spotlight_z = Math.cos(this.light_time * 0.7) * this.npcSystem.arenaSize * 0.7;
        const moving_light = vec4(spotlight_x, this.npcSystem.arenaHeight * 0.9, spotlight_z, 1.0);
        
        // Edge lights
        const edge_light1 = vec4(this.npcSystem.arenaSize * 0.9, this.npcSystem.arenaHeight * 0.5, 0, 1.0);
        const edge_light2 = vec4(-this.npcSystem.arenaSize * 0.9, this.npcSystem.arenaHeight * 0.5, 0, 1.0);
        
        // Set up multiple lights
        this.uniforms.lights = [
          defs.Phong_Shader.light_source(main_light, color(1, 1, 1, 1), 1000000),
          defs.Phong_Shader.light_source(moving_light, color(0.8, 0.3, 0.3, 1), 800000), // Red spotlight
          defs.Phong_Shader.light_source(edge_light1, color(0.3, 0.3, 0.8, 1), 600000), // Blue edge light
          defs.Phong_Shader.light_source(edge_light2, color(0.3, 0.8, 0.3, 1), 600000)  // Green edge light
        ];

        // Calculate time step for simulation
        const frameRate = 60;
        const dt = Math.min(1.0 / 30, 1.0 / frameRate);
        const t_next = this.t_sim + dt;
        
        // Update NPC system
        try {
          this.npcSystem.update(dt);
        } catch (error) {
          console.error("Error updating NPC system:", error);
        }
        
        // Increment simulation time
        this.t_sim = t_next;
      }
    }

export class Assignment2 extends Assignment2_base
{                                                    
  render_animation(caller)
  {                                                
    // Call parent method to handle base rendering and updates
    super.render_animation(caller);
    
    // Define colors - Change as you see fit
    const blue = color(0,0,1,1);
    const yellow = color(1,0.7,0,1);
    const wall_color = color(0.3, 0.5, 0.7, 0.9); 
    const floor_color = color(0.6, 0.6, 0.6, 1);
    const ceiling_color = color(0.3, 0.3, 0.4, 1);
    const body_color = color(1, 0.8, 0.8, 1);
    
    this.materials.human = { 
      shader: this.materials.plastic.shader, 
      ambient: 0.3, 
      diffusivity: 0.9, 
      specularity: 0.1, 
      color: body_color 
    };
    
    const arenaSize = this.npcSystem.arenaSize;
    const arenaHeight = this.npcSystem.arenaHeight;
    const wallHeight = arenaHeight;
    const wallThickness = 0.2;
    const pillarWidth = 1.5;
    
    // Arena floor
    let floor_transform = Mat4.translation(0, -0.1, 0).times(Mat4.scale(arenaSize, 0.1, arenaSize));
    this.shapes.box.draw(caller, this.uniforms, floor_transform, { ...this.materials.floor });
    
    // Arena ceiling
    let ceiling_transform = Mat4.translation(0, arenaHeight, 0).times(Mat4.scale(arenaSize, 0.1, arenaSize));
    this.shapes.box.draw(caller, this.uniforms, ceiling_transform, { ...this.materials.ceiling });
    
    // Walls
    
    // North wall
    let north_wall = Mat4.translation(0, wallHeight/2, -arenaSize).times(Mat4.scale(arenaSize, wallHeight/2, wallThickness));
    this.shapes.box.draw(caller, this.uniforms, north_wall, { ...this.materials.wall, color: wall_color });
    
    // South wall
    let south_wall = Mat4.translation(0, wallHeight/2, arenaSize).times(Mat4.scale(arenaSize, wallHeight/2, wallThickness));
    this.shapes.box.draw(caller, this.uniforms, south_wall, { ...this.materials.wall, color: wall_color });
    
    // East wall
    let east_wall = Mat4.translation(arenaSize, wallHeight/2, 0).times(Mat4.scale(wallThickness, wallHeight/2, arenaSize));
    this.shapes.box.draw(caller, this.uniforms, east_wall, { ...this.materials.wall, color: wall_color });
    
    // West wall
    let west_wall = Mat4.translation(-arenaSize, wallHeight/2, 0).times(Mat4.scale(wallThickness, wallHeight/2, arenaSize));
    this.shapes.box.draw(caller, this.uniforms, west_wall, { ...this.materials.wall, color: wall_color });
    
    // Draw pillars at corners for reinforcement and aesthetic
    const pillarHeight = arenaHeight;
    const cornerOffset = arenaSize - pillarWidth/2;
    
    // Corner pillars
    const pillarPositions = [
      vec3(cornerOffset, 0, cornerOffset),
      vec3(-cornerOffset, 0, cornerOffset),
      vec3(cornerOffset, 0, -cornerOffset),
      vec3(-cornerOffset, 0, -cornerOffset)
    ];
    
    for (const pos of pillarPositions) {
      let pillar_transform = Mat4.translation(pos[0], pillarHeight/2, pos[2])
                            .times(Mat4.scale(pillarWidth/2, pillarHeight/2, pillarWidth/2));
      this.shapes.box.draw(caller, this.uniforms, pillar_transform, { ...this.materials.pillar });
    }
    
    // Additional wall details - light strips (remove?)
    const stripHeight = 0.2;
    const stripY = arenaHeight * 0.7;
    
    // Light strips on walls with pulsing glow based on time
    const stripIntensity = Math.sin(this.light_time * 3) * 0.3 + 0.7; // Pulsing between 0.4 and 1.0
    const stripColor = color(0.2 * stripIntensity, 0.8 * stripIntensity, 1.0 * stripIntensity, 1);
    const stripMaterial = { 
      shader: this.materials.plastic.shader,
      ambient: 0.8, 
      diffusivity: 0.2,
      specularity: 1.0,
      color: stripColor
    };
    
    // North wall strip
    let north_strip = Mat4.translation(0, stripY, -arenaSize + wallThickness/2 + 0.01)
                     .times(Mat4.scale(arenaSize * 0.8, stripHeight, 0.05));
    this.shapes.box.draw(caller, this.uniforms, north_strip, stripMaterial);
    
    // South wall strip
    let south_strip = Mat4.translation(0, stripY, arenaSize - wallThickness/2 - 0.01)
                     .times(Mat4.scale(arenaSize * 0.8, stripHeight, 0.05));
    this.shapes.box.draw(caller, this.uniforms, south_strip, stripMaterial);
    
    // East wall strip
    let east_strip = Mat4.translation(arenaSize - wallThickness/2 - 0.01, stripY, 0)
                    .times(Mat4.scale(0.05, stripHeight, arenaSize * 0.8));
    this.shapes.box.draw(caller, this.uniforms, east_strip, stripMaterial);
    
    // West wall strip
    let west_strip = Mat4.translation(-arenaSize + wallThickness/2 + 0.01, stripY, 0)
                    .times(Mat4.scale(0.05, stripHeight, arenaSize * 0.8));
    this.shapes.box.draw(caller, this.uniforms, west_strip, stripMaterial);
    
    // Ceiling light fixtures - central light
    const centralLightRadius = 4;
    const centralLightHeight = 0.3;
    const centralLightY = arenaHeight - 0.2;
    
    const centerLightTransform = Mat4.translation(0, centralLightY, 0)
                                .times(Mat4.scale(centralLightRadius, centralLightHeight, centralLightRadius));
    
    // Use a glowing material for the central light
    const centerLightColor = color(1, 1, 0.9, 1);
    const centerLightMaterial = {
      shader: this.materials.plastic.shader,
      ambient: 0.9,
      diffusivity: 0.1,
      specularity: 1.0,
      color: centerLightColor
    };
    
    this.shapes.box.draw(caller, this.uniforms, centerLightTransform, centerLightMaterial);
    
    // Add spotlights at intervals around the edge of the ceiling
    const numSpotlights = 8;
    const spotlightRadius = 0.5;
    const spotlightDistance = arenaSize * 0.85;
    
    for (let i = 0; i < numSpotlights; i++) {
      const angle = (i / numSpotlights) * Math.PI * 2;
      const x = Math.cos(angle) * spotlightDistance;
      const z = Math.sin(angle) * spotlightDistance;
      
      // Alternate colors for spotlights
      const spotColor = (i % 2 === 0) 
        ? color(0.9, 0.3, 0.3, 1) // Red
        : color(0.3, 0.5, 0.9, 1); // Blue
      
      const spotMaterial = {
        shader: this.materials.plastic.shader,
        ambient: 0.9,
        diffusivity: 0.1, 
        specularity: 1.0,
        color: spotColor
      };
      
      const spotTransform = Mat4.translation(x, centralLightY, z)
                           .times(Mat4.scale(spotlightRadius, centralLightHeight, spotlightRadius));
      
      this.shapes.ball.draw(caller, this.uniforms, spotTransform, spotMaterial);
    }
    
    // Draw arena markers and details
    
    // Center circle
    const centerCircleRadius = 5;
    const centerCircleTransform = Mat4.translation(0, 0.02, 0)
                                 .times(Mat4.scale(centerCircleRadius, 0.02, centerCircleRadius));
    const centerCircleMaterial = {
      shader: this.materials.plastic.shader,
      ambient: 0.2,
      diffusivity: 0.8,
      specularity: 0.1,
      color: color(0.9, 0.9, 0.3, 1)
    };
    
    this.shapes.ball.draw(caller, this.uniforms, centerCircleTransform, centerCircleMaterial);
    
    // Draw directional markers on the floor
    const markerCount = 16; // Number of markers around the edge
    const markerDistance = arenaSize * 0.9; // Distance from center
    const markerSize = 1.0;
    
    for (let i = 0; i < markerCount; i++) {
      const angle = (i / markerCount) * Math.PI * 2;
      const x = Math.cos(angle) * markerDistance;
      const z = Math.sin(angle) * markerDistance;
      
      const markerColor = (i % 4 === 0) 
        ? color(0.9, 0.3, 0.3, 1) // Highlight every 4th marker
        : color(0.5, 0.5, 0.5, 1);
      
      const markerMaterial = {
        shader: this.materials.plastic.shader,
        ambient: 0.3,
        diffusivity: 0.7,
        specularity: 0.2,
        color: markerColor
      };
      
      const markerTransform = Mat4.translation(x, 0.05, z)
                             .times(Mat4.rotation(angle, 0, 1, 0))
                             .times(Mat4.scale(markerSize, 0.02, markerSize/3));
      
      this.shapes.box.draw(caller, this.uniforms, markerTransform, markerMaterial);
    }
    
    // End arena decor

    // Draw all NPCs using the NPC system
    try {
      this.npcSystem.draw(caller, this.uniforms, { ...this.materials.human });
    } catch (error) {
      console.error("Error drawing NPCs:", error);
    }
  }

  render_controls()
  {                                 
    this.control_panel.innerHTML += "Assignment 2 Based Ragdoll Arena";
    this.new_line();
    
    // Controls for adding/removing NPCs
    this.key_triggered_button("Add NPC", ["Control", "1"], () => {
      this.npcSystem.spawnNPCsInArena(1);
    });
    
    //Delete 1 NPC
    this.key_triggered_button("Remove NPC", ["Control", "2"], () => {
      const activeNPCs = this.npcSystem.npcs.filter(npc => npc.active);
      if (activeNPCs.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeNPCs.length);
        this.npcSystem.removeNPC(activeNPCs[randomIndex].id);
      }
    });
    
    // Spanwn in 5 at a time
    this.key_triggered_button("Add 5 NPCs", ["Control", "5"], () => {
      this.npcSystem.spawnNPCsInArena(5);
    });
    
    this.new_line();
    
    // Display active NPC count
    this.live_string(box => {
      box.textContent = "Active NPCs: " + (this.npcSystem ? this.npcSystem.activeNPCs : 0);
    });
    
    this.new_line();
    
    // Debug button retained from Assignment 2
    this.key_triggered_button("Debug", ["Shift", "D"], null);
    this.new_line();
  }
}